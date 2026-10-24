const { db } = require('./firebaseAdmin')
const { getTableByIdentifier } = require('./tableService')
const { dayKeyFor, hourFor, dayBounds, resolveTimezone } = require('./dayKey')
const { writeAuditInTransaction, writeAudit } = require('./auditService')
const {
  HttpError,
  OPEN_STATUSES,
  MERGEABLE_STATUSES,
  toPaise,
  toRupees,
  newLineId,
  orderSubtotalPaise,
  resolveOrderLines,
  computeSettlement,
  toSettlementRecord,
  assertDiscountAllowed,
  assertExpectedTotal,
  allocatePayable,
  formatInvoiceNumber,
} = require('./billing')

const restaurantRef = (restaurantId) => db.collection('restaurants').doc(restaurantId)
const orderCol = (restaurantId) => restaurantRef(restaurantId).collection('orders')
const menuCol = (restaurantId) => restaurantRef(restaurantId).collection('menu')
const tableCol = (restaurantId) => restaurantRef(restaurantId).collection('tables')
const orderKeyCol = (restaurantId) => restaurantRef(restaurantId).collection('orderKeys')

// Idempotency records only need to outlive a client's retry window. Add a
// Firestore TTL policy on orderKeys.expiresAt to delete them automatically.
const ORDER_KEY_TTL_MS = 2 * 24 * 60 * 60 * 1000

const fromDoc = (doc) => ({ id: doc.id, ...doc.data() })

const actorLabel = (actor) => actor?.email || actor?.uid || 'system'

const calcTotal = (items) => toRupees(orderSubtotalPaise({ items }))

const normalizeItems = (items = [], fallbackStatus = 'new') =>
  items.map((item) => ({
    ...item,
    specialInstructions: item.specialInstructions || item.instructions || '',
    lineId: item.lineId || newLineId(),
    status: item.status || fallbackStatus,
  }))

const deriveOrderStatus = (items = []) => {
  const statuses = items.map((item) => item.status || 'new')
  if (statuses.length === 0) return 'new'
  if (statuses.every((status) => status === 'served')) return 'served'
  if (statuses.every((status) => status === 'ready' || status === 'served')) return 'ready'
  if (statuses.some((status) => status === 'preparing' || status === 'ready' || status === 'served')) {
    return 'preparing'
  }
  return 'new'
}

const normalizeMenuDoc = (snap) => {
  const data = snap.data()
  return {
    id: snap.id,
    ...data,
    isAvailable: data.isAvailable ?? data.available ?? true,
  }
}

/**
 * Customer places or adds to an order.
 *
 * Everything that decides money happens in ONE Firestore transaction:
 *   - the table must exist and be active                       (Bug #11)
 *   - prices and availability come from the menu, read here    (Bug #1, #11)
 *   - the open bill for the table is found and merged into     (Bug #6, #7)
 *   - a retry with the same idempotencyKey returns the first result (Bug #51, #38)
 *
 * Writing the table doc in every transaction makes two simultaneous orders for
 * the same table conflict, so the second one retries and sees the first bill.
 * That is what closes the "two open bills" race (Bug #6).
 *
 * Returns { order, replayed }. replayed=true means this key was already used,
 * so nothing new was written and the caller must not broadcast it again.
 */
async function upsertOrder(restaurantId, { tableId, items, specialInstructions = '', idempotencyKey }) {
  const table = await getTableByIdentifier(restaurantId, tableId)
  if (!table) throw new HttpError(404, 'Table not found', { code: 'TABLE_NOT_FOUND' })
  if (table.isActive === false) throw new HttpError(403, 'Table is inactive', { code: 'TABLE_INACTIVE' })

  const canonicalTableId = table.id
  const keyRef = orderKeyCol(restaurantId).doc(idempotencyKey)
  const tableRef = tableCol(restaurantId).doc(canonicalTableId)
  const openBillsQuery = orderCol(restaurantId)
    .where('tableId', '==', canonicalTableId)
    .where('status', '!=', 'closed')
  const menuIds = [...new Set(items.map((item) => item.id))]

  return db.runTransaction(async (tx) => {
    // ---- reads: all of them come before any write ----
    const keySnap = await tx.get(keyRef)
    if (keySnap.exists) {
      const previous = await tx.get(orderCol(restaurantId).doc(keySnap.data().orderId))
      if (previous.exists) return { order: fromDoc(previous), replayed: true }
    }

    const tableSnap = await tx.get(tableRef)
    if (!tableSnap.exists || tableSnap.data().isActive === false) {
      throw new HttpError(403, 'Table is not accepting orders right now', { code: 'TABLE_INACTIVE' })
    }

    const menuSnaps = await Promise.all(menuIds.map((id) => tx.get(menuCol(restaurantId).doc(id))))
    const menuById = new Map(
      menuSnaps.filter((snap) => snap.exists).map((snap) => [snap.id, normalizeMenuDoc(snap)])
    )

    const openSnap = await tx.get(openBillsQuery)
    const openOrders = openSnap.docs.map(fromDoc).filter((order) => OPEN_STATUSES.includes(order.status))

    // ---- compute: may throw, no writes yet ----
    const now = new Date().toISOString()
    const lines = resolveOrderLines(items, menuById)
    const tableNumber = String(tableSnap.data().tableNumber ?? table.tableNumber ?? canonicalTableId)
    const target = openOrders.find((order) => MERGEABLE_STATUSES.includes(order.status))

    if (target) {
      const mergedItems = [...normalizeItems(target.items, target.status || 'new'), ...lines]
      const updates = {
        items: mergedItems,
        newItems: lines,
        totalAmount: calcTotal(mergedItems),
        status: 'new',
        updatedAt: now,
      }
      if (specialInstructions) updates.specialInstructions = specialInstructions

      tx.update(orderCol(restaurantId).doc(target.id), updates)
      tx.update(tableRef, { updatedAt: now })
      tx.set(keyRef, { orderId: target.id, createdAt: now, expiresAt: new Date(Date.now() + ORDER_KEY_TTL_MS).toISOString() })
      return { order: { ...target, ...updates, id: target.id }, replayed: false }
    }

    const newRef = orderCol(restaurantId).doc()
    const order = {
      restaurantId,
      tableId: canonicalTableId,
      tableNumber,
      items: lines,
      newItems: lines,
      specialInstructions,
      totalAmount: calcTotal(lines),
      status: 'new',
      createdAt: now,
      updatedAt: now,
    }
    tx.set(newRef, order)
    tx.update(tableRef, { updatedAt: now })
    tx.set(keyRef, { orderId: newRef.id, createdAt: now, expiresAt: new Date(Date.now() + ORDER_KEY_TTL_MS).toISOString() })
    return { order: { id: newRef.id, ...order }, replayed: false }
  })
}

// Bug #49: a whole-order command only moves items that are still behind it.
// "Mark preparing" must not drag a ready item back to preparing.
const STATUS_SOURCES = {
  preparing: ['new', 'preparing'],
  ready: ['new', 'preparing'],
  served: ['new', 'preparing', 'ready'],
}

function applyOrderStatus(items, target) {
  const sources = STATUS_SOURCES[target]
  return items.map((item) => (sources.includes(item.status || 'new') ? { ...item, status: target } : item))
}

/** Kitchen status change for a whole order (preparing / ready / served). */
async function updateOrder(restaurantId, orderId, updates) {
  const ref = orderCol(restaurantId).doc(orderId)

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new HttpError(404, 'Order not found', { code: 'ORDER_NOT_FOUND' })
    const existing = snap.data()
    const now = new Date().toISOString()
    const data = { ...updates, updatedAt: now }

    if (updates.status === 'preparing' || updates.status === 'ready' || updates.status === 'served') {
      data.items = applyOrderStatus(normalizeItems(existing.items, existing.status || 'new'), updates.status)
      data.newItems = applyOrderStatus(normalizeItems(existing.newItems || [], existing.status || 'new'), updates.status)
      // The order's status follows its items, so it can't say "preparing" while every item is ready.
      data.status = deriveOrderStatus(data.items)
    }

    if (updates.status === 'ready') data.completedAt = now
    if (updates.status === 'served') data.servedAt = now
    if (updates.status === 'closed') data.closedAt = now

    tx.update(ref, data)
    return { id: orderId, ...existing, ...data }
  })
}

/** Kitchen status change for one line item. Transactional so it cannot wipe items added at the same moment (Bug #7). */
async function updateOrderItemStatus(restaurantId, orderId, itemKey, status) {
  const ref = orderCol(restaurantId).doc(orderId)

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new HttpError(404, 'Order not found', { code: 'ORDER_NOT_FOUND' })

    const existing = snap.data()
    const matchesItem = (item) => item.lineId === itemKey || item.id === itemKey
    const items = normalizeItems(existing.items, existing.status || 'new').map((item) =>
      matchesItem(item) ? { ...item, status } : item
    )
    const newItems = normalizeItems(existing.newItems || [], existing.status || 'new').map((item) =>
      matchesItem(item) ? { ...item, status } : item
    )
    const orderStatus = deriveOrderStatus(items)
    const now = new Date().toISOString()
    const updates = { items, newItems, status: orderStatus, updatedAt: now }

    if (orderStatus === 'ready') updates.completedAt = now
    if (orderStatus === 'served') updates.servedAt = now

    tx.update(ref, updates)
    return { id: orderId, ...existing, ...updates }
  })
}

/** Open orders for the staff screens. Cancelled orders are never listed (Bug #8). */
const getRestaurantOrders = async (restaurantId) => {
  const snap = await orderCol(restaurantId)
    .where('status', '!=', 'closed')
    .orderBy('status')
    .orderBy('createdAt', 'desc')
    .get()
  return snap.docs.map(fromDoc).filter((order) => order.status !== 'cancelled')
}

/**
 * Settles the bill for the given orders. Server-authoritative (Bug #9, #40, #43, #44):
 *   - GST and service charge come from restaurant settings
 *   - discounts above the receptionist cap need an admin actor
 *   - the cashier's expectedPayableAmount must match what the server computes
 *   - the order set must be the table's full set of open orders, so an order
 *     that arrived while the bill was open is not settled unseen and does not
 *     stay open afterwards
 *   - closed or cancelled orders can't be settled again
 *   - the invoice number comes from a per-restaurant counter, not the client
 */
async function closeBill(restaurantId, { orderIds, settlement: input = {}, actor = null, isAdmin = false }) {
  const ids = [...new Set(orderIds || [])]
  if (ids.length === 0) throw new HttpError(400, 'orderIds is required', { code: 'NO_ORDERS' })

  const now = new Date().toISOString()
  const rRef = restaurantRef(restaurantId)
  const counterRef = rRef.collection('counters').doc('invoices')

  return db.runTransaction(async (tx) => {
    // ---- reads ----
    const restSnap = await tx.get(rRef)
    if (!restSnap.exists) throw new HttpError(404, 'Restaurant not found', { code: 'RESTAURANT_NOT_FOUND' })
    const restaurant = restSnap.data()

    const orderSnaps = await Promise.all(ids.map((id) => tx.get(orderCol(restaurantId).doc(id))))
    const orders = orderSnaps.map((snap, index) => {
      if (!snap.exists) throw new HttpError(404, `Order not found: ${ids[index]}`, { code: 'ORDER_NOT_FOUND' })
      return fromDoc(snap)
    })

    for (const order of orders) {
      if (order.status === 'closed') {
        throw new HttpError(409, `Order ${order.id} is already settled`, { code: 'ALREADY_SETTLED', orderId: order.id })
      }
      if (order.status === 'cancelled') {
        throw new HttpError(409, `Order ${order.id} was cancelled. Refresh the bill.`, { code: 'ORDER_CANCELLED', orderId: order.id })
      }
    }

    const tableIds = [...new Set(orders.map((order) => order.tableId).filter(Boolean))]
    if (tableIds.length !== 1) {
      throw new HttpError(400, 'One settlement can only cover orders from a single table', { code: 'MIXED_TABLES' })
    }
    const tableId = tableIds[0]

    const tableRef = tableCol(restaurantId).doc(tableId)
    const tableSnap = await tx.get(tableRef)
    const openSnap = await tx.get(
      orderCol(restaurantId).where('tableId', '==', tableId).where('status', '!=', 'closed')
    )
    const counterSnap = await tx.get(counterRef)

    // ---- checks ----
    const idSet = new Set(ids)
    const newerOpenOrders = openSnap.docs.filter(
      (doc) => OPEN_STATUSES.includes(doc.data().status) && !idSet.has(doc.id)
    )
    if (newerOpenOrders.length > 0) {
      throw new HttpError(
        409,
        'New order(s) came in for this table after the bill was opened. Refresh and settle again.',
        { code: 'ORDERS_CHANGED', extraOrderIds: newerOpenOrders.map((doc) => doc.id) }
      )
    }

    const subtotalPaise = orders.reduce((sum, order) => sum + orderSubtotalPaise(order), 0)
    const discountPaise = toPaise(input.discountAmount)
    assertDiscountAllowed({ subtotalPaise, discountPaise, isAdmin })

    const computed = computeSettlement({
      subtotalPaise,
      discountPaise,
      serviceChargePaise: toPaise(restaurant.defaultServiceCharge),
      gstPercent: Number(restaurant.defaultGstPercent) || 0,
    })
    assertExpectedTotal(input.expectedPayableAmount, computed.payablePaise)

    // ---- writes ----
    const lastSeq = counterSnap.exists ? Number(counterSnap.data().lastSeq) || 0 : 0
    const seq = lastSeq + 1
    const year = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date(now)))
    const invoiceNumber = formatInvoiceNumber(year, seq)

    const settlementRecord = toSettlementRecord(computed, {
      paymentMode: input.paymentMode || 'cash',
      paymentReference: String(input.paymentReference || '').trim(),
      notes: String(input.notes || '').trim(),
      invoiceNumber,
    })

    const allocations = new Map(
      allocatePayable(
        orders.map((order) => ({ id: order.id, subtotalPaise: orderSubtotalPaise(order) })),
        computed.payablePaise
      ).map((allocation) => [allocation.id, allocation.settledPaise])
    )

    tx.set(counterRef, { lastSeq: seq, updatedAt: now }, { merge: true })

    for (const order of orders) {
      const settledAmount = toRupees(allocations.get(order.id))
      tx.update(orderCol(restaurantId).doc(order.id), {
        status: 'closed',
        closedAt: now,
        updatedAt: now,
        closedBy: actorLabel(actor),
        invoiceNumber,
        settledAmount,
        settlement: {
          ...settlementRecord,
          orderSubtotal: toRupees(orderSubtotalPaise(order)),
          settledAmount,
        },
      })
    }

    // Touching the table doc here makes a concurrent upsertOrder for this
    // table conflict with this settlement, so one of them retries.
    if (tableSnap.exists) tx.update(tableRef, { updatedAt: now })

    writeAuditInTransaction(tx, restaurantId, {
      actor,
      action: 'bill.settle',
      after: {
        invoiceNumber,
        tableId,
        orderIds: ids,
        subtotal: settlementRecord.subtotal,
        discountAmount: settlementRecord.discountAmount,
        gstAmount: settlementRecord.gstAmount,
        payableAmount: settlementRecord.payableAmount,
        paymentMode: settlementRecord.paymentMode,
        paymentReference: settlementRecord.paymentReference,
      },
      meta: {
        isAdmin,
        discountPercent: subtotalPaise > 0 ? Math.round((discountPaise * 10000) / subtotalPaise) / 100 : 0,
      },
    })

    return {
      restaurantId,
      tableId,
      tableNumber: String(orders[0].tableNumber ?? ''),
      tableIds: [tableId],
      orderIds: ids,
      totalAmount: toRupees(subtotalPaise),
      settledAmount: toRupees(computed.payablePaise),
      settlement: settlementRecord,
      invoiceNumber,
      closedAt: now,
    }
  })
}

// ───────────────────────── Daily numbers (Bugs #14, #15, #17, #46, #78) ─────────────────────────
// One definition for the whole app: a day's revenue is the settled amount of
// bills CLOSED on that restaurant-local day (closedAt). The dashboard and the
// report both use it. The report also looks at orders PLACED that day for the
// item and hourly breakdowns.
//
// Both reads are Firestore range queries on one timestamp field, so the cost
// follows the day's volume, not the restaurant's whole history.

async function restaurantClock(restaurantId) {
  const doc = await restaurantRef(restaurantId).get()
  const data = doc.exists ? doc.data() : {}
  const timeZone = resolveTimezone(data.timezone)
  return {
    timeZone,
    dayKey: dayKeyFor(new Date(), timeZone),
    resetAt: data.statsResetAt || null,
  }
}

async function closedBillsBetween(restaurantId, from, to) {
  const snap = await orderCol(restaurantId)
    .where('closedAt', '>=', from)
    .where('closedAt', '<', to)
    .get()
  return snap.docs.map(fromDoc).filter((o) => o.status === 'closed')
}

async function ordersPlacedBetween(restaurantId, from, to) {
  const snap = await orderCol(restaurantId)
    .where('createdAt', '>=', from)
    .where('createdAt', '<', to)
    .get()
  // Bug #42/#45: cancelled orders never count toward anything shown to staff.
  return snap.docs.map(fromDoc).filter((o) => o.status !== 'cancelled')
}

const laterIso = (a, b) => {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

const billPaise = (order) => toPaise(order.settledAmount ?? order.totalAmount ?? 0)

const getDailyStats = async (restaurantId) => {
  const clock = await restaurantClock(restaurantId)
  const { start, end } = dayBounds(clock.dayKey, clock.timeZone)
  // Bug #46: "reset" restarts only this live counter. Reports and bills keep the full day.
  const from = laterIso(start, clock.resetAt)
  const bills = await closedBillsBetween(restaurantId, from, end)
  const paise = bills.reduce((sum, order) => sum + billPaise(order), 0)

  return {
    date: clock.dayKey,
    dailyRevenue: toRupees(paise),
    completedOrdersToday: bills.length,
    statsResetAt: clock.resetAt,
  }
}

const resetDailyStats = async (restaurantId, actor = null) => {
  const rRef = restaurantRef(restaurantId)
  const now = new Date().toISOString()
  const before = (await rRef.get()).data()?.statsResetAt || null
  await rRef.update({ statsResetAt: now })
  await writeAudit(restaurantId, {
    actor,
    action: 'stats.reset',
    before: { statsResetAt: before },
    after: { statsResetAt: now },
  })
  return { resetAt: now }
}

const getOrderHistory = async (restaurantId, limit = 50) => {
  const snap = await orderCol(restaurantId)
    .where('status', '==', 'closed')
    .orderBy('closedAt', 'desc')
    .limit(limit)
    .get()
  return snap.docs.map(fromDoc)
}

/** Full-day report for the restaurant's local day. Reset does not apply here (Bug #46). */
const getDailyReport = async (restaurantId) => {
  const clock = await restaurantClock(restaurantId)
  const { start, end } = dayBounds(clock.dayKey, clock.timeZone)
  const [bills, placed] = await Promise.all([
    closedBillsBetween(restaurantId, start, end),
    ordersPlacedBetween(restaurantId, start, end),
  ])

  const modes = {}
  bills.forEach((order) => {
    const mode = order.settlement?.paymentMode || 'cash'
    const entry = modes[mode] || { count: 0, paise: 0 }
    entry.count += 1
    entry.paise += billPaise(order)
    modes[mode] = entry
  })
  const paymentModeBreakdown = Object.fromEntries(
    Object.entries(modes).map(([mode, v]) => [mode, { count: v.count, total: toRupees(v.paise) }])
  )

  const itemCounts = {}
  placed.forEach((order) => {
    ;(order.items || []).forEach((item) => {
      const key = item.name || item.id
      const entry = itemCounts[key] || { name: key, quantity: 0, paise: 0 }
      const qty = item.quantity || 1
      entry.quantity += qty
      entry.paise += toPaise(item.price || 0) * qty
      itemCounts[key] = entry
    })
  })
  const topItems = Object.values(itemCounts)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map(({ name, quantity, paise }) => ({ name, quantity, revenue: toRupees(paise) }))

  const hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }))
  placed.forEach((order) => {
    const hour = hourFor(order.createdAt, clock.timeZone)
    if (hour >= 0 && hour < 24) hourlyBreakdown[hour].orders += 1
  })

  const totalPaise = bills.reduce((sum, order) => sum + billPaise(order), 0)

  return {
    date: clock.dayKey,
    timeZone: clock.timeZone,
    totalOrders: bills.length,
    totalRevenue: toRupees(totalPaise),
    averageOrderValue: bills.length > 0 ? toRupees(Math.round(totalPaise / bills.length)) : 0,
    paymentModeBreakdown,
    topItems,
    hourlyBreakdown,
  }
}

/**
 * Cancels ONE order (Bug #41). The table's other orders are not touched.
 * An order that already has served items needs a reason.
 */
async function cancelOrder(restaurantId, orderId, { reason = '', actor = null } = {}) {
  const ref = orderCol(restaurantId).doc(orderId)
  const trimmedReason = String(reason || '').trim()

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new HttpError(404, 'Order not found', { code: 'ORDER_NOT_FOUND' })
    const order = snap.data()

    if (order.status === 'closed' || order.status === 'cancelled') {
      throw new HttpError(409, `Order is already ${order.status}`, { code: 'ALREADY_FINAL' })
    }

    const hasServed = (order.items || []).some((item) => item.status === 'served')
    if (hasServed && trimmedReason.length < 3) {
      throw new HttpError(
        400,
        'This order already has served items. Give a reason (at least 3 characters) to cancel it.',
        { code: 'REASON_REQUIRED' }
      )
    }

    const now = new Date().toISOString()
    const cancelReason = trimmedReason || 'Cancelled by receptionist'
    const updates = {
      status: 'cancelled',
      cancelledAt: now,
      cancelReason,
      cancelledBy: actorLabel(actor),
      updatedAt: now,
    }
    tx.update(ref, updates)

    writeAuditInTransaction(tx, restaurantId, {
      actor,
      action: 'order.cancel',
      before: { status: order.status, totalAmount: order.totalAmount, hasServedItems: hasServed },
      after: { status: 'cancelled', reason: cancelReason },
      meta: { orderId, tableId: order.tableId ?? null },
    })

    return { id: orderId, ...order, ...updates }
  })
}

module.exports = {
  upsertOrder,
  updateOrder,
  updateOrderItemStatus,
  getRestaurantOrders,
  getOrderHistory,
  closeBill,
  getDailyStats,
  resetDailyStats,
  getDailyReport,
  cancelOrder,
}
