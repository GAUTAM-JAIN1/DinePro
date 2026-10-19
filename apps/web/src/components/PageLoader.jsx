import { motion } from 'framer-motion'

/** Full-screen branded loader used while a panel chunk or a session is loading. */
export default function PageLoader({ label = 'Loading…' }) {
  return (
    <div
      className="theme-gate"
      role="status"
      aria-live="polite"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{ fontSize: 44, marginBottom: 14 }} aria-hidden="true">🍽️</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div className="dp-spinner" />
        </div>
        <p style={{ color: 'rgba(245,240,232,0.55)', fontSize: 13, letterSpacing: 0.3 }}>{label}</p>
      </motion.div>
    </div>
  )
}
