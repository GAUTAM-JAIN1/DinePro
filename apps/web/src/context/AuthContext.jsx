import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { disconnectAllSockets } from '@/lib/socket'

const AuthContext = createContext(null)

const EMPTY_CLAIMS = { role: null, restaurantId: null, platformAdmin: false, disabled: false }

function claimsFromToken(tokenResult) {
  const c = tokenResult.claims
  const role = c.role || null
  return {
    role,
    restaurantId: c.restaurantId || null,
    platformAdmin: Boolean(c.platformAdmin || c.superAdmin || role === 'superadmin'),
    disabled: Boolean(c.disabled),
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [claims, setClaims] = useState(EMPTY_CLAIMS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult()
          setClaims(claimsFromToken(tokenResult))
        } catch (err) {
          console.error('Failed to read claims:', err)
          setClaims(EMPTY_CLAIMS)
        }
        setUser(firebaseUser)
      } else {
        setUser(null)
        setClaims(EMPTY_CLAIMS)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  /** Force-refresh the token (e.g. right after an admin changed this user's claims). */
  const refreshClaims = useCallback(async () => {
    if (!auth.currentUser) return EMPTY_CLAIMS
    const tokenResult = await auth.currentUser.getIdTokenResult(true)
    const next = claimsFromToken(tokenResult)
    setClaims(next)
    return next
  }, [])

  const logout = useCallback(async () => {
    disconnectAllSockets()
    await signOut(auth)
  }, [])

  const value = useMemo(
    () => ({
      user,
      claims,
      role: claims.role,
      restaurantId: claims.restaurantId,
      platformAdmin: claims.platformAdmin,
      disabled: claims.disabled,
      loading,
      logout,
      refreshClaims,
    }),
    [user, claims, loading, logout, refreshClaims]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
