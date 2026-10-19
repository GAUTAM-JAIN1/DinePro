import './reception.css'
import { useAuth } from '@/context/AuthContext'
import Notice from '@/components/Notice'
import BillingDashboard from './pages/BillingDashboard'

/** Billing desk. Access is already enforced by <RequireRole panel="reception"> in App.jsx. */
export default function ReceptionPanel() {
  const { user, restaurantId, logout } = useAuth()

  if (!restaurantId) {
    return (
      <Notice
        title="Restaurant not assigned"
        body="This user needs a restaurantId claim before opening the billing desk."
        actions={[{ label: 'Sign out', onClick: logout, primary: true }]}
      />
    )
  }

  return (
    <div className="theme-reception">
      <BillingDashboard restaurantId={restaurantId} onLogout={logout} userEmail={user.email} />
    </div>
  )
}
