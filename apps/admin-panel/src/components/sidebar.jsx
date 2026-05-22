import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Sidebar({ restaurant }) {
  const { user, platformAdmin, logout } = useAuth()

  const links = [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/menu', icon: '🍽️', label: 'Menu Manager' },
    { to: '/tables', icon: '🪑', label: 'Tables & QR' },
    { to: '/staff', icon: '👥', label: 'Staff' },
    { to: '/settings', icon: '⚙️', label: 'Settings' },
    { to: '/super-admin', icon: '👑', label: 'Super Admin' },
  ]

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
          style={{ backgroundColor: restaurant.themeColor }}
        >
          🍽️
        </div>
        <h1 className="font-bold text-lg leading-tight">{restaurant.name}</h1>
        <p className="text-gray-400 text-xs mt-1">Admin Panel</p>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-4 space-y-1">
        {links.filter(link => platformAdmin || link.to !== '/super-admin').map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition
              ${isActive
                ? 'bg-orange-500 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span className="text-lg">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* User Info + Logout */}
      <div className="p-4 border-t border-gray-700">
        {user && (
          <div className="mb-3">
            <p className="text-gray-300 text-xs truncate">{user.email}</p>
            <p className="text-gray-500 text-xs mt-0.5">Admin</p>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition"
        >
          🚪 Sign Out
        </button>
        <p className="text-gray-600 text-xs text-center mt-3">
          Restaurant SaaS v1.0
        </p>
      </div>
    </div>
  )
}

export default Sidebar
