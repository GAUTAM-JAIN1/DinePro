const {
  updateOrder,
  updateOrderItemStatus,
  closeBill,
  getDailyStats,
  cancelOrder,
} = require('../services/orderService')
const { getRestaurant } = require('../services/restaurantService')
const { getTableByIdentifier } = require('../services/tableService')
const { auth } = require('../services/firebaseAdmin')
const { actorFromUser } = require('../services/auditService')
const { createWindowLimiter } = require('../utils/windowLimiter')
const {
  parseOrThrow,
  closeBillEvent,
  cancelOrderEvent,
  orderIdEvent,
  itemStatusEvent,
  chefMessageEvent,
} = require('../middleware/validators')

// Which staff roles may trigger which socket event
const EVENT_ROLES = {
  order_preparing: ['chef', 'receptionist', 'admin'],
  order_ready: ['chef', 'receptionist', 'admin'],
  item_status: ['chef', 'receptionist', 'admin'],
  chef_message: ['chef', 'admin'],
  cancel_order: ['receptionist', 'admin'],
  close_bill: ['receptionist', 'admin'],
}

// ─────────────────────────── Flood limits (Bug #80) ───────────────────────────
// Every event gets a per-socket limit and a per-IP limit. The IP limit is four
// times looser on purpose: staff tablets and customer phones often share one
// restaurant wifi address, and the per-socket limit is what stops one device.
const ONE_MINUTE = 60 * 1000
const EVENT_LIMITS = {
  join_restaurant: { max: 10, windowMs: ONE_MINUTE },
  join_table: { max: 30, windowMs: ONE_MINUTE },
  call_waiter: { max: 6, windowMs: ONE_MINUTE },
  order_preparing: { max: 120, windowMs: ONE_MINUTE },
  order_ready: { max: 120, windowMs: ONE_MINUTE },
  item_status: { max: 240, windowMs: ONE_MINUTE },
  cancel_order: { max: 30, windowMs: ONE_MINUTE },
  chef_message: { max: 30, windowMs: ONE_MINUTE },
  close_bill: { max: 30, windowMs: ONE_MINUTE },
}
const socketLimiters = {}
const ipLimiters = {}
for (const [event, cfg] of Object.entries(EVENT_LIMITS)) {
  socketLimiters[event] = createWindowLimiter(cfg)
  ipLimiters[event] = createWindowLimiter({ max: cfg.max * 4, windowMs: cfg.windowMs })
}

/** True while this socket and this IP are both under the limit for `event`. */
function allowEvent(socket, event) {
  if (!socketLimiters[event]) return true
  const bySocket = socketLimiters[event](socket.id)
  const byIp = ipLimiters[event](socket.data.ip || socket.id)
  return bySocket && byIp
}

// Customers at a table still get the table-scoped waiter cooldowns from bug #21.
const WAITER_CALL_COOLDOWN_MS = 10 * 1000
const WAITER_CALL_IP_COOLDOWN_MS = 10 * 1000
const recentWaiterCallsByIp = new Map()

function pruneWaiterCallMap() {
  const cutoff = Date.now() - WAITER_CALL_IP_COOLDOWN_MS
  for (const [key, ts] of recentWaiterCallsByIp) {
    if (ts < cutoff) recentWaiterCallsByIp.delete(key)
  }
}

// ─────────────────────────── Rooms ───────────────────────────
// Bug #2: the restaurant-wide room carries receptionist/chef-only data —
// every order, every table's bill, daily revenue stats. Staff join it by
// restaurantId (verified below). Customers only ever get a room scoped to
// their own table, so they can never see another table's orders, the
// restaurant's bill stream, or its stats.
const staffRoom = (restaurantId) => `staff:${restaurantId}`
const tableRoom = (restaurantId, tableId) => `table:${restaurantId}:${tableId}`

// ─────────────────────────── Subscription cache (join/event reads) ───────────────────────────
// Every staff event used to read the restaurant document. A short cache keeps
// the read cost flat under a burst. A suspension can take up to this long to
// reach open kitchen screens, which is an accepted trade-off.
const SUBSCRIPTION_CACHE_MS = 15 * 1000
const subscriptionCache = new Map()

async function isServiceEnabled(restaurantId) {
  const now = Date.now()
  const hit = subscriptionCache.get(restaurantId)
  if (hit && now - hit.at < SUBSCRIPTION_CACHE_MS) return hit.enabled

  const restaurant = await getRestaurant(restaurantId)
  const enabled = restaurant?.subscription?.isServiceEnabled === true
  subscriptionCache.set(restaurantId, { enabled, at: now })
  if (subscriptionCache.size > 5000) {
    for (const [key, value] of subscriptionCache) {
      if (now - value.at >= SUBSCRIPTION_CACHE_MS) subscriptionCache.delete(key)
    }
  }
  return enabled
}

async function emitStats(io, restaurantId) {
  const stats = await getDailyStats(restaurantId)
  io.to(staffRoom(restaurantId)).emit('stats_update', stats)
}

function isPlatformAdmin(user) {
  return user?.role === 'superadmin' || user?.platformAdmin === true || user?.superAdmin === true
}

// ─────────────────────────── Staff identity (Bug #12) ───────────────────────────
// A staff socket used to keep the identity from its handshake for as long as it
// stayed connected, even after the account was deactivated. Now the account is
// re-read from Firebase at most every STAFF_RECHECK_MS when an event arrives,
// and on a background sweep, so a deactivated member loses access within a minute.
const STAFF_RECHECK_MS = 10 * 1000
const STAFF_SWEEP_MS = 60 * 1000

function socketUserFromRecord(record) {
  return { ...(record.customClaims || {}), uid: record.uid, email: record.email || null }
}

function dropStaffSession(socket, reason) {
  socket.data.user = null
  socket.emit('session_ended', { reason })
  socket.disconnect(true)
}

/** The current staff identity for this socket, or null. Null means "refuse this event". */
async function currentStaffUser(socket) {
  if (!socket.data.user) return null

  const now = Date.now()
  if (socket.data.checkedAt && now - socket.data.checkedAt < STAFF_RECHECK_MS) {
    return socket.data.user
  }

  try {
    const record = await auth.getUser(socket.data.user.uid)
    if (record.disabled) {
      dropStaffSession(socket, 'account_disabled')
      return null
    }
    socket.data.user = socketUserFromRecord(record)
    socket.data.checkedAt = now
    return socket.data.user
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      dropStaffSession(socket, 'account_removed')
      return null
    }
    // A transient lookup failure refuses this one event and keeps the connection.
    console.error('staff recheck failed:', err.code || err.message)
    return null
  }
}

/** True only if the verified staff user may run `event` for this restaurant. */
function canAct(user, event, restaurantId) {
  if (!user || !restaurantId) return false
  if (isPlatformAdmin(user)) return true
  if (!EVENT_ROLES[event]?.includes(user.role)) return false
  return Boolean(user.restaurantId) && String(user.restaurantId) === String(restaurantId)
}

/** Acknowledgement for a staff event: the client rolls back its optimistic change when ok is false (Bug #23). */
function reply(ack, payload) {
  if (typeof ack === 'function') ack(payload)
}

/** Sent back to the staff screen when the restaurant's subscription is inactive. */
function subscriptionBlocked(socket, restaurantId) {
  socket.emit('subscription_blocked', { restaurantId })
  return { ok: false, error: 'Subscription is not active', statusCode: 402 }
}

/**
 * Wrap a staff-only handler: rate limit, authorisation and error handling in one place.
 * Failures go back to the sender as `<event>_error` ({ error, statusCode, ...extra }),
 * so the screen can show the reason and re-sync instead of failing silently (Bug #41, #9, #40).
 * Every call also gets an ack: { ok: true } or { ok: false, error, statusCode, ... } (Bug #23).
 * The handler receives (data, user) where `user` is the freshly checked identity.
 */
function staffHandler(socket, event, handler) {
  socket.on(event, async (data, ack) => {
    try {
      if (!allowEvent(socket, event)) {
        socket.emit('rate_limited', { event })
        return reply(ack, { ok: false, error: 'Too many events. Slow down.', statusCode: 429 })
      }
      const restaurantId = data?.restaurantId
      const user = await currentStaffUser(socket)
      if (!canAct(user, event, restaurantId)) {
        socket.emit('unauthorized', { event, restaurantId })
        return reply(ack, { ok: false, error: 'Not allowed for this restaurant', statusCode: 403 })
      }
      const result = await handler(data, user)
      reply(ack, result && result.ok === false ? result : { ok: true })
    } catch (err) {
      console.error(`${event} error:`, err.message)
      const failure = {
        error: err.statusCode ? err.message : 'Something went wrong. Please try again.',
        statusCode: err.statusCode || 500,
        ...(err.extra || {}),
      }
      socket.emit(`${event}_error`, failure)
      reply(ack, { ok: false, ...failure })
    }
  })
}

/** Staff-room broadcast plus, when the order has a table, that table's customer room. */
function broadcastOrderUpdate(io, event, order) {
  if (!order?.restaurantId) return
  io.to(staffRoom(order.restaurantId)).emit(event, order)
  if (order.tableId) {
    io.to(tableRoom(order.restaurantId, order.tableId)).emit(event, order)
  }
}

/**
 * Called by POST /api/orders after the order is saved.
 * The server (not the customer's browser) announces new orders.
 * Staff-only: order_received/order_updated/bill_update expose every table's
 * orders and running bill, so only the restaurant's staff room gets them.
 */
async function broadcastNewOrder(io, order) {
  if (!order?.restaurantId) return
  const isUpdate = Array.isArray(order.items) && order.items.length > (order.newItems?.length || 0)
  const payload = { ...order, isUpdate }
  io.to(staffRoom(order.restaurantId)).emit(isUpdate ? 'order_updated' : 'order_received', payload)
  io.to(staffRoom(order.restaurantId)).emit('bill_update', payload)
  await emitStats(io, order.restaurantId)
}

function clientIpFrom(socket) {
  // Raw remote address behind Render's proxy — socket.io doesn't honour
  // Express's `trust proxy`, so read the forwarded header directly.
  return (socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '')
    .toString()
    .split(',')[0]
    .trim()
}

function initOrderSocket(io) {
  // Optional authentication: staff send their Firebase ID token in the handshake,
  // customers connect anonymously. Staff-only events below require a verified token.
  // checkRevoked (Bug #12) rejects disabled accounts and revoked sessions at connect time.
  io.use(async (socket, next) => {
    socket.data.ip = clientIpFrom(socket)
    const token = socket.handshake.auth?.token
    if (token) {
      try {
        socket.data.user = await auth.verifyIdToken(token, true)
        socket.data.checkedAt = Date.now()
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

    // Background re-check for staff sockets: a deactivated member is dropped
    // even if they never send another event.
    const sweep = setInterval(() => {
      if (socket.data.user) currentStaffUser(socket).catch(() => {})
    }, STAFF_SWEEP_MS)
    socket.on('disconnect', () => clearInterval(sweep))

    // Staff (receptionist/chef/admin/platform admin): join the restaurant's
    // full staff room. Requires a verified token already scoped to this
    // restaurant — anonymous or mismatched-tenant sockets are refused.
    socket.on('join_restaurant', async (restaurantId) => {
      try {
        if (typeof restaurantId !== 'string' || !restaurantId) return
        if (!allowEvent(socket, 'join_restaurant')) {
          return socket.emit('rate_limited', { event: 'join_restaurant' })
        }
        const user = await currentStaffUser(socket)
        const authorised = user && (
          isPlatformAdmin(user) || String(user.restaurantId) === String(restaurantId)
        )
        if (!authorised) {
          return socket.emit('unauthorized', { event: 'join_restaurant', restaurantId })
        }
        socket.join(staffRoom(restaurantId))
        const stats = await getDailyStats(restaurantId)
        socket.emit('stats_update', stats)
      } catch (err) {
        console.error('join_restaurant error:', err.message)
      }
    })

    // Customers (anonymous): join only their own table's room, after
    // confirming the table actually exists and is active. No restaurant-wide
    // data (bills, stats, other tables' orders) ever reaches this room.
    socket.on('join_table', async ({ restaurantId, tableId } = {}) => {
      try {
        if (typeof restaurantId !== 'string' || !restaurantId) return
        if (typeof tableId !== 'string' || !tableId) return
        if (!allowEvent(socket, 'join_table')) return
        const table = await getTableByIdentifier(restaurantId, tableId)
        if (!table || table.isActive === false) return
        // Orders are stored under the table's doc id, so join that room even
        // when the QR link carried the human table number.
        socket.join(tableRoom(restaurantId, table.id))
      } catch (err) {
        console.error('join_table error:', err.message)
      }
    })

    staffHandler(socket, 'order_preparing', async (data) => {
      const { restaurantId, id } = parseOrThrow(orderIdEvent, data)
      if (!(await isServiceEnabled(restaurantId))) {
        return subscriptionBlocked(socket, restaurantId)
      }
      const order = await updateOrder(restaurantId, id, { status: 'preparing' })
      broadcastOrderUpdate(io, 'status_changed', order)
      await emitStats(io, order.restaurantId)
    })

    staffHandler(socket, 'order_ready', async (data) => {
      const { restaurantId, id } = parseOrThrow(orderIdEvent, data)
      if (!(await isServiceEnabled(restaurantId))) {
        return subscriptionBlocked(socket, restaurantId)
      }
      const order = await updateOrder(restaurantId, id, { status: 'ready' })
      broadcastOrderUpdate(io, 'status_changed', order)
      await emitStats(io, order.restaurantId)
    })

    // Bug #20: the payload is validated, so only preparing / ready / served get through.
    staffHandler(socket, 'item_status', async (data) => {
      const payload = parseOrThrow(itemStatusEvent, data)
      if (!(await isServiceEnabled(payload.restaurantId))) {
        return subscriptionBlocked(socket, payload.restaurantId)
      }
      const order = await updateOrderItemStatus(
        payload.restaurantId,
        payload.orderId,
        payload.itemKey,
        payload.status
      )
      broadcastOrderUpdate(io, 'status_changed', order)
      await emitStats(io, order.restaurantId)
    })

    // Receptionist cancels ONE order — removed from chef + receptionist screens (Bug #41)
    // Bug #37: subscription is checked on this mutation too.
    staffHandler(socket, 'cancel_order', async (data, user) => {
      const { restaurantId, orderId, reason } = parseOrThrow(cancelOrderEvent, data)
      if (!(await isServiceEnabled(restaurantId))) {
        return subscriptionBlocked(socket, restaurantId)
      }
      await cancelOrder(restaurantId, orderId, {
        reason,
        actor: actorFromUser(user),
      })
      io.to(staffRoom(restaurantId)).emit('order_cancelled', { orderId, restaurantId, reason })
      await emitStats(io, restaurantId)
      console.log(`Order cancelled: ${orderId} by ${user?.email || 'unknown'}`)
    })

    staffHandler(socket, 'chef_message', async (data) => {
      const payload = parseOrThrow(chefMessageEvent, data)
      if (!(await isServiceEnabled(payload.restaurantId))) {
        return subscriptionBlocked(socket, payload.restaurantId)
      }
      const message = {
        restaurantId: payload.restaurantId,
        orderId: payload.orderId,
        tableId: payload.tableId,
        tableNumber: payload.tableNumber,
        message: payload.message,
        createdAt: new Date().toISOString(),
      }
      io.to(staffRoom(payload.restaurantId)).emit('chef_message_received', message)
      if (payload.tableId) {
        io.to(tableRoom(payload.restaurantId, payload.tableId)).emit('chef_message_received', message)
      }
    })

    staffHandler(socket, 'close_bill', async (data, user) => {
      const payload = parseOrThrow(closeBillEvent, data)
      if (!(await isServiceEnabled(payload.restaurantId))) {
        return subscriptionBlocked(socket, payload.restaurantId)
      }
      const result = await closeBill(payload.restaurantId, {
        orderIds: payload.orderIds,
        settlement: payload.settlement,
        actor: actorFromUser(user),
        isAdmin: isPlatformAdmin(user) || user.role === 'admin',
      })

      // Staff get the full settlement. Customers at the table only learn that
      // their order is closed, not the internal bill breakdown.
      io.to(staffRoom(payload.restaurantId)).emit('bill_closed', result)
      const customerNotice = {
        restaurantId: payload.restaurantId,
        tableId: result.tableId,
        tableNumber: result.tableNumber,
        orderIds: result.orderIds,
        closedAt: result.closedAt,
      }
      for (const tableId of result.tableIds || []) {
        io.to(tableRoom(payload.restaurantId, tableId)).emit('bill_closed', customerNotice)
      }
      await emitStats(io, payload.restaurantId)
    })

    // Customers (anonymous) can call a waiter — throttled per-socket AND
    // per-IP+table so reconnecting doesn't reset the cooldown (bug #21).
    socket.on('call_waiter', async (data) => {
      try {
        if (!data?.restaurantId || !data?.tableId) return
        if (typeof data.restaurantId !== 'string' || typeof data.tableId !== 'string') return
        if (!allowEvent(socket, 'call_waiter')) return

        const table = await getTableByIdentifier(data.restaurantId, data.tableId)
        if (!table || table.isActive === false) return

        const now = Date.now()
        if (now - lastWaiterCall < WAITER_CALL_COOLDOWN_MS) return

        const ipKey = `${socket.data.ip}:${data.restaurantId}:${data.tableId}`
        const lastIpCall = recentWaiterCallsByIp.get(ipKey) || 0
        if (now - lastIpCall < WAITER_CALL_IP_COOLDOWN_MS) return

        lastWaiterCall = now
        recentWaiterCallsByIp.set(ipKey, now)
        if (recentWaiterCallsByIp.size > 10000) pruneWaiterCallMap()

        if (!(await isServiceEnabled(data.restaurantId))) {
          return subscriptionBlocked(socket, data.restaurantId)
        }
        io.to(staffRoom(data.restaurantId)).emit('waiter_called', {
          restaurantId: data.restaurantId,
          tableId: data.tableId,
          tableNumber: table.tableNumber ?? table.id,
          calledAt: new Date().toISOString(),
        })
      } catch (err) {
        console.error('call_waiter error:', err)
      }
    })
  })
}

module.exports = { initOrderSocket, broadcastNewOrder, canAct, allowEvent }
