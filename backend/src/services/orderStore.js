let orders = []

function isToday(dateValue) {
  if (!dateValue) return false

  const date = new Date(dateValue)
  const today = new Date()

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function createOrder(orderData) {
  const totalAmount = orderData.totalAmount ??
    orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const newOrder = {
    id: orderData.id || Date.now().toString(),
    ...orderData,
    totalAmount,
    status: orderData.status || 'new',
    createdAt: orderData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  orders.push(newOrder)
  return newOrder
}

function upsertOrder(orderData) {
  const index = orders.findIndex((order) => order.id === orderData.id)

  if (index === -1) {
    return createOrder(orderData)
  }

  orders[index] = {
    ...orders[index],
    ...orderData,
    updatedAt: new Date().toISOString(),
  }

  return orders[index]
}

function getRestaurantOrders(restaurantId) {
  return orders.filter(
    (order) => order.restaurantId === restaurantId && order.status !== 'closed'
  )
}

function updateOrder(orderId, updates) {
  const orderIndex = orders.findIndex((order) => order.id === orderId)

  if (orderIndex === -1) {
    return null
  }

  orders[orderIndex] = {
    ...orders[orderIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  if (updates.status === 'ready' && !orders[orderIndex].completedAt) {
    orders[orderIndex].completedAt = new Date().toISOString()
  }

  return orders[orderIndex]
}

function updateOrderStatus(orderData, status) {
  return updateOrder(orderData.id, {
    ...orderData,
    status,
  }) || upsertOrder({ ...orderData, status })
}

function closeBill(orderData) {
  const now = new Date().toISOString()
  const orderIds = orderData.orderIds || (orderData.id ? [orderData.id] : [])
  const matchingOrders = orders.filter((order) => {
    if (order.restaurantId !== orderData.restaurantId) return false
    if (orderIds.length > 0) return orderIds.includes(order.id)
    return String(order.tableNumber) === String(orderData.tableNumber) && order.status !== 'closed'
  })

  matchingOrders.forEach((order) => {
    order.status = 'closed'
    order.closedAt = now
    order.updatedAt = now
  })

  return {
    ...orderData,
    orderIds: matchingOrders.map((order) => order.id),
    totalAmount: matchingOrders.reduce((sum, order) => sum + order.totalAmount, 0),
    closedAt: now,
  }
}

function getDailyStats(restaurantId) {
  const restaurantOrders = orders.filter((order) => order.restaurantId === restaurantId)
  const todayClosedOrders = restaurantOrders.filter(
    (order) => order.status === 'closed' && isToday(order.closedAt)
  )
  const todayCompletedOrders = restaurantOrders.filter((order) => isToday(order.completedAt))

  return {
    dailyRevenue: todayClosedOrders.reduce((sum, order) => sum + order.totalAmount, 0),
    completedOrdersToday: todayCompletedOrders.length,
  }
}

module.exports = {
  closeBill,
  createOrder,
  getDailyStats,
  getRestaurantOrders,
  updateOrder,
  updateOrderStatus,
  upsertOrder,
}
