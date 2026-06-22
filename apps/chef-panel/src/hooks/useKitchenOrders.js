import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import { auth } from '../firebase'
import { playAlert } from '../utils/kitchenAlertSound'

const BACKEND_URL = import.meta.env.VITE_API_URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL

async function getAuthHeaders() {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

function showBrowserNotification(order, titlePrefix = 'New kitchen order') {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  const table = order.tableNumber || order.tableId || '-'
  const itemCount = Array.isArray(order.newItems) && order.newItems.length > 0
    ? order.newItems.length
    : order.items?.length || 0
  new Notification(`${titlePrefix}: Table ${table}`, {
    body: `${itemCount} item${itemCount === 1 ? '' : 's'} waiting in kitchen`,
    tag: `kitchen-${order.id}`,
  })
}

export function useKitchenOrders(restaurantId, options = {}) {
  const { soundEnabled = true, browserNotificationsEnabled = true } = options
  const [orders, setOrders] = useState([])
  const [connected, setConnected] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return Notification.permission
  })
  const [stats, setStats] = useState({ dailyRevenue: 0, completedOrdersToday: 0 })

  const socketRef = useRef(null)
  // Jab tak initial fetch poora nahi hota, beech mein aaye socket events yahan queue ho jayenge
  const pendingEventsRef = useRef([])
  const initialFetchDoneRef = useRef(false)

  const notifyKitchen = useCallback((order, titlePrefix) => {
    if (soundEnabled) {
      try { playAlert() } catch (err) { console.warn('Kitchen beep failed:', err) }
    }
    if (browserNotificationsEnabled) {
      showBrowserNotification(order, titlePrefix)
    }
  }, [browserNotificationsEnabled, soundEnabled])

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported')
      return 'unsupported'
    }
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    return permission
  }, [])

  useEffect(() => {
    if (!restaurantId) return

    initialFetchDoneRef.current = false
    pendingEventsRef.current = []

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    // Merge karte hain — fetch se jo orders aaye unhe base maano,
    // lekin agar pending socket events mein koi naya/updated order hai jo fetch ke baad aaya, use bhi rakho
    const applyPendingEvents = (baseOrders) => {
      let merged = [...baseOrders]
      pendingEventsRef.current.forEach(({ type, payload }) => {
        if (type === 'order_received' || type === 'order_updated') {
          const exists = merged.find(o => o.id === payload.id)
          merged = exists
            ? merged.map(o => o.id === payload.id ? payload : o)
            : [payload, ...merged]
        } else if (type === 'status_changed') {
          merged = merged.map(o => o.id === payload.id ? payload : o)
        } else if (type === 'bill_closed') {
          const closedIds = payload.orderIds || [payload.id]
          merged = merged.filter(o => !closedIds.includes(o.id))
        } else if (type === 'order_cancelled') {
          merged = merged.filter(o => o.id !== payload.orderId)
        }
      })
      pendingEventsRef.current = []
      return merged
    }

    const fetchData = async () => {
      try {
        const headers = await getAuthHeaders()
        const [ordersRes, statsRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/orders/${restaurantId}`, { headers }),
          axios.get(`${BACKEND_URL}/api/orders/${restaurantId}/stats`, { headers }),
        ])
        setOrders(applyPendingEvents(ordersRes.data.orders || []))
        setStats(statsRes.data.stats || { dailyRevenue: 0, completedOrdersToday: 0 })
      } catch (err) {
        console.error('Failed to fetch orders:', err)
      } finally {
        initialFetchDoneRef.current = true
      }
    }

    const handleConnect = () => {
      setConnected(true)
      socket.emit('join_restaurant', restaurantId)
      fetchData()
    }

    const handleDisconnect = () => setConnected(false)

    const handleOrderReceived = (newOrder) => {
      if (!initialFetchDoneRef.current) {
        pendingEventsRef.current.push({ type: 'order_received', payload: newOrder })
      } else {
        setOrders(prev => {
          const exists = prev.find(o => o.id === newOrder.id)
          if (exists) return prev
          return [newOrder, ...prev]
        })
      }
      notifyKitchen(newOrder, 'New kitchen order')
    }

    const handleOrderUpdated = (updatedOrder) => {
      if (!initialFetchDoneRef.current) {
        pendingEventsRef.current.push({ type: 'order_updated', payload: updatedOrder })
      } else {
        setOrders(prev => {
          const exists = prev.find(o => o.id === updatedOrder.id)
          if (exists) return prev.map(o => o.id === updatedOrder.id ? updatedOrder : o)
          return [updatedOrder, ...prev]
        })
      }
      notifyKitchen(updatedOrder, 'Items added')
    }

    const handleStatusChanged = (updatedOrder) => {
      if (!initialFetchDoneRef.current) {
        pendingEventsRef.current.push({ type: 'status_changed', payload: updatedOrder })
      } else {
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o))
      }
    }

    const handleBillClosed = (closedOrder) => {
      if (!initialFetchDoneRef.current) {
        pendingEventsRef.current.push({ type: 'bill_closed', payload: closedOrder })
      } else {
        const closedIds = closedOrder.orderIds || [closedOrder.id]
        setOrders(prev => prev.filter(o => !closedIds.includes(o.id)))
      }
    }

    // Receptionist cancel kare to chef panel se bhi instantly hatao
    const handleOrderCancelled = (payload) => {
      if (!initialFetchDoneRef.current) {
        pendingEventsRef.current.push({ type: 'order_cancelled', payload })
      } else {
        setOrders(prev => prev.filter(o => o.id !== payload.orderId))
      }
    }

    const handleStatsUpdate = (updatedStats) => setStats(updatedStats)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('order_received', handleOrderReceived)
    socket.on('order_updated', handleOrderUpdated)
    socket.on('status_changed', handleStatusChanged)
    socket.on('bill_closed', handleBillClosed)
    socket.on('order_cancelled', handleOrderCancelled)
    socket.on('stats_update', handleStatsUpdate)

    if (socket.connected) handleConnect()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('order_received', handleOrderReceived)
      socket.off('order_updated', handleOrderUpdated)
      socket.off('status_changed', handleStatusChanged)
      socket.off('bill_closed', handleBillClosed)
      socket.off('order_cancelled', handleOrderCancelled)
      socket.off('stats_update', handleStatsUpdate)
      socket.disconnect()
    }
  }, [notifyKitchen, restaurantId])

  const markPreparing = (order) => {
    const socket = socketRef.current
    if (!socket) return
    socket.emit('order_preparing', { ...order, restaurantId })
    order.items?.forEach(item => {
      if ((item.status || 'new') === 'new') {
        socket.emit('item_status', {
          restaurantId, orderId: order.id,
          itemKey: item.lineId || item.id, status: 'preparing',
        })
      }
    })
    setOrders(prev => prev.map(o => {
      if (o.id !== order.id) return o
      return {
        ...o, status: 'preparing',
        items: o.items.map(item => ({
          ...item, status: item.status === 'ready' ? 'ready' : 'preparing',
        })),
      }
    }))
  }

  const markReady = (order) => {
    const socket = socketRef.current
    if (!socket) return
    socket.emit('order_ready', { ...order, restaurantId })
    order.items?.forEach(item => {
      if ((item.status || 'new') !== 'ready' && (item.status || 'new') !== 'served') {
        socket.emit('item_status', {
          restaurantId, orderId: order.id,
          itemKey: item.lineId || item.id, status: 'ready',
        })
      }
    })
    setOrders(prev => prev.map(o => {
      if (o.id !== order.id) return o
      return {
        ...o, status: 'ready',
        items: o.items.map(item => ({
          ...item, status: item.status === 'served' ? 'served' : 'ready',
        })),
      }
    }))
  }

  const updateItemStatus = (order, item, status) => {
    const socket = socketRef.current
    if (!socket) return
    const itemKey = item.lineId || item.id
    socket.emit('item_status', { restaurantId, orderId: order.id, itemKey, status })
    setOrders(prev => prev.map(o => {
      if (o.id !== order.id) return o
      const items = o.items.map(orderItem =>
        (orderItem.lineId || orderItem.id) === itemKey ? { ...orderItem, status } : orderItem
      )
      return { ...o, items }
    }))
  }

  const sendChefMessage = (order, message) => {
    const socket = socketRef.current
    if (!socket) return
    const trimmed = message.trim()
    if (!trimmed) return
    socket.emit('chef_message', {
      restaurantId: order.restaurantId || restaurantId,
      orderId: order.id,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      message: trimmed,
    })
  }

  return {
    orders, connected, markPreparing, markReady,
    updateItemStatus, stats, notificationPermission,
    requestNotificationPermission, sendChefMessage,
  }
}