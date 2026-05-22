import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import { auth } from '../firebase'

const BACKEND_URL = import.meta.env.VITE_API_URL

// Socket singleton
let _socket = null
function getSocket() {
  if (!_socket) {
    _socket = io(import.meta.env.VITE_SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    })
  }
  return _socket
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
    })

    socket.on('order_updated', (orderData) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === orderData.id)
        if (exists) return prev.map(o => o.id === orderData.id ? orderData : o)
        return [orderData, ...prev]
      })
    })

    socket.on('status_changed', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o))
    })

    socket.on('bill_closed', (closedOrder) => {
      const closedIds = closedOrder.orderIds || [closedOrder.id]
      setOrders(prev => prev.filter(o => !closedIds.includes(o.id)))
      fetchHistory()
    })

    socket.on('stats_update', (updatedStats) => {
      setStats(updatedStats)
    })

    // Waiter called by customer
    socket.on('waiter_called', (data) => {
      if (String(data.restaurantId) !== String(restaurantId)) return
      const alert = {
        id: `${data.tableId}_${data.calledAt}`,
        tableId: data.tableId,
        tableNumber: data.tableNumber,
        calledAt: data.calledAt,
      }
      setWaiterAlerts(prev => {
        // Avoid duplicate alerts for same table within 5 seconds
        const recent = prev.find(a =>
          a.tableId === alert.tableId &&
          Math.abs(new Date(a.calledAt) - new Date(alert.calledAt)) < 5000
        )
        if (recent) return prev
        return [alert, ...prev]
      })

      // Play notification sound
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.5)
      } catch (_) {}

      // Auto-dismiss after 30 seconds
      setTimeout(() => {
        setWaiterAlerts(prev => prev.filter(a => a.id !== alert.id))
      }, 30_000)
    })

    return () => {
      socket.off('connect',       joinRoom)
      socket.off('disconnect')
      socket.off('bill_update')
      socket.off('order_received')
      socket.off('order_updated')
      socket.off('status_changed')
      socket.off('bill_closed')
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

  const dismissWaiterAlert = useCallback((alertId) => {
    setWaiterAlerts(prev => prev.filter(a => a.id !== alertId))
  }, [])

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
    dismissWaiterAlert,
  }
}