import { useEffect, useState } from 'react'

/**
 * useMenuAdmin - Add/update/delete menu items
 * @param {string} restaurantId - The restaurant ID
 */
export function useMenuAdmin(restaurantId) {
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!restaurantId) return

    const fetchMenu = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/menu/${restaurantId}`)
        const data = await response.json()
        setMenu(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchMenu()
  }, [restaurantId])

  const addItem = async (itemData) => {
    try {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...itemData, restaurantId }),
      })
      const newItem = await response.json()
      setMenu([...menu, newItem])
      return newItem
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const updateItem = async (itemId, updates) => {
    try {
      const response = await fetch(`/api/menu/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const updatedItem = await response.json()
      setMenu(menu.map((i) => (i.id === itemId ? updatedItem : i)))
      return updatedItem
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const deleteItem = async (itemId) => {
    try {
      await fetch(`/api/menu/${itemId}`, { method: 'DELETE' })
      setMenu(menu.filter((i) => i.id !== itemId))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  return { menu, loading, error, addItem, updateItem, deleteItem }
}
