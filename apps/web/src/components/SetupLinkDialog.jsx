import { useState } from 'react'
import toast from 'react-hot-toast'

/**
 * Shows a one-time account setup link (Bug #25).
 *
 * Staff accounts no longer get a password from us. The person opens this link
 * and chooses their own. The link is shown once in this dialog, never in a toast,
 * so it can't be lost to a timeout or captured in a screenshot of a notification.
 */
export default function SetupLinkDialog({ title, email, link, onClose }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      toast.error('Copy nahi hua. Link select karke khud copy karo.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-link-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(30,26,23,0.45)', zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%',
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        }}
      >
        <h3 id="setup-link-title" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#1E1A17' }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.5, color: '#6E6256' }}>
          Ye link <strong>{email}</strong> ko bhejo. Wo ek baar khol kar apna password khud set karenge.
          Ye link sirf abhi dikh raha hai, close karne se pehle copy kar lo. Kaam na kare to staff list se
          "Setup link" dobara bana sakte ho.
        </p>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
            border: '1px solid #E4DCCF', fontSize: 13, marginBottom: 14, fontFamily: 'monospace',
          }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={copy}
            style={{
              padding: '10px 16px', borderRadius: 10, border: '1px solid #E4DCCF', background: '#fff',
              fontWeight: 600, cursor: 'pointer', color: '#1E1A17',
            }}
          >
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none', background: '#B88746',
              fontWeight: 600, cursor: 'pointer', color: '#fff',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
