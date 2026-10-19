import { useState, useEffect, useCallback } from 'react'
import { createSocket, ensureConnected } from '@/lib/socket'
import axios from 'axios'
import { auth } from '@/lib/firebase'
import { playAlert } from '@/lib/kitchenAlertSound'

const BACKEND_URL = import.meta.env.VITE_API_URL

// Socket singleton
let _socket = null
function getSocket() {
  if (!_socket) _socket = createSocket({ authenticated: true })
  return ensureConnected(_socket)
}

async function getAuthHeaders() {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

export function useBilling(restaurantId) {
  const [orders,       setOrders]       = useState([])
  const [history,      setHistory]      = useState([])
  const [connected,    setConnected]    = useState(false)
  const [waiterAlerts, setWaiterAlerts] = useState([])
  const [restaurant,   setRestaurant]   = useState(null)
  const [stats,        setStats]        = useState({
    dailyRevenue: 0,
    completedOrdersToday: 0,
  })

  const fetchHistory = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await axios.get(`${BACKEND_URL}/api/orders/${restaurantId}/history`, { headers })
      setHistory(res.data.orders || [])
    } catch (err) {
      console.error('Failed to fetch order history:', err)
    }
  }, [restaurantId])

  const fetchData = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const [ordersRes, statsRes, restRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/orders/${restaurantId}`, { headers }),
        axios.get(`${BACKEND_URL}/api/orders/${restaurantId}/stats`, { headers }),
        axios.get(`${BACKEND_URL}/api/restaurants/${restaurantId}`, { headers }).catch(() => null),
      ])
      setOrders(ordersRes.data.orders || [])
      setStats(statsRes.data.stats || { dailyRevenue: 0, completedOrdersToday: 0 })
      if (restRes?.data?.restaurant) setRestaurant(restRes.data.restaurant)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    }
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) return

    const socket = getSocket()

    const joinRoom = () => {
      socket.emit('join_restaurant', restaurantId)
      setConnected(true)
    }

    if (socket.connected) joinRoom()

    fetchData()
    fetchHistory()

    socket.on('connect',    joinRoom)
    socket.on('disconnect', () => setConnected(false))

    socket.on('bill_update', (orderData) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === orderData.id)
        if (exists) return prev.map(o => o.id === orderData.id ? orderData : o)
        return [orderData, ...prev]
      })
    })

    socket.on('order_received', (orderData) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === orderData.id)
        if (exists) return prev
        return [orderData, ...prev]
      })
      // Naya order aane par receptionist ko bhi pata chalna chahiye
      try { playAlert() } catch (e) { /* ignore */ }
    })

    socket.on('order_updated', (orderData) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === orderData.id)
        if (exists) return prev.map(o => o.id === orderData.id ? orderData : o)
        return [orderData, ...prev]
      })
      // Customer ne naye items add kiye — yeh bhi alert-worthy hai
      try { playAlert() } catch (e) { /* ignore */ }
    })

    socket.on('status_changed', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o))
    })

    socket.on('bill_closed', (closedOrder) => {
      const closedIds = closedOrder.orderIds || [closedOrder.id]
      setOrders(prev => prev.filter(o => !closedIds.includes(o.id)))
      fetchHistory()
    })

    socket.on('order_cancelled', ({ orderId }) => {
      setOrders(prev => prev.filter(o => o.id !== orderId))
    })

    socket.on('stats_update', (updatedStats) => {
      setStats(updatedStats)
    })

    socket.on('waiter_called', (data) => {
      if (String(data.restaurantId) !== String(restaurantId)) return
      const alert = {
        id: `${data.tableId}_${data.calledAt}`,
        tableId: data.tableId,
        tableNumber: data.tableNumber,
        calledAt: data.calledAt,
      }
      setWaiterAlerts(prev => {
        const recent = prev.find(a =>
          a.tableId === alert.tableId &&
          Math.abs(new Date(a.calledAt) - new Date(alert.calledAt)) < 5000
        )
        if (recent) return prev
        return [alert, ...prev]
      })

      try { playAlert() } catch (e) { /* ignore */ }

      setTimeout(() => {
        setWaiterAlerts(prev => prev.filter(a => a.id !== alert.id))
      }, 30_000)
    })

    return () => {
      socket.off('connect',         joinRoom)
      socket.off('disconnect')
      socket.off('bill_update')
      socket.off('order_received')
      socket.off('order_updated')
      socket.off('status_changed')
      socket.off('bill_closed')
      socket.off('order_cancelled')
      socket.off('stats_update')
      socket.off('waiter_called')
    }
  }, [restaurantId, fetchData, fetchHistory])

  const closeBill = useCallback((tableGroup, settlement) => {
    const socket = getSocket()
    const orderIds = tableGroup.orders.map(order => order.id)
    socket.emit('close_bill', {
      restaurantId,
      tableNumber: tableGroup.tableNumber,
      orderIds,
      settlement,
    })
    setOrders(prev => prev.filter(o => !orderIds.includes(o.id)))
  }, [restaurantId])

  const markItemServed = useCallback((order, item) => {
    const socket = getSocket()
    const itemKey = item.lineId || item.id
    socket.emit('item_status', {
      restaurantId,
      orderId: order.id,
      itemKey,
      status: 'served',
    })
    setOrders(prev =>
      prev.map(existingOrder => {
        if (existingOrder.id !== order.id) return existingOrder
        return {
          ...existingOrder,
          items: existingOrder.items.map(orderItem =>
            (orderItem.lineId || orderItem.id) === itemKey
              ? { ...orderItem, status: 'served' }
              : orderItem
          ),
        }
      })
    )
  }, [restaurantId])

  const cancelOrder = useCallback((orderId, tableNumber, reason = '') => {
    const socket = getSocket()
    socket.emit('cancel_order', { restaurantId, orderId, reason })
    setOrders(prev => prev.filter(o => o.id !== orderId))
  }, [restaurantId])

  const dismissWaiterAlert = useCallback((alertId) => {
    setWaiterAlerts(prev => prev.filter(a => a.id !== alertId))
  }, [])

  // Manual reset daily stats
  const resetStats = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      await axios.post(`${BACKEND_URL}/api/orders/${restaurantId}/stats/reset`, {}, { headers })
      setStats({ dailyRevenue: 0, completedOrdersToday: 0 })
    } catch (err) {
      console.error('Failed to reset stats:', err)
    }
  }, [restaurantId])

  const tableGroups = orders.reduce((groups, order) => {
    const table = order.tableNumber
    if (!groups[table]) {
      groups[table] = {
        tableNumber: table,
        orders: [],
        totalAmount: 0,
        allItems: [],
      }
    }
    groups[table].orders.push(order)
    groups[table].totalAmount += order.totalAmount
    groups[table].allItems = [...groups[table].allItems, ...order.items]
    return groups
  }, {})

  return {
    orders,
    tableGroups,
    history,
    connected,
    stats,
    restaurant,
    waiterAlerts,
    closeBill,
    markItemServed,
    cancelOrder,
    dismissWaiterAlert,
    resetStats,
  }
}