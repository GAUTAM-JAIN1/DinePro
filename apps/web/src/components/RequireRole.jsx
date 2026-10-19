import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PANELS, defaultPanelFor } from '@/lib/roles'
import PageLoader from './PageLoader'
import Notice from './Notice'

/**
 * Route guard. `panel` is a key of PANELS. Access is decided ONLY from the
 * Firebase custom claims, never from which card the user clicked.
 */
export default function RequireRole({ panel, children }) {
  const cfg = PANELS[panel]
  const { user, claims, loading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading) return <PageLoader label="Checking your session…" />

  if (!user) {
    return <Navigate to={`/login/${panel}`} replace state={{ from: location.pathname }} />
  }

  if (claims.disabled) {
    return (
      <Notice
        icon="🔒"
        title="Account disabled"
        body="This staff account has been deactivated. Please contact your restaurant admin."
        actions={[{ label: 'Sign out', onClick: logout, primary: true }]}
      />
    )
  }

  if (!cfg.allows(claims)) {
    const own = defaultPanelFor(claims)
    return (
      <Notice
        icon="🚫"
        title="Access denied"
        body={`This account can't open the ${cfg.label} panel.`}
        actions={[
          ...(own ? [{ label: `Open ${own.label} panel`, onClick: () => navigate(own.path), primary: true }] : []),
          { label: 'Sign out', onClick: logout },
        ]}
      />
    )
  }

  return children
}
