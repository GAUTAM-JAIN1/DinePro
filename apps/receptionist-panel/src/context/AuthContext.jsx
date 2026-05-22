import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [restaurantId, setRestaurantId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult()
        const userRole = tokenResult.claims.role || null
        const userRestaurantId = tokenResult.claims.restaurantId || null
        setUser(firebaseUser)
        setRole(userRole)
        setRestaurantId(userRestaurantId)
      } else {
        setUser(null)
        setRole(null)
        setRestaurantId(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, role, restaurantId, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
