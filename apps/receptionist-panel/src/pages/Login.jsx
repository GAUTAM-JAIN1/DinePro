import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { unlockAudio } from '../utils/kitchenAlertSound'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    // Yeh click hi browser ka "user gesture" hai — isi se audio permanently unlock ho jaata hai
    unlockAudio()

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
    <div className="min-h-screen flex items-center justify-center p-5"
      style={{
        background: 'linear-gradient(135deg, #fdf8f0 0%, #f5ebe0 50%, #edede9 100%)',
        fontFamily: "'Inter', 'Space Grotesk', sans-serif"
      }}
    >
      <div style={{
        background: 'rgba(255, 253, 249, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(184, 135, 70, 0.18)',
        borderRadius: '24px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 12px 40px rgba(184, 135, 70, 0.08)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '56px', marginBottom: '12px' }}>🧾</div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: '700',
            color: '#2c2c2c',
            letterSpacing: '0.3px'
          }}>Billing Desk</h1>
          <p style={{
            color: '#8a7a6a',
            fontSize: '13px',
            marginTop: '6px'
          }}>Sign in to manage billing & tables</p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#6b5e50',
              display: 'block',
              marginBottom: '8px'
            }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="receptionist@tadkajunction.com"
              style={{
                width: '100%',
                background: '#fafaf8',
                border: '1px solid rgba(184, 135, 70, 0.2)',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#2c2c2c',
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
              color: '#6b5e50',
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
                background: '#fafaf8',
                border: '1px solid rgba(184, 135, 70, 0.2)',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#2c2c2c',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {error && (
            <p style={{
              color: '#c0392b',
              fontSize: '13px',
              background: 'rgba(192, 57, 43, 0.06)',
              border: '1px solid rgba(192, 57, 43, 0.15)',
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
                : 'linear-gradient(135deg, #b88746, #d4a855)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px',
              fontFamily: 'inherit',
              letterSpacing: '0.3px'
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