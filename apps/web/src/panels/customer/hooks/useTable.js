import { useEffect, useState } from 'react'
import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_API_URL

export function tableSessionKey(restaurantId, tableIdentifier) {
  return `verifiedTable:${restaurantId}:${tableIdentifier}`
}

export function readVerifiedTable(restaurantId, tableIdentifier) {
  try {
    const raw = sessionStorage.getItem(tableSessionKey(restaurantId, tableIdentifier))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeVerifiedTable(restaurantId, tableIdentifier, table) {
  try {
    sessionStorage.setItem(tableSessionKey(restaurantId, tableIdentifier), JSON.stringify(table))
    sessionStorage.setItem(tableSessionKey(restaurantId, table.id), JSON.stringify(table))
  } catch {
    // Session storage is a convenience only; the API remains the source of truth.
  }
}

export function useTable(restaurantId, tableIdentifier) {
  const [restaurant, setRestaurant] = useState(null)
  const [table, setTable] = useState(() => readVerifiedTable(restaurantId, tableIdentifier))
  const [loading, setLoading] = useState(Boolean(restaurantId && tableIdentifier))
  const [error, setError] = useState(null)
  const [serviceUnavailable, setServiceUnavailable] = useState(false)

  useEffect(() => {
    if (!restaurantId || !tableIdentifier) {
      setLoading(false)
      return
    }

    let active = true

    const fetchTable = async () => {
      try {
        setLoading(true)
        setError(null)
        setServiceUnavailable(false)

        const restaurantRes = await axios.get(`${BACKEND_URL}/api/restaurants/${restaurantId}`)
        const nextRestaurant = restaurantRes.data.restaurant

        if (!active) return
        setRestaurant(nextRestaurant)

        if (nextRestaurant?.subscription?.isServiceEnabled === false) {
          setServiceUnavailable(true)
          setTable(null)
          return
        }

        const tableRes = await axios.get(`${BACKEND_URL}/api/tables/${restaurantId}/${tableIdentifier}`)
        const nextTable = tableRes.data.table

        if (!active) return
        setTable(nextTable)
        storeVerifiedTable(restaurantId, tableIdentifier, nextTable)
      } catch (err) {
        if (!active) return

        if (err.response?.status === 402) {
          setServiceUnavailable(true)
          setError(null)
        } else {
          setError(err.response?.data?.error || 'This table QR is not valid.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchTable()

    return () => {
      active = false
    }
  }, [restaurantId, tableIdentifier])

  return { restaurant, table, loading, error, serviceUnavailable }
}
