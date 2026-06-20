import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import KitchenDisplay from './pages/KitchenDisplay'

const BACKEND_URL = import.meta.env.VITE_API_URL

function App() {
  const { user, role, restaurantId, loading, logout } = useAuth()
  const [restaurantName, setRestaurantName] = useState('')

  // Fetch restaurant name once restaurantId is available
  useEffect(() => {
    if (!restaurantId) return
    fetch(`${BACKEND_URL}/api/restaurants/${restaurantId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.restaurant?.name) {
          setRestaurantName(data.restaurant.name)
        }
      })
      .catch(() => {}) // silent fail — fallback is 'Kitchen'
  }, [restaurantId])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#1a1a2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', animation: 'pulse 1.5s infinite' }}>🍳</div>
          <p style={{ color: 'rgba(232, 213, 183, 0.5)', fontSize: '13px', marginTop: '12px' }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  if (role !== 'chef' && role !== 'admin') {
    return (
      <div style={{
        minHeight: '100vh', background: '#1a1a2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <p style={{ color: '#e8d5b7', fontWeight: '600', fontSize: '16px' }}>Access Denied</p>
          <p style={{ color: 'rgba(232, 213, 183, 0.5)', fontSize: '13px', marginTop: '6px' }}>
            This panel is for kitchen staff only.
          </p>
          <button onClick={logout} style={signOutStyle}>Sign out</button>
        </div>
      </div>
    )
  }

  if (!restaurantId) {
    return (
      <div style={{
        minHeight: '100vh', background: '#1a1a2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif"
      }}>
        <div style={{ textAlign: 'center', maxWidth: '360px', padding: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>!</div>
          <p style={{ color: '#e8d5b7', fontWeight: '600', fontSize: '16px' }}>Restaurant not assigned</p>
          <p style={{ color: 'rgba(232, 213, 183, 0.5)', fontSize: '13px', marginTop: '6px' }}>
            This user needs a restaurantId claim before opening the kitchen display.
          </p>
          <button onClick={logout} style={signOutStyle}>Sign out</button>
        </div>
      </div>
    )
  }

  return <KitchenDisplay restaurantId={restaurantId} restaurantName={restaurantName} onLogout={logout} userEmail={user.email} />
}

const signOutStyle = {
  marginTop: '16px', background: 'none',
  border: '1px solid rgba(184, 135, 70, 0.3)',
  borderRadius: '8px', padding: '8px 20px',
  color: '#b88746', fontSize: '13px',
  cursor: 'pointer', fontFamily: 'inherit',
}

export default App