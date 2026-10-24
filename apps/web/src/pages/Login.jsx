import { useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { PANELS, defaultPanelFor } from '@/lib/roles'
import { unlockAudio } from '@/lib/kitchenAlertSound'
import PageLoader from '@/components/PageLoader'
import Notice from '@/components/Notice'

// Bug #72: setup hints (which env file to check, which Firebase console page to
// open) are for developers. In production a visitor only sees a plain message.
const SETUP_CODES = [
  'auth/invalid-api-key',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.',
  'auth/operation-not-allowed',
  'auth/configuration-not-found',
  'auth/unauthorized-domain',
]

function setupHint(code) {
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Firebase Console me Email/Password sign-in enable nahi hai (Authentication → Sign-in method).'
    case 'auth/configuration-not-found':
      return 'Firebase Authentication set up nahi hai is project me (Console → Authentication → Get started).'
    case 'auth/unauthorized-domain':
      return 'Ye domain Firebase me authorized nahi hai (Authentication → Settings → Authorized domains).'
    default:
      return 'Firebase API key galat ya missing hai. apps/web/.env check karo aur npm run dev dobara chalao.'
  }
}

function errorMessage(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again in a few minutes.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    default:
      break
  }

  if (SETUP_CODES.includes(code)) {
    return import.meta.env.DEV
      ? setupHint(code)
      : 'Sign-in is unavailable right now. Please try again later.'
  }

  return import.meta.env.DEV
    ? `Login failed (${code || 'unknown'}). Browser console (F12) me details dekho.`
    : 'Sign-in failed. Please try again.'
}

export default function Login() {
  const { role } = useParams()
  const panel = PANELS[role]
  const { user, claims, loading, logout } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!panel) return <Navigate to="/" replace />
  if (loading) return <PageLoader label="Checking your session…" />

  const canUse = (panel.canLogin || panel.allows)(claims)

  // Already signed in with the right claims → straight into the panel
  if (user && !claims.disabled && canUse) {
    const base = `/${panel.path.split('/')[1]}`
    const from = location.state?.from
    const dest = typeof from === 'string' && (from === base || from.startsWith(`${base}/`)) ? from : panel.path
    return <Navigate to={dest} replace />
  }

  // Signed in, but this account does not carry the claim for the chosen panel
  if (user) {
    const own = defaultPanelFor(claims)
    return (
      <Notice
        icon="🚫"
        title={claims.disabled ? 'Account disabled' : `Not a ${panel.label} account`}
        body={
          claims.disabled
            ? 'This staff account has been deactivated. Please contact your restaurant admin.'
            : claims.platformAdmin && panel.id === 'admin'
              ? `${user.email} is a Super Admin account (not linked to one restaurant). Use the Super Admin card, then press Manage on a restaurant.`
              : `${user.email} can't open the ${panel.label} panel.${own ? ` It belongs to the ${own.label} panel.` : ' No staff role is assigned to it.'}`
        }
        actions={[
          ...(own && !claims.disabled ? [{ label: `Open ${own.label} panel`, onClick: () => window.location.assign(own.path), primary: true }] : []),
          { label: 'Sign in with a different account', onClick: logout },
        ]}
      />
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy) return
    // This click is the browser "user gesture" that unlocks kitchen alert sounds
    if (role === 'chef' || role === 'reception') unlockAudio()
    setError('')
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      // AuthContext picks up the session and this component redirects above
    } catch (err) {
      console.error('Login error:', err.code, err.message)
      setError(errorMessage(err.code))
      setBusy(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(184,135,70,0.25)',
    color: '#f5f0e8',
    fontSize: 16,
    outline: 'none',
  }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'rgba(232,213,183,0.7)' }

  return (
    <div
      className="theme-gate"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 'clamp(24px, 6vw, 40px)',
          borderRadius: 24,
          background: 'rgba(30,30,40,0.7)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: `1px solid ${panel.accent}33`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <Link
          to="/"
          style={{ display: 'inline-block', marginBottom: 18, fontSize: 13, color: 'rgba(245,240,232,0.55)', textDecoration: 'none' }}
        >
          ← Change role
        </Link>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }} aria-hidden="true">{panel.icon}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8d5b7' }}>{panel.label} sign in</h1>
          <p style={{ marginTop: 6, fontSize: 13, color: 'rgba(232,213,183,0.5)' }}>{panel.tagline}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div>
            <label htmlFor="email" style={labelStyle}>Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 64 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  color: panel.accent,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                fontSize: 13,
                color: '#f87171',
                background: 'rgba(231,76,60,0.1)',
                border: '1px solid rgba(231,76,60,0.25)',
                padding: 12,
                borderRadius: 12,
              }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: '100%',
              padding: 16,
              marginTop: 4,
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 0.3,
              cursor: busy ? 'not-allowed' : 'pointer',
              color: '#1a1208',
              background: busy ? 'rgba(184,135,70,0.45)' : 'linear-gradient(135deg,#b88746,#daa520)',
            }}
          >
            {busy && <span className="dp-spinner" style={{ width: 16, height: 16 }} />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
