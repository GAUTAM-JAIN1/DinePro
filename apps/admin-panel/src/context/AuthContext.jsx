import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // Firebase user object
  const [role, setRole] = useState(null)        // 'admin' | 'chef' | 'receptionist'
  const [restaurantId, setRestaurantId] = useState(null)
  const [platformAdmin, setPlatformAdmin] = useState(false)
  const [loading, setLoading] = useState(true)  // while Firebase checks session

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Read role from custom claims
        const tokenResult = await firebaseUser.getIdTokenResult()
        const userRole = tokenResult.claims.role || null
        const userRestaurantId = tokenResult.claims.restaurantId || null
        setUser(firebaseUser)
        setRole(userRole)
        setRestaurantId(userRestaurantId)
        setPlatformAdmin(Boolean(tokenResult.claims.platformAdmin || tokenResult.claims.superAdmin || userRole === 'superadmin'))
      } else {
        setUser(null)
        setRole(null)
        setRestaurantId(null)
        setPlatformAdmin(false)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, role, restaurantId, platformAdmin, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
