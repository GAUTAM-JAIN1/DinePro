import { Outlet } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'

/**
 * Wraps every staff route with Firebase auth. It is lazy-loaded, so customers
 * (who never log in) never download the Firebase SDK.
 */
export default function StaffLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
