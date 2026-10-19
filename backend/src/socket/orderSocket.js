const {
  updateOrder,
  updateOrderItemStatus,
  closeBill,
  getDailyStats,
  cancelOrder,
} = require('../services/orderService')
const { getRestaurant } = require('../services/restaurantService')
const { auth } = require('../services/firebaseAdmin')

// Which staff roles may trigger which socket event
const EVENT_ROLES = {
  order_preparing: ['chef', 'receptionist', 'admin'],
  order_ready: ['chef', 'receptionist', 'admin'],
  item_status: ['chef', 'receptionist', 'admin'],
  chef_message: ['chef', 'admin'],
  cancel_order: ['receptionist', 'admin'],
  close_bill: ['receptionist', 'admin'],
}

const WAITER_CALL_COOLDOWN_MS = 10 * 1000

async function isServiceEnabled(restaurantId) {
  const restaurant = await getRestaurant(restaurantId)
  return restaurant?.subscription?.isServiceEnabled === true
}

async function emitStats(io, restaurantId) {
  const stats = await getDailyStats(restaurantId)
  io.to(restaurantId).emit('stats_update', stats)
}

function isPlatformAdmin(user) {
  return user?.role === 'superadmin' || user?.platformAdmin === true || user?.superAdmin === true
}

/** True only if the socket carries a verified staff token allowed to run `event` for this restaurant. */
function canAct(socket, event, restaurantId) {
  const user = socket.data.user
  if (!user || user.disabled || !restaurantId) return false
  if (isPlatformAdmin(user)) return true
  if (!EVENT_ROLES[event]?.includes(user.role)) return false
  return Boolean(user.restaurantId) && String(user.restaurantId) === String(restaurantId)
}

/** Wrap a staff-only handler: authorisation + error handling in one place. */
function staffHandler(socket, event, handler) {
  socket.on(event, async (data) => {
    try {
      const restaurantId = data?.restaurantId
      if (!canAct(socket, event, restaurantId)) {
        return socket.emit('unauthorized', { event, restaurantId })
      }
      await handler(data)
    } catch (err) {
      console.error(`${event} error:`, err)
      if (event === 'cancel_order') socket.emit('cancel_order_error', { error: err.message })
    }
  })
}

/**
 * Called by POST /api/orders after the order is saved.
 * The server (not the customer's browser) announces new orders.
 */
async function broadcastNewOrder(io, order) {
  if (!order?.restaurantId) return
  const isUpdate = Array.isArray(order.items) && order.items.length > (order.newItems?.length || 0)
  const payload = { ...order, isUpdate }
  io.to(order.restaurantId).emit(isUpdate ? 'order_updated' : 'order_received', payload)
  io.to(order.restaurantId).emit('bill_update', payload)
  await emitStats(io, order.restaurantId)
}

function initOrderSocket(io) {
  // Optional authentication: staff send their Firebase ID token in the handshake,
  // customers connect anonymously. Staff-only events below require a verified token.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
    if (token) {
      try {
        socket.data.user = await auth.verifyIdToken(token)
      } catch (err) {
        console.warn('Socket token rejected:', err.code || err.message)
        // Connect anyway as anonymous — staff events will be refused, and the
        // client re-sends a fresh token on its next reconnect.
      }
    }
    next()
  })

  io.on('connection', (socket) => {
    let lastWaiterCall = 0

    socket.on('join_restaurant', async (restaurantId) => {
      try {
        if (typeof restaurantId !== 'string' || !restaurantId) return
        socket.join(restaurantId)
        const stats = await getDailyStats(restaurantId)
        socket.emit('stats_update', stats)
      } catch (err) {
        console.error('join_restaurant error:', err.message)
      }
    })

    staffHandler(socket, 'order_preparing', async (data) => {
      if (!(await isServiceEnabled(data.restaurantId))) {
        return socket.emit('subscription_blocked', { restaurantId: data.restaurantId })
      }
      const order = await updateOrder(data.restaurantId, data.id, { status: 'preparing' })
      io.to(order.restaurantId).emit('status_changed', order)
      await emitStats(io, order.restaurantId)
    })

    staffHandler(socket, 'order_ready', async (data) => {
      if (!(await isServiceEnabled(data.restaurantId))) {
        return socket.emit('subscription_blocked', { restaurantId: data.restaurantId })
      }
      const order = await updateOrder(data.restaurantId, data.id, { status: 'ready' })
      io.to(order.restaurantId).emit('status_changed', order)
      await emitStats(io, order.restaurantId)
    })

    staffHandler(socket, 'item_status', async (data) => {
      if (!(await isServiceEnabled(data.restaurantId))) {
        return socket.emit('subscription_blocked', { restaurantId: data.restaurantId })
      }
      const order = await updateOrderItemStatus(
        data.restaurantId,
        data.orderId,
        data.itemKey,
        data.status
      )
      io.to(order.restaurantId).emit('status_changed', order)
      await emitStats(io, order.restaurantId)
    })

    // Receptionist cancels — removed from chef + receptionist screens
    staffHandler(socket, 'cancel_order', async (data) => {
      const { restaurantId, orderId, reason } = data
      if (!orderId) return
      await cancelOrder(restaurantId, orderId, reason)
      io.to(restaurantId).emit('order_cancelled', { orderId, restaurantId, reason })
      await emitStats(io, restaurantId)
      console.log(`Order cancelled: ${orderId} reason: ${reason || 'none'}`)
    })

    staffHandler(socket, 'chef_message', async (data) => {
      if (!(await isServiceEnabled(data.restaurantId))) {
        return socket.emit('subscription_blocked', { restaurantId: data.restaurantId })
      }
      io.to(data.restaurantId).emit('chef_message_received', {
        restaurantId: data.restaurantId,
        orderId: data.orderId,
        tableId: data.tableId,
        tableNumber: data.tableNumber,
        message: data.message,
        createdAt: new Date().toISOString(),
      })
    })

    staffHandler(socket, 'close_bill', async (data) => {
      if (!(await isServiceEnabled(data.restaurantId))) {
        return socket.emit('subscription_blocked', { restaurantId: data.restaurantId })
      }
      const result = await closeBill(data.restaurantId, data.tableNumber, data.orderIds, data.settlement)
      io.to(data.restaurantId).emit('bill_closed', result)
      await emitStats(io, data.restaurantId)
    })

    // Customers (anonymous) can call a waiter — throttled so a table can't spam the desk
    socket.on('call_waiter', async (data) => {
      try {
        if (!data?.restaurantId || !data?.tableId) return
        const now = Date.now()
        if (now - lastWaiterCall < WAITER_CALL_COOLDOWN_MS) return
        lastWaiterCall = now
        if (!(await isServiceEnabled(data.restaurantId))) {
          return socket.emit('subscription_blocked', { restaurantId: data.restaurantId })
        }
        io.to(data.restaurantId).emit('waiter_called', {
          restaurantId: data.restaurantId,
          tableId: data.tableId,
          tableNumber: data.tableNumber ?? data.tableId,
          calledAt: new Date().toISOString(),
        })
      } catch (err) {
        console.error('call_waiter error:', err)
      }
    })
  })
}

module.exports = { initOrderSocket, broadcastNewOrder }
