import { useState, useEffect, useCallback } from 'react'
import { createSocket, emitAcked, ensureConnected } from '@/lib/socket'
import axios from 'axios'
import { auth } from '@/lib/firebase'
import { playAlert } from '@/lib/kitchenAlertSound'
import { toPaise, toRupees } from '../billingMath'

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
  // Bug #41/#9/#40: server refusals (sold-out, discount needs admin, bill
  // changed, reason needed) are shown here instead of disappearing silently.
  const [actionError,  setActionError]  = useState('')
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

    const registered = []
    const listen = (event, handler) => {
      socket.on(event, handler)
      registered.push([event, handler])
    }
    const pendingTimers = []

    listen('connect',    joinRoom)
    listen('disconnect', () => setConnected(false))

    listen('bill_update', (orderData) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === orderData.id)
        if (exists) return prev.map(o => o.id === orderData.id ? orderData : o)
        return [orderData, ...prev]
      })
    })

    listen('order_received', (orderData) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === orderData.id)
        if (exists) return prev
        return [orderData, ...prev]
      })
      // Naya order aane par receptionist ko bhi pata chalna chahiye
      try { playAlert() } catch (e) { /* ignore */ }
    })

    listen('order_updated', (orderData) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === orderData.id)
        if (exists) return prev.map(o => o.id === orderData.id ? orderData : o)
        return [orderData, ...prev]
      })
      // Customer ne naye items add kiye — yeh bhi alert-worthy hai
      try { playAlert() } catch (e) { /* ignore */ }
    })

    listen('status_changed', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o))
    })

    listen('bill_closed', (closedOrder) => {
      const closedIds = closedOrder.orderIds || [closedOrder.id]
      setOrders(prev => prev.filter(o => !closedIds.includes(o.id)))
      fetchHistory()
    })

    listen('order_cancelled', ({ orderId }) => {
      setOrders(prev => prev.filter(o => o.id !== orderId))
    })

    listen('stats_update', (updatedStats) => {
      setStats(updatedStats)
    })

    // Server refused an action: explain why and re-sync so the screen matches the database.
    listen('close_bill_error', (err) => {
      setActionError(err?.error || 'Bill settle nahi hua. Dobara try karo.')
      fetchData()
      fetchHistory()
    })

    listen('cancel_order_error', (err) => {
      setActionError(err?.error || 'Order cancel nahi hua.')
      fetchData()
    })

    listen('waiter_called', (data) => {
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

      const dismiss = setTimeout(() => {
        setWaiterAlerts(prev => prev.filter(a => a.id !== alert.id))
      }, 30_000)
      pendingTimers.push(dismiss)
    })

    return () => {
      registered.forEach(([event, handler]) => socket.off(event, handler))
      pendingTimers.forEach(clearTimeout)
    }
  }, [restaurantId, fetchData, fetchHistory])

  // settlement: { paymentMode, discountAmount, paymentReference, notes, expectedPayableAmount }
  // GST and service charge are NOT sent: the server takes them from restaurant settings (Bug #9).
  // Bug #23: when the server refuses an action, the screen re-reads the open orders
  // so it shows what actually happened, not the optimistic guess.
  const resyncOrders = useCallback(async () => {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
      const res = await axios.get(`${BACKEND_URL}/api/orders/${restaurantId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setOrders(res.data.orders || [])
    } catch {
      // Keep the current view. The next socket event corrects it.
    }
  }, [restaurantId])

  // settlement: { paymentMode, discountAmount, paymentReference, notes, expectedPayableAmount }
  // GST and service charge are NOT sent: the server takes them from restaurant settings (Bug #9).
  const closeBill = useCallback(async (tableGroup, settlement) => {
    const socket = getSocket()
    const orderIds = tableGroup.orders.map(order => order.id)
    setActionError('')
    setOrders(prev => prev.filter(o => !orderIds.includes(o.id)))
    const result = await emitAcked(socket, 'close_bill', {
      restaurantId,
      orderIds,
      settlement: {
        paymentMode: settlement.paymentMode,
        discountAmount: settlement.discountAmount,
        paymentReference: settlement.paymentReference,
        notes: settlement.notes,
        expectedPayableAmount: settlement.payableAmount,
      },
    })
    if (!result.ok) {
      setActionError(result.error || 'The bill could not be settled. Check the totals and try again.')
      resyncOrders()
    }
    return result
  }, [restaurantId, resyncOrders])

  const markItemServed = useCallback(async (order, item) => {
    const socket = getSocket()
    const itemKey = item.lineId || item.id
    const previousStatus = item.status || 'new'
    const setItemStatus = (status) => setOrders(prev =>
      prev.map(existingOrder => {
        if (existingOrder.id !== order.id) return existingOrder
        return {
          ...existingOrder,
          items: existingOrder.items.map(orderItem =>
            (orderItem.lineId || orderItem.id) === itemKey ? { ...orderItem, status } : orderItem
          ),
        }
      })
    )
    setItemStatus('served')
    const result = await emitAcked(socket, 'item_status', {
      restaurantId,
      orderId: order.id,
      itemKey,
      status: 'served',
    })
    if (!result.ok) {
      setItemStatus(previousStatus)
      setActionError(result.error || 'The item could not be marked served.')
    }
    return result
  }, [restaurantId])

  // Cancels ONE order. Other orders on the same table stay open (Bug #41).
  const cancelOrder = useCallback(async (orderId, tableNumber, reason = '') => {
    const socket = getSocket()
    setActionError('')
    setOrders(prev => prev.filter(o => o.id !== orderId))
    const result = await emitAcked(socket, 'cancel_order', { restaurantId, orderId, reason })
    if (!result.ok) {
      setActionError(result.error || 'The order could not be cancelled.')
      resyncOrders()
    }
    return result
  }, [restaurantId, resyncOrders])

  const dismissWaiterAlert = useCallback((alertId) => {
    setWaiterAlerts(prev => prev.filter(a => a.id !== alertId))
  }, [])

  const clearActionError = useCallback(() => setActionError(''), [])

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

  // Bug #42/#45: cancelled (and already closed) orders never make it into a bill or the pending total.
  const tableGroups = orders
    .filter(order => order.status !== 'cancelled' && order.status !== 'closed')
    .reduce((groups, order) => {
      const table = order.tableNumber
      if (!groups[table]) {
        groups[table] = {
          tableNumber: table,
          orders: [],
          totalPaise: 0,
          totalAmount: 0,
          allItems: [],
        }
      }
      groups[table].orders.push(order)
      groups[table].totalPaise += toPaise(order.totalAmount)
      groups[table].totalAmount = toRupees(groups[table].totalPaise)
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
    actionError,
    clearActionError,
  }
}