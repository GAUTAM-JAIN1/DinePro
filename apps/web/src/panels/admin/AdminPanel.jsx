import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import Dashboard from './pages/Dashboard'
import MenuManager from './pages/MenuManager'
import TableManager from './pages/TableManager'
import StaffManagement from './pages/StaffManagement'
import RestaurantSettings from './pages/RestaurantSettings'
import SuperAdmin from './pages/SuperAdmin'
import SetupWizard from './pages/SetupWizard'
import Sidebar from './components/sidebar'
import api from '@/lib/api'
import PageTransition from '@/components/PageTransition'
import { ContentSkeleton } from '@/components/Skeleton'

const SELECTED_KEY = 'dp.selectedRestaurant'

// A super admin's "currently managed restaurant" survives a page refresh (per tab).
function readSelected() {
  try { return sessionStorage.getItem(SELECTED_KEY) } catch { return null }
}
function writeSelected(id) {
  try {
    if (id) sessionStorage.setItem(SELECTED_KEY, id)
    else sessionStorage.removeItem(SELECTED_KEY)
  } catch { /* storage blocked — selection just won't persist */ }
}

function CenterMessage({ title, body, logout }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-6">
        <div className="text-5xl mb-4">!</div>
        <p className="text-gray-700 font-semibold">{title}</p>
        {body && <p className="text-gray-400 text-sm mt-1">{body}</p>}
        {logout && (
          <button onClick={logout} className="mt-4 text-orange-500 text-sm underline">
            Sign out
          </button>
        )}
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const { user, restaurantId, platformAdmin, loading, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Super admin: which restaurant is currently being managed (null = platform view)
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(readSelected)

  const selectRestaurant = useCallback((id) => {
    writeSelected(id)
    setSelectedRestaurantId(id)
  }, [])

  // Restaurant admins always use their own restaurant; super admins use the selected one
  const activeRestaurantId = platformAdmin ? selectedRestaurantId : restaurantId

  // `fetched.id` says WHICH restaurant `fetched.data` belongs to, so we always know
  // whether the data on screen is the one we asked for (no flash of stale / missing data).
  const [fetched, setFetched] = useState({ id: null, data: null, error: false })
  const restaurantLoading = Boolean(activeRestaurantId) && fetched.id !== activeRestaurantId
  const currentRestaurant = fetched.id === activeRestaurantId ? fetched.data : null

  // Child pages (Settings, Setup wizard) update the restaurant through this
  const setCurrentRestaurant = useCallback((next) => {
    setFetched((f) => ({ ...f, data: typeof next === 'function' ? next(f.data) : next }))
  }, [])

  useEffect(() => {
    if (!user || !activeRestaurantId) return
    let cancelled = false
    api.get(`/api/restaurants/${activeRestaurantId}`)
      .then((res) => {
        if (!cancelled) setFetched({ id: activeRestaurantId, data: res.data.restaurant, error: false })
      })
      .catch(() => {
        if (!cancelled) setFetched({ id: activeRestaurantId, data: null, error: true })
      })
    return () => { cancelled = true }
  }, [user, activeRestaurantId])

  // A super admin who picked a restaurant that can't be loaded goes back to the platform view
  useEffect(() => {
    if (platformAdmin && selectedRestaurantId && fetched.id === selectedRestaurantId && fetched.error) {
      selectRestaurant(null)
    }
  }, [platformAdmin, selectedRestaurantId, fetched, selectRestaurant])

  if (loading) return <ContentSkeleton />

  if (!platformAdmin && !restaurantId) {
    return <CenterMessage title="Restaurant not assigned" body="This admin user needs a restaurantId claim before opening restaurant operations." logout={logout} />
  }

  if (!platformAdmin && restaurantLoading) {
    return <ContentSkeleton />
  }

  if (!platformAdmin && !currentRestaurant) {
    return <CenterMessage title="Restaurant not found" body="The restaurant attached to this account could not be loaded." logout={logout} />
  }

  const managing = platformAdmin && Boolean(activeRestaurantId)
  const shellRestaurant = currentRestaurant || { id: 'platform', name: 'Platform Admin', themeColor: '#FF6B35' }
  const needsSetup = currentRestaurant?.onboardingCompleted === false

  // Wraps every restaurant-scoped page:
  //  - while the restaurant is loading → skeleton (NOT a redirect, that caused the "Manage needs two clicks" bug)
  //  - nothing selected (super admin) → back to the platform view
  const withRestaurant = (render, { skipSetup = false } = {}) => {
    if (restaurantLoading) return <ContentSkeleton />
    if (!currentRestaurant) return <Navigate to="/admin/super-admin" replace />
    if (needsSetup && !skipSetup) return <Navigate to="/admin/setup" replace />
    return render(currentRestaurant)
  }

  const indexTarget = platformAdmin
    ? (activeRestaurantId ? '/admin/dashboard' : '/admin/super-admin')
    : (needsSetup ? '/admin/setup' : '/admin/dashboard')

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; }
        .app-layout { display: flex; min-height: 100vh; min-height: 100dvh; width: 100%; }
        .main-area {
          flex: 1;
          margin-left: 256px;
          min-width: 0;
          max-width: 100%;
        }
        .hamburger-btn { display: none; }

        @media (max-width: 768px) {
          .main-area { margin-left: 0; width: 100%; }
          .hamburger-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            position: fixed;
            top: 12px;
            left: 12px;
            z-index: 80;
            width: 44px;
            height: 44px;
            background: #111827;
            border: 1px solid #374151;
            border-radius: 12px;
            cursor: pointer;
            color: white;
            font-size: 18px;
          }
          .main-area { padding-top: 64px; }
        }
      `}</style>

      <div className="app-layout theme-admin">
        {/* Hamburger button — mobile only */}
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          ☰
        </button>

        <Sidebar
          restaurant={shellRestaurant}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          platformAdmin={platformAdmin}
          managing={managing}
          onBackToSuperAdmin={platformAdmin ? () => selectRestaurant(null) : null}
        />

        <div className="main-area">
          <PageTransition key={location.pathname}>
            <Routes>
              <Route index element={<Navigate to={indexTarget} replace />} />
              <Route
                path="super-admin"
                element={
                  platformAdmin
                    ? <SuperAdmin onManageRestaurant={selectRestaurant} />
                    : <Navigate to="/admin/dashboard" replace />
                }
              />
              <Route path="setup" element={withRestaurant((r) => <SetupWizard restaurant={r} setRestaurant={setCurrentRestaurant} />, { skipSetup: true })} />
              <Route path="dashboard" element={withRestaurant((r) => <Dashboard restaurant={r} />)} />
              <Route path="menu" element={withRestaurant((r) => <MenuManager restaurant={r} />)} />
              <Route path="tables" element={withRestaurant((r) => <TableManager restaurant={r} />)} />
              <Route path="staff" element={withRestaurant((r) => <StaffManagement restaurant={r} />)} />
              <Route path="settings" element={withRestaurant((r) => <RestaurantSettings restaurant={r} setRestaurant={setCurrentRestaurant} />, { skipSetup: true })} />
              <Route path="*" element={<Navigate to={indexTarget} replace />} />
            </Routes>
          </PageTransition>
        </div>
      </div>
    </>
  )
}
