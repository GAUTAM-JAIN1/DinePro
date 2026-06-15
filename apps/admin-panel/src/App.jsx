import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MenuManager from './pages/MenuManager'
import TableManager from './pages/TableManager'
import StaffManagement from './pages/StaffManagement'
import RestaurantSettings from './pages/RestaurantSettings'
import SuperAdmin from './pages/SuperAdmin'
import SetupWizard from './pages/SetupWizard'
import Sidebar from './components/sidebar'
import api from './lib/api'

function CenterMessage({ title, body, logout }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
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

function App() {
  const { user, role, restaurantId, platformAdmin, loading, logout } = useAuth()
  const [currentRestaurant, setCurrentRestaurant] = useState(null)
  const [restaurantLoading, setRestaurantLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!user || !restaurantId) {
      setCurrentRestaurant(null)
      return
    }

    let cancelled = false
    setRestaurantLoading(true)

    api.get(`/api/restaurants/${restaurantId}`)
      .then((res) => {
        if (!cancelled) setCurrentRestaurant(res.data.restaurant)
      })
      .catch(() => {
        if (!cancelled) setCurrentRestaurant(null)
      })
      .finally(() => {
        if (!cancelled) setRestaurantLoading(false)
      })

    return () => { cancelled = true }
  }, [user, restaurantId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">...</div>
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  if (role !== 'admin' && !platformAdmin) {
    return <CenterMessage title="Access Denied" body="This panel is for admins only." logout={logout} />
  }

  if (!platformAdmin && !restaurantId) {
    return <CenterMessage title="Restaurant not assigned" body="This admin user needs a restaurantId claim before opening restaurant operations." logout={logout} />
  }

  if (!platformAdmin && restaurantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">...</div>
          <div className="text-gray-400 text-sm">Loading restaurant...</div>
        </div>
      </div>
    )
  }

  if (!platformAdmin && !currentRestaurant) {
    return <CenterMessage title="Restaurant not found" body="The restaurant attached to this account could not be loaded." logout={logout} />
  }

  const shellRestaurant = currentRestaurant || { id: 'platform', name: 'Platform Admin', themeColor: '#FF6B35' }
  const needsSetup = currentRestaurant?.onboardingCompleted === false

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; }
        .app-layout { display: flex; min-height: 100vh; width: 100%; }
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
            width: 40px;
            height: 40px;
            background: #111827;
            border: 1px solid #374151;
            border-radius: 10px;
            cursor: pointer;
            color: white;
            font-size: 18px;
          }
          .main-area { padding-top: 64px; }
        }
      `}</style>

      <div className="app-layout">
        {/* Hamburger button — mobile only */}
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
          ☰
        </button>

        <Sidebar
          restaurant={shellRestaurant}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="main-area">
          <Routes>
            <Route path="/" element={<Navigate to={platformAdmin ? '/super-admin' : needsSetup ? '/setup' : '/dashboard'} />} />
            <Route path="/setup" element={currentRestaurant ? <SetupWizard restaurant={currentRestaurant} setRestaurant={setCurrentRestaurant} /> : <Navigate to="/super-admin" />} />
            <Route path="/dashboard" element={currentRestaurant ? (needsSetup ? <Navigate to="/setup" /> : <Dashboard restaurant={currentRestaurant} />) : <Navigate to="/super-admin" />} />
            <Route path="/menu" element={currentRestaurant ? (needsSetup ? <Navigate to="/setup" /> : <MenuManager restaurant={currentRestaurant} />) : <Navigate to="/super-admin" />} />
            <Route path="/tables" element={currentRestaurant ? (needsSetup ? <Navigate to="/setup" /> : <TableManager restaurant={currentRestaurant} />) : <Navigate to="/super-admin" />} />
            <Route path="/staff" element={currentRestaurant ? (needsSetup ? <Navigate to="/setup" /> : <StaffManagement restaurant={currentRestaurant} />) : <Navigate to="/super-admin" />} />
            <Route path="/settings" element={currentRestaurant ? <RestaurantSettings restaurant={currentRestaurant} setRestaurant={setCurrentRestaurant} /> : <Navigate to="/super-admin" />} />
            <Route path="/super-admin" element={platformAdmin ? <SuperAdmin /> : <Navigate to="/dashboard" />} />
          </Routes>
        </div>
      </div>
    </>
  )
}

export default App