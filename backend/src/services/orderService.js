const { db } = require('./firebaseAdmin')

const orderCol = (restaurantId) =>
  db.collection('restaurants').doc(restaurantId).collection('orders')

const calcTotal = (items) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0)

const newLineId = () => `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const DUPLICATE_WINDOW_MS = 5000

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

const toNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100

const itemSignature = (items = []) =>
  normalizeItems(items)
    .map((item) => ({
      id: item.id,
      price: toNumber(item.price),
      quantity: toNumber(item.quantity),
      variant: item.variant || '',
      specialInstructions: (item.specialInstructions || '').trim(),
    }))
    .sort((a, b) => `${a.id}:${a.variant}`.localeCompare(`${b.id}:${b.variant}`))

const sameOrderPayload = (leftItems = [], rightItems = []) =>
  JSON.stringify(itemSignature(leftItems)) === JSON.stringify(itemSignature(rightItems))

const assertNotDuplicateOrder = (orders, orderData) => {
  const now = Date.now()
  const incomingNote = (orderData.specialInstructions || '').trim()

  const duplicate = orders.find((order) => {
    const timestamp = new Date(order.updatedAt || order.createdAt).getTime()
    if (!timestamp || now - timestamp > DUPLICATE_WINDOW_MS) return false
    const existingItems = order.newItems?.length ? order.newItems : order.items
    const existingNote = (order.specialInstructions || '').trim()
    return incomingNote === existingNote && sameOrderPayload(existingItems, orderData.items || [])
  })

  if (duplicate) {
    const error = new Error('Duplicate order blocked. Please wait a few seconds before ordering the same items again.')
    error.statusCode = 409
    throw error
  }
}

const buildSettlement = (subtotal, options = {}) => {
  const discountAmount = Math.min(Math.max(toNumber(options.discountAmount), 0), subtotal)
  const serviceChargeAmount = Math.max(toNumber(options.serviceChargeAmount), 0)
  const gstPercent = Math.max(toNumber(options.gstPercent), 0)
  const taxableAmount = Math.max(subtotal - discountAmount + serviceChargeAmount, 0)
  const gstAmount = roundMoney((taxableAmount * gstPercent) / 100)
  const payableAmount = roundMoney(taxableAmount + gstAmount)

  return {
    subtotal: roundMoney(subtotal),
    discountAmount: roundMoney(discountAmount),
    serviceChargeAmount: roundMoney(serviceChargeAmount),
    gstPercent: roundMoney(gstPercent),
    gstAmount,
    payableAmount,
    paymentMode: options.paymentMode || 'cash',
    paymentReference: options.paymentReference || '',
    notes: options.notes || '',
  }
}

const isToday = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const t = new Date()
  return d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
}

const getOpenOrdersForTable = async (restaurantId, tableId) => {
  const snap = await orderCol(restaurantId)
    .where('tableId', '==', tableId)
    .where('status', '!=', 'closed')
    .get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

const getOpenOrderForTable = async (restaurantId, tableId) => {
  const orders = await getOpenOrdersForTable(restaurantId, tableId)
  if (orders.length === 0) return null
  return orders.find(order => order.status !== 'ready' && order.status !== 'served') || null
}

const createOrder = async (restaurantId, orderData) => {
  const now = new Date().toISOString()
  const items = normalizeItems(orderData.items || [], 'new')
  const totalAmount = calcTotal(items)

  const docRef = await orderCol(restaurantId).add({
    restaurantId,
    tableId: orderData.tableId,
    tableNumber: orderData.tableNumber,
    items,
    newItems: items,
    specialInstructions: orderData.specialInstructions || '',
    totalAmount,
    status: 'new',
    createdAt: now,
    updatedAt: now,
  })

  const doc = await docRef.get()
  return { id: doc.id, ...doc.data() }
}

const addItemsToOrder = async (restaurantId, orderId, newItems, specialInstructions = '') => {
  const ref = orderCol(restaurantId).doc(orderId)
  const doc = await ref.get()
  if (!doc.exists) throw new Error('Order not found')
  const existing = doc.data()

  const normalizedNewItems = normalizeItems(newItems, 'new')
  const mergedItems = [
    ...normalizeItems(existing.items, existing.status || 'new'),
    ...normalizedNewItems,
  ]
  const totalAmount = calcTotal(mergedItems)
  const now = new Date().toISOString()

  const updates = {
    items: mergedItems,
    newItems: normalizedNewItems,
    totalAmount,
    status: 'new',
    updatedAt: now,
  }

  if (specialInstructions) updates.specialInstructions = specialInstructions

  await ref.update(updates)
  const updated = await ref.get()
  return { id: updated.id, ...updated.data() }
}

const upsertOrder = async (restaurantId, orderData) => {
  const openOrders = await getOpenOrdersForTable(restaurantId, orderData.tableId)
  assertNotDuplicateOrder(openOrders, orderData)

  const openOrder = openOrders.find(order => order.status !== 'ready' && order.status !== 'served') || null

  if (openOrder) {
    return await addItemsToOrder(restaurantId, openOrder.id, orderData.items, orderData.specialInstructions || '')
  } else {
    return await createOrder(restaurantId, orderData)
  }
}

const updateOrder = async (restaurantId, orderId, updates) => {
  const ref = orderCol(restaurantId).doc(orderId)
  const now = new Date().toISOString()
  const data = { ...updates, updatedAt: now }

  if (updates.status === 'preparing' || updates.status === 'ready' || updates.status === 'served') {
    const doc = await ref.get()
    const existing = doc.exists ? doc.data() : {}
    data.items = normalizeItems(existing.items, existing.status || 'new').map((item) =>
      item.status === 'served' ? item : { ...item, status: updates.status }
    )
    data.newItems = normalizeItems(existing.newItems || [], existing.status || 'new').map((item) =>
      item.status === 'served' ? item : { ...item, status: updates.status }
    )
  }

  if (updates.status === 'ready') data.completedAt = now
  if (updates.status === 'served') data.servedAt = now
  if (updates.status === 'closed') data.closedAt = now

  await ref.update(data)
  const doc = await ref.get()
  return { id: doc.id, ...doc.data() }
}

const updateOrderItemStatus = async (restaurantId, orderId, itemKey, status) => {
  const ref = orderCol(restaurantId).doc(orderId)
  const doc = await ref.get()
  if (!doc.exists) throw new Error('Order not found')

  const existing = doc.data()
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

  await ref.update(updates)
  const updated = await ref.get()
  return { id: updated.id, ...updated.data() }
}

const getRestaurantOrders = async (restaurantId) => {
  const snap = await orderCol(restaurantId)
    .where('status', '!=', 'closed')
    .orderBy('status')
    .orderBy('createdAt', 'desc')
    .get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

const closeBill = async (restaurantId, tableNumber, orderIds, settlementOptions = {}) => {
  const now = new Date().toISOString()
  const batch = db.batch()
  let totalAmount = 0

  let ordersToClose = []
  if (orderIds && orderIds.length > 0) {
    for (const id of orderIds) {
      const doc = await orderCol(restaurantId).doc(id).get()
      if (doc.exists) ordersToClose.push({ id: doc.id, ...doc.data() })
    }
  } else {
    const snap = await orderCol(restaurantId)
      .where('tableNumber', '==', String(tableNumber))
      .where('status', '!=', 'closed')
      .get()
    ordersToClose = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  totalAmount = ordersToClose.reduce((sum, order) => sum + order.totalAmount, 0)
  const settlement = buildSettlement(totalAmount, settlementOptions)

  ordersToClose.forEach(order => {
    const ref = orderCol(restaurantId).doc(order.id)
    const ratio = totalAmount > 0 ? order.totalAmount / totalAmount : 0
    const settledAmount = roundMoney(settlement.payableAmount * ratio)
    batch.update(ref, {
      status: 'closed',
      closedAt: now,
      updatedAt: now,
      settledAmount,
      settlement: {
        ...settlement,
        orderSubtotal: roundMoney(order.totalAmount),
        settledAmount,
      },
    })
  })

  await batch.commit()

  return {
    restaurantId,
    tableNumber,
    orderIds: ordersToClose.map(o => o.id),
    totalAmount,
    settledAmount: settlement.payableAmount,
    settlement,
    closedAt: now,
  }
}

const getDailyStats = async (restaurantId) => {
  // Check if manual reset exists for today
  const restRef = db.collection('restaurants').doc(restaurantId)
  const restDoc = await restRef.get()
  const resetAt = restDoc.exists ? restDoc.data()?.statsResetAt : null

  const snap = await orderCol(restaurantId).where('status', '==', 'closed').get()
  const allClosed = snap.docs.map(d => d.data())

  const todayClosed = allClosed.filter(o => {
    if (!isToday(o.closedAt)) return false
    if (resetAt && new Date(o.closedAt) < new Date(resetAt)) return false
    return true
  })

  const todayCompleted = allClosed.filter(o => {
    if (!isToday(o.completedAt)) return false
    if (resetAt && new Date(o.completedAt) < new Date(resetAt)) return false
    return true
  })

  return {
    dailyRevenue: todayClosed.reduce((sum, o) => sum + (o.settledAmount ?? o.totalAmount), 0),
    completedOrdersToday: todayCompleted.length,
  }
}

const resetDailyStats = async (restaurantId) => {
  const restRef = db.collection('restaurants').doc(restaurantId)
  const now = new Date().toISOString()
  await restRef.update({ statsResetAt: now })
  return { resetAt: now }
}

const getOrderHistory = async (restaurantId, limit = 50) => {
  const snap = await orderCol(restaurantId)
    .where('status', '==', 'closed')
    .orderBy('closedAt', 'desc')
    .limit(limit)
    .get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

const getDailyReport = async (restaurantId) => {
  const snap = await orderCol(restaurantId).get()
  const allOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const todayOrders = allOrders.filter((o) => isToday(o.createdAt))
  const todayClosed = todayOrders.filter((o) => o.status === 'closed')

  const totalRevenue = todayClosed.reduce(
    (sum, o) => sum + (o.settledAmount ?? o.totalAmount ?? 0), 0
  )

  const paymentModes = {}
  todayClosed.forEach((o) => {
    const mode = o.settlement?.paymentMode || 'cash'
    if (!paymentModes[mode]) paymentModes[mode] = { count: 0, total: 0 }
    paymentModes[mode].count += 1
    paymentModes[mode].total += o.settledAmount ?? o.totalAmount ?? 0
  })

  const itemCounts = {}
  todayOrders.forEach((o) => {
    ;(o.items || []).forEach((item) => {
      const key = item.name || item.id
      if (!itemCounts[key]) itemCounts[key] = { name: key, quantity: 0, revenue: 0 }
      itemCounts[key].quantity += item.quantity || 1
      itemCounts[key].revenue += (item.price || 0) * (item.quantity || 1)
    })
  })
  const topItems = Object.values(itemCounts)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  const hourlyBreakdown = Array.from({ length: 24 }, (_, i) => ({ hour: i, orders: 0 }))
  todayOrders.forEach((o) => {
    const h = new Date(o.createdAt).getHours()
    if (h >= 0 && h < 24) hourlyBreakdown[h].orders += 1
  })

  return {
    date: new Date().toISOString().split('T')[0],
    totalOrders: todayClosed.length,
    totalRevenue: roundMoney(totalRevenue),
    averageOrderValue: todayClosed.length > 0 ? roundMoney(totalRevenue / todayClosed.length) : 0,
    paymentModeBreakdown: paymentModes,
    topItems,
    hourlyBreakdown,
  }
}

const cancelOrder = async (restaurantId, orderId, reason = '') => {
  const ref = orderCol(restaurantId).doc(orderId)
  const doc = await ref.get()
  if (!doc.exists) throw new Error('Order not found')
  const order = doc.data()
  if (order.status === 'closed' || order.status === 'cancelled') {
    throw new Error(`Order is already ${order.status}`)
  }
  await ref.update({
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelReason: reason || 'Cancelled by receptionist',
    updatedAt: new Date().toISOString(),
  })
  return { id: orderId, ...order, status: 'cancelled' }
}

module.exports = {
  upsertOrder,
  createOrder,
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