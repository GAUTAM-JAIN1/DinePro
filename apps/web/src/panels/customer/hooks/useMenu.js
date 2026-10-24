import { useEffect, useState } from 'react'
import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_API_URL

export function useMenu(restaurantId) {
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(Boolean(restaurantId))
  const [error, setError] = useState(null)
  const [serviceUnavailable, setServiceUnavailable] = useState(false)
  const [restaurant, setRestaurant] = useState(null)

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false)
      return
    }

    let active = true

    const fetchMenu = async () => {
      try {
        setLoading(true)
        setError(null)
        setServiceUnavailable(false)

        const restRes = await axios.get(`${BACKEND_URL}/api/restaurants/${restaurantId}`)
        const nextRestaurant = restRes.data.restaurant

        if (!active) return
        setRestaurant(nextRestaurant)

        const menuRes = await axios.get(`${BACKEND_URL}/api/menu/${restaurantId}`)
        if (!active) return
        setMenu(menuRes.data.menu || [])
      } catch (err) {
        if (!active) return

        if (err.response?.status === 402) {
          setServiceUnavailable(true)
          setError(null)
        } else {
          setError(err.response?.data?.error || 'Failed to load menu. Please try again.')
        }
        console.error(err)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchMenu()

    return () => {
      active = false
    }
  }, [restaurantId])

  return { menu, loading, error, serviceUnavailable, restaurant }
}
