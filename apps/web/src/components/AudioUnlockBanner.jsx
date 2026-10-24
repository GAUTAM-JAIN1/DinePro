import { useEffect, useState } from 'react'
import { isAudioBlocked, onAudioBlockedChange, unlockAudio } from '@/lib/kitchenAlertSound'

/**
 * Shown when the browser has muted kitchen alerts, typically after a saved
 * session is restored without a click. One tap turns them back on (Bug #66).
 */
export default function AudioUnlockBanner() {
  const [blocked, setBlocked] = useState(isAudioBlocked())

  useEffect(() => onAudioBlockedChange(setBlocked), [])

  if (!blocked) return null

  return (
    <div
      role="alert"
      style={{
        position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 16px',
        background: '#FEF3C7', borderBottom: '1px solid #F59E0B', color: '#78350F', fontSize: 14,
      }}
    >
      <span>Alert sound band hai. Naye order ki awaaz sunne ke liye ek baar tap karo.</span>
      <button
        type="button"
        onClick={() => unlockAudio()}
        style={{
          padding: '8px 14px', borderRadius: 10, border: 'none', background: '#B45309',
          color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}
      >
        Sound on karo
      </button>
    </div>
  )
}
