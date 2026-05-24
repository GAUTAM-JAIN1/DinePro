const {
  updateOrder,
  updateOrderItemStatus,
  closeBill,
  getDailyStats,
  cancelOrder,
} = require('../services/orderService')
const { getRestaurant } = require('../services/restaurantService')

async function isServiceEnabled(restaurantId) {
  const restaurant = await getRestaurant(restaurantId)
  return restaurant?.subscription?.isServiceEnabled === true
}

async function emitStats(io, restaurantId) {
  const stats = await getDailyStats(restaurantId)
  io.to(restaurantId).emit('stats_update', stats)
}

function initOrderSocket(io) {
  io.on('connection', (socket) => {
    console.log('New connection:', socket.id)

    socket.on('join_restaurant', async (restaurantId) => {
      socket.join(restaurantId)
      console.log(`Socket ${socket.id} joined: ${restaurantId}`)
      const stats = await getDailyStats(restaurantId)
      socket.emit('stats_update', stats)
    })

    socket.on('new_order', (order) => {
      if (!order.restaurantId) return
      const isUpdate = order.isUpdate === true
      if (isUpdate) {
        io.to(order.restaurantId).emit('order_updated', order)
      } else {
        io.to(order.restaurantId).emit('order_received', order)
      }
      io.to(order.restaurantId).emit('bill_update', order)
      emitStats(io, order.restaurantId)
    })

    socket.on('order_preparing', async (orderData) => {
      try {
        if (!(await isServiceEnabled(orderData.restaurantId))) {
          return socket.emit('subscription_blocked', { restaurantId: orderData.restaurantId })
        }
        const order = await updateOrder(orderData.restaurantId, orderData.id, { status: 'preparing' })
        io.to(order.restaurantId).emit('status_changed', order)
        await emitStats(io, order.restaurantId)
      } catch (err) {
        console.error('order_preparing error:', err)
      }
    })

    socket.on('order_ready', async (orderData) => {
      try {
        if (!(await isServiceEnabled(orderData.restaurantId))) {
          return socket.emit('subscription_blocked', { restaurantId: orderData.restaurantId })
        }
        const order = await updateOrder(orderData.restaurantId, orderData.id, { status: 'ready' })
        io.to(order.restaurantId).emit('status_changed', order)
        await emitStats(io, order.restaurantId)
      } catch (err) {
        console.error('order_ready error:', err)
      }
    })

    socket.on('item_status', async (data) => {
      try {
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
      } catch (err) {
        console.error('item_status error:', err)
      }
    })

    // Cancel order — receptionist cancels, chef panel se bhi hata do
    socket.on('cancel_order', async (data) => {
      try {
        const { restaurantId, orderId, reason } = data
        if (!restaurantId || !orderId) return

        await cancelOrder(restaurantId, orderId, reason)

        // Broadcast to all panels — chef + receptionist dono se hatega
        io.to(restaurantId).emit('order_cancelled', { orderId, restaurantId, reason })
        await emitStats(io, restaurantId)
        console.log(`Order cancelled: ${orderId} reason: ${reason || 'none'}`)
      } catch (err) {
        console.error('cancel_order error:', err)
        socket.emit('cancel_order_error', { error: err.message })
      }
    })

    socket.on('chef_message', async (data) => {
      try {
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
      } catch (err) {
        console.error('chef_message error:', err)
      }
    })

    socket.on('close_bill', async (data) => {
      try {
        if (!(await isServiceEnabled(data.restaurantId))) {
          return socket.emit('subscription_blocked', { restaurantId: data.restaurantId })
        }
        const result = await closeBill(data.restaurantId, data.tableNumber, data.orderIds, data.settlement)
        io.to(data.restaurantId).emit('bill_closed', result)
        await emitStats(io, data.restaurantId)
      } catch (err) {
        console.error('close_bill error:', err)
      }
    })

    socket.on('call_waiter', async (data) => {
      try {
        if (!data.restaurantId || !data.tableId) return
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

    socket.on('disconnect', () => {
      console.log('Disconnected:', socket.id)
    })
  })
}

module.exports = { initOrderSocket }