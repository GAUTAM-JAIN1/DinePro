import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'

const RESTAURANT_LINKS = [
  { to: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/admin/menu', icon: '🍽️', label: 'Menu Manager' },
  { to: '/admin/tables', icon: '🪑', label: 'Tables & QR' },
  { to: '/admin/staff', icon: '👥', label: 'Staff' },
  { to: '/admin/settings', icon: '⚙️', label: 'Settings' },
]

const SUPER_LINK = { to: '/admin/super-admin', icon: '👑', label: 'Super Admin' }

function Item({ link, onClick }) {
  return (
    <NavLink
      to={link.to}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '11px 16px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '500',
        textDecoration: 'none',
      }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            // One pill that glides between items instead of each item flashing on/off
            <motion.span
              layoutId="admin-nav-pill"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              style={{ position: 'absolute', inset: 0, background: '#F97316', borderRadius: '12px', zIndex: 0 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1, fontSize: '18px' }}>{link.icon}</span>
          <span style={{ position: 'relative', zIndex: 1, color: isActive ? 'white' : '#9CA3AF', transition: 'color 0.2s' }}>
            {link.label}
          </span>
        </>
      )}
    </NavLink>
  )
}

function Sidebar({ restaurant, isOpen, onClose, platformAdmin, managing, onBackToSuperAdmin }) {
  const { user, logout } = useAuth()

  // Super admin with no restaurant open → platform view only
  const platformView = platformAdmin && !managing

  const handleSuperAdminClick = () => {
    onBackToSuperAdmin?.()
    onClose?.()
  }

  return (
    <>
      <style>{`
        .sidebar-panel {
          position: fixed;
          left: 0;
          top: 0;
          height: 100vh;
          height: 100dvh;
          width: 256px;
          background: #111827;
          color: white;
          display: flex;
          flex-direction: column;
          z-index: 100;
          transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sidebar-backdrop { display: none; }
        @media (max-width: 768px) {
          .sidebar-panel { transform: translateX(-100%); }
          .sidebar-panel.open { transform: translateX(0); box-shadow: 8px 0 32px rgba(0,0,0,0.35); }
          .sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 90;
            animation: dp-fade-in 0.2s ease both;
          }
        }
        @media (min-width: 769px) {
          .sidebar-panel { transform: translateX(0) !important; }
        }
      `}</style>

      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

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
            {platformView ? 'Super Admin' : managing ? 'Managing as Super Admin' : 'Admin Panel'}
          </p>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          {platformView ? (
            <>
              <Item link={SUPER_LINK} onClick={handleSuperAdminClick} />
              <p style={{ color: '#6B7280', fontSize: '12px', lineHeight: 1.5, padding: '12px 16px 0', margin: 0 }}>
                Press <strong style={{ color: '#9CA3AF' }}>Manage</strong> on a restaurant to open its
                Dashboard, Menu, Tables, Staff and Settings.
              </p>
            </>
          ) : (
            <>
              {managing && (
                <button
                  onClick={handleSuperAdminClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px', marginBottom: '8px', borderRadius: '12px',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    color: '#FBBF24', background: 'rgba(251,191,36,0.08)',
                    border: '1px solid rgba(251,191,36,0.25)', textAlign: 'left',
                  }}
                >
                  <span aria-hidden="true">←</span> Back to Super Admin
                </button>
              )}
              {RESTAURANT_LINKS.map((link) => (
                <Item key={link.to} link={link} onClick={onClose} />
              ))}
            </>
          )}
        </nav>

        {/* User Info + Logout */}
        <div style={{ padding: '16px', borderTop: '1px solid #374151' }}>
          {user && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ color: '#D1D5DB', fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </p>
              <p style={{ color: '#6B7280', fontSize: '12px', marginTop: '2px', marginBottom: 0 }}>
                {platformAdmin ? 'Super Admin' : 'Admin'}
              </p>
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
