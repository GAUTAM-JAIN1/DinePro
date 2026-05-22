import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(getErrorMessage(err.code))
    } finally {
      setLoading(false)
    }
  }

  const getErrorMessage = (code) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later.'
      default:
        return 'Login failed. Please try again.'
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif"
    }}>
      <div style={{
        background: 'rgba(30, 30, 50, 0.9)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(184, 135, 70, 0.2)',
        borderRadius: '24px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '56px', marginBottom: '12px' }}>🍳</div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: '700',
            color: '#e8d5b7',
            letterSpacing: '0.5px'
          }}>Kitchen Display</h1>
          <p style={{
            color: 'rgba(232, 213, 183, 0.5)',
            fontSize: '13px',
            marginTop: '6px'
          }}>Sign in to access kitchen orders</p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'rgba(232, 213, 183, 0.7)',
              display: 'block',
              marginBottom: '8px'
            }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="chef@tadkajunction.com"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(184, 135, 70, 0.2)',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#e8d5b7',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div>
            <label style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'rgba(232, 213, 183, 0.7)',
              display: 'block',
              marginBottom: '8px'
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(184, 135, 70, 0.2)',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#e8d5b7',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {error && (
            <p style={{
              color: '#e74c3c',
              fontSize: '13px',
              background: 'rgba(231, 76, 60, 0.1)',
              border: '1px solid rgba(231, 76, 60, 0.2)',
              padding: '12px',
              borderRadius: '12px'
            }}>{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              background: loading
                ? 'rgba(184, 135, 70, 0.4)'
                : 'linear-gradient(135deg, #b88746, #daa520)',
              color: '#1a1a2e',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px',
              fontFamily: 'inherit',
              letterSpacing: '0.5px'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
