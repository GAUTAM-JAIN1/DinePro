import { useEffect, useState } from 'react'

/**
 * useRestaurant - CRUD for restaurant profile
 * @param {string} restaurantId - The restaurant ID
 */
export function useRestaurant(restaurantId) {
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!restaurantId) return

    const fetchRestaurant = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/restaurants/${restaurantId}`)
        const data = await response.json()
        setRestaurant(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurant()
  }, [restaurantId])

  const updateRestaurant = async (updates) => {
    try {
      const response = await fetch(`/api/restaurants/${restaurantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await response.json()
      setRestaurant(data)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  return { restaurant, loading, error, updateRestaurant }
}
