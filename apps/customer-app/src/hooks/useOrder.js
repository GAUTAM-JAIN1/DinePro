import { useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_API_URL
const socket = io(import.meta.env.VITE_SOCKET_URL)

export function useOrder() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const placeOrder = async ({ restaurantId, tableId, tableNumber, items, specialInstructions }) => {
    try {
      setLoading(true)

      // HTTP save karo — upsertOrder Firestore mein
      const res = await axios.post(`${BACKEND_URL}/api/orders`, {
        restaurantId,
        tableId,
        tableNumber,
        items,
        specialInstructions,
      })

      const order = res.data.order

      // isUpdate — agar newItems < total items, matlab existing order tha
      const isUpdate = order.items.length > (order.newItems?.length || 0)

      // Socket sirf broadcast ke liye — dobara save nahi
      socket.emit('join_restaurant', restaurantId)
      socket.emit('new_order', {
        ...order,
        isUpdate,
      })

      return { success: true, order }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to place order.'
      setError(message)
      console.error(err)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  return { placeOrder, loading, error }
}
