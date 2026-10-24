import { useState } from 'react'
import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_API_URL

export function useOrder() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const placeOrder = async ({ restaurantId, tableId, items, specialInstructions, idempotencyKey }) => {
    try {
      setLoading(true)
      setError(null)

      // The backend prices the items from the menu, derives the table number,
      // and uses idempotencyKey so a retry can't create a second order (Bug #1, #51, #53).
      // It also broadcasts the order to the kitchen / billing screens.
      const res = await axios.post(`${BACKEND_URL}/api/orders`, {
        restaurantId,
        tableId,
        items,
        specialInstructions,
        idempotencyKey,
      })

      return { success: true, order: res.data.order, replayed: Boolean(res.data.replayed) }
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
