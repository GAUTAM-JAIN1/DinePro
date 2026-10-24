import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import Notice from '@/components/Notice'
import AudioUnlockBanner from '@/components/AudioUnlockBanner'
import KitchenDisplay from './pages/KitchenDisplay'

const BACKEND_URL = import.meta.env.VITE_API_URL

/** Kitchen display. Access is already enforced by <RequireRole panel="chef"> in App.jsx. */
export default function ChefPanel() {
  const { user, restaurantId, logout } = useAuth()
  const [restaurantName, setRestaurantName] = useState('')

  useEffect(() => {
    if (!restaurantId) return
    fetch(`${BACKEND_URL}/api/restaurants/${restaurantId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.restaurant?.name) setRestaurantName(data.restaurant.name)
      })
      .catch(() => {}) // silent — the display falls back to "Kitchen"
  }, [restaurantId])

  if (!restaurantId) {
    return (
      <Notice
        title="Restaurant not assigned"
        body="This user needs a restaurantId claim before opening the kitchen display."
        actions={[{ label: 'Sign out', onClick: logout, primary: true }]}
      />
    )
  }

  return (
    <div className="theme-chef">
      <AudioUnlockBanner />
      <KitchenDisplay
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        onLogout={logout}
        userEmail={user.email}
      />
    </div>
  )
}
