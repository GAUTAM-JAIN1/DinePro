import { useState } from 'react'
import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_API_URL

export function useOrder() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const placeOrder = async ({ restaurantId, tableId, tableNumber, items, specialInstructions }) => {
    try {
      setLoading(true)
      setError(null)

      // The backend saves the order AND broadcasts it to the kitchen / billing
      // screens over Socket.io — the customer no longer emits events itself.
      const res = await axios.post(`${BACKEND_URL}/api/orders`, {
        restaurantId,
        tableId,
        tableNumber,
        items,
        specialInstructions,
      })

      return { success: true, order: res.data.order }
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
