import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Sidebar({ restaurant, isOpen, onClose }) {
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
    <>
      <style>{`
        .sidebar-panel {
          position: fixed;
          left: 0;
          top: 0;
          height: 100vh;
          width: 256px;
          background: #111827;
          color: white;
          display: flex;
          flex-direction: column;
          z-index: 100;
          transition: transform 0.3s ease;
        }
        .sidebar-backdrop {
          display: none;
        }
        @media (max-width: 768px) {
          .sidebar-panel {
            transform: translateX(-100%);
          }
          .sidebar-panel.open {
            transform: translateX(0);
          }
          .sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 90;
          }
        }
        @media (min-width: 769px) {
          .sidebar-panel {
            transform: translateX(0) !important;
          }
        }
      `}</style>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}

      <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div style={{ padding: '24px', borderBottom: '1px solid #374151' }}>
          <div
            style={{
              width: '40px', height: '40px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', marginBottom: '12px',
              backgroundColor: restaurant.themeColor
            }}
          >
            🍽️
          </div>
          <h1 style={{ fontWeight: '700', fontSize: '18px', lineHeight: '1.2', margin: 0 }}>
            {restaurant.name}
          </h1>
          <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
            Admin Panel
          </p>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {links.filter(link => platformAdmin || link.to !== '/super-admin').map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                transition: 'all 0.15s',
                background: isActive ? '#F97316' : 'transparent',
                color: isActive ? 'white' : '#9CA3AF',
              })}
            >
              <span style={{ fontSize: '18px' }}>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* User Info + Logout */}
        <div style={{ padding: '16px', borderTop: '1px solid #374151' }}>
          {user && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ color: '#D1D5DB', fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </p>
              <p style={{ color: '#6B7280', fontSize: '12px', marginTop: '2px', marginBottom: 0 }}>Admin</p>
            </div>
          )}
          <button
            onClick={logout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '12px', fontSize: '14px',
              color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer',
              transition: 'all 0.15s', textAlign: 'left'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#F87171' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9CA3AF' }}
          >
            🚪 Sign Out
          </button>
          <p style={{ color: '#4B5563', fontSize: '12px', textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
            Restaurant SaaS v1.0
          </p>
        </div>
      </div>
    </>
  )
}

export default Sidebar