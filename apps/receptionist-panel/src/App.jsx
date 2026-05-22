import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import BillingDashboard from './pages/BillingDashboard'

function App() {
  const { user, role, restaurantId, loading, logout } = useAuth()

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#fdf8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', animation: 'pulse 1.5s infinite' }}>🧾</div>
          <p style={{ color: '#8a7a6a', fontSize: '13px', marginTop: '12px' }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return <Login />
  }

  // Wrong role — only receptionist and admin allowed
  if (role !== 'receptionist' && role !== 'admin') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#fdf8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <p style={{ color: '#2c2c2c', fontWeight: '600', fontSize: '16px' }}>Access Denied</p>
          <p style={{ color: '#8a7a6a', fontSize: '13px', marginTop: '6px' }}>
            This panel is for receptionists only.
          </p>
          <button
            onClick={logout}
            style={{
              marginTop: '16px',
              background: 'none',
              border: '1px solid rgba(184, 135, 70, 0.3)',
              borderRadius: '8px',
              padding: '8px 20px',
              color: '#b88746',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  // Authorized — show billing dashboard
  if (!restaurantId) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#fdf8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{ textAlign: 'center', maxWidth: '360px', padding: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>!</div>
          <p style={{ color: '#2c2c2c', fontWeight: '600', fontSize: '16px' }}>Restaurant not assigned</p>
          <p style={{ color: '#8a7a6a', fontSize: '13px', marginTop: '6px' }}>
            This user needs a restaurantId claim before opening the billing desk.
          </p>
          <button
            onClick={logout}
            style={{
              marginTop: '16px',
              background: 'none',
              border: '1px solid rgba(184, 135, 70, 0.3)',
              borderRadius: '8px',
              padding: '8px 20px',
              color: '#b88746',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return <BillingDashboard restaurantId={restaurantId} />
}

export default App
