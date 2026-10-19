import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { PANELS, PANEL_ORDER, defaultPanelFor } from '@/lib/roles'

const MotionLink = motion.create(Link)

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

const cardStyle = (accent) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  width: '100%',
  padding: '18px 18px',
  borderRadius: 20,
  textAlign: 'left',
  textDecoration: 'none',
  color: '#f5f0e8',
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: `0 0 0 0 ${accent}`,
  WebkitTapHighlightColor: 'transparent',
})

function CardBody({ icon, title, subtitle, accent }) {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 52,
          height: 52,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          background: `${accent}22`,
          border: `1px solid ${accent}44`,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 13, marginTop: 2, color: 'rgba(245,240,232,0.55)' }}>
          {subtitle}
        </span>
      </span>
      <span aria-hidden="true" style={{ color: accent, fontSize: 20 }}>›</span>
    </>
  )
}

function CustomerCard() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [restaurantId, setRestaurantId] = useState('')
  const [table, setTable] = useState('')
  const accent = '#4ADE80'

  const go = (e) => {
    e.preventDefault()
    const r = restaurantId.trim()
    const t = table.trim()
    if (!r || !t) return
    navigate(`/r/${encodeURIComponent(r)}/table/${encodeURIComponent(t)}`)
  }

  const inputStyle = {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#f5f0e8',
    fontSize: 16,
    outline: 'none',
  }

  return (
    <motion.div
      variants={item}
      layout
      style={{
        borderRadius: 20,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        gridColumn: '1 / -1',
      }}
    >
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        whileTap={{ scale: 0.98 }}
        style={{ ...cardStyle(accent), border: 'none', background: 'transparent' }}
      >
        <CardBody icon="🍽️" title="I'm a Customer" subtitle="No login needed — scan the QR code on your table" accent={accent} />
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            onSubmit={go}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '4px 18px 18px', display: 'grid', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.55)' }}>
                Scanning the QR opens your menu automatically. No QR handy? Enter the details below.
              </p>
              <input
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                placeholder="Restaurant ID"
                aria-label="Restaurant ID"
                autoCapitalize="none"
                autoCorrect="off"
                style={inputStyle}
              />
              <input
                value={table}
                onChange={(e) => setTable(e.target.value)}
                placeholder="Table number"
                aria-label="Table number"
                inputMode="numeric"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={!restaurantId.trim() || !table.trim()}
                style={{
                  padding: '13px 18px',
                  borderRadius: 12,
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  color: '#0d1f12',
                  background: 'linear-gradient(135deg,#4ade80,#22c55e)',
                  opacity: !restaurantId.trim() || !table.trim() ? 0.5 : 1,
                }}
              >
                Open menu
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function RoleSelect() {
  const { user, claims, loading, logout } = useAuth()
  const own = user ? defaultPanelFor(claims) : null

  return (
    <div
      className="theme-gate"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 18px 32px' }}
    >
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{ textAlign: 'center', marginBottom: 28 }}
      >
        <div style={{ fontSize: 46, marginBottom: 8 }} aria-hidden="true">🍽️</div>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(34px, 8vw, 48px)',
            fontWeight: 600,
            letterSpacing: 0.5,
            lineHeight: 1.1,
          }}
        >
          Dine<span style={{ color: '#d4a15a' }}>Pro</span>
        </h1>
        <p style={{ marginTop: 10, fontSize: 16, color: 'rgba(245,240,232,0.6)' }}>Who are you?</p>
      </motion.header>

      <AnimatePresence>
        {!loading && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ width: '100%', maxWidth: 760, overflow: 'hidden' }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                marginBottom: 18,
                borderRadius: 16,
                background: 'rgba(212,161,90,0.1)',
                border: '1px solid rgba(212,161,90,0.3)',
                fontSize: 13,
              }}
            >
              <span style={{ flex: 1, minWidth: 160, color: 'rgba(245,240,232,0.8)', wordBreak: 'break-all' }}>
                Signed in as <strong>{user.email}</strong>
              </span>
              {own && (
                <Link to={own.path} style={{ color: '#d4a15a', fontWeight: 600, textDecoration: 'none' }}>
                  Open {own.label} panel →
                </Link>
              )}
              <button
                onClick={logout}
                style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.55)', cursor: 'pointer', fontSize: 13 }}
              >
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{
          width: '100%',
          maxWidth: 760,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 14,
        }}
      >
        <CustomerCard />

        {PANEL_ORDER.map((id) => {
          const p = PANELS[id]
          return (
            <motion.div key={id} variants={item}>
              <MotionLink
                to={`/login/${id}`}
                whileHover={{ y: -3, borderColor: `${p.accent}88`, boxShadow: `0 10px 30px ${p.accent}22` }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                style={cardStyle(p.accent)}
              >
                <CardBody icon={p.icon} title={p.label} subtitle={p.tagline} accent={p.accent} />
              </MotionLink>
            </motion.div>
          )
        })}
      </motion.div>

      <p style={{ marginTop: 28, fontSize: 12, color: 'rgba(245,240,232,0.35)', textAlign: 'center' }}>
        Staff accounts are created by your restaurant admin.
      </p>
    </div>
  )
}
