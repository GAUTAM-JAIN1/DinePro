import { motion } from 'framer-motion'

/**
 * Full-screen message card (access denied, restaurant not assigned, not found…).
 * `actions` = [{ label, onClick, primary? }]
 */
export default function Notice({ icon = '!', title, body, actions = [] }) {
  return (
    <div
      className="theme-gate"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
          padding: '32px 24px',
          borderRadius: 24,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(184,135,70,0.22)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 14 }} aria-hidden="true">{icon}</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e8d5b7' }}>{title}</h1>
        {body && (
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: 'rgba(232,213,183,0.6)' }}>{body}</p>
        )}
        {actions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                style={{
                  padding: '13px 18px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: a.primary ? 'none' : '1px solid rgba(184,135,70,0.35)',
                  background: a.primary ? 'linear-gradient(135deg,#b88746,#daa520)' : 'transparent',
                  color: a.primary ? '#1a1208' : '#d4a15a',
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
