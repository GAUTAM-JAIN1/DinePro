function OrderItem({ item, onSetStatus }) {
  const status = item.status || 'new'
  const note = item.specialInstructions || item.instructions

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)'
    }}>
      <span style={{
        background: '#222',
        borderRadius: '6px',
        padding: '2px 8px',
        fontSize: '13px',
        fontWeight: '700',
        color: 'var(--gold-l)',
        minWidth: '34px',
        textAlign: 'center',
        flexShrink: '0'
      }}>
        x{item.quantity}
      </span>

      <div style={{ flex: '1', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text)',
              lineHeight: '1.3'
            }}>
              <span style={vegDotStyle(item.isVeg)} />
              <span style={{ overflowWrap: 'anywhere' }}>{item.name}</span>
            </div>

            <div style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              marginTop: '4px'
            }}>
              {item.variant && <MetaPill>{item.variant}</MetaPill>}
              {item.category && <MetaPill>{item.category}</MetaPill>}
              <MetaPill>{item.isVeg ? 'Veg' : 'Non-veg'}</MetaPill>
            </div>
          </div>

          <span style={statusStyle(status)}>
            {status}
          </span>
        </div>

        {note && (
          <div style={{
            marginTop: '7px',
            background: 'rgba(184,135,70,0.08)',
            border: '1px solid rgba(184,135,70,0.2)',
            borderRadius: '8px',
            padding: '7px 9px',
            fontSize: '11px',
            color: 'var(--gold-l)',
            lineHeight: '1.4'
          }}>
            <strong>Note:</strong> {note}
          </div>
        )}

        {onSetStatus && status !== 'ready' && status !== 'served' && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            {status === 'new' && (
              <button
                type="button"
                onClick={() => onSetStatus('preparing')}
                style={itemActionStyle('var(--yellow)', '#1a0f00')}
              >
                Start preparing
              </button>
            )}
            <button
              type="button"
              onClick={() => onSetStatus('ready')}
              style={itemActionStyle('var(--green)', '#fff')}
            >
              Mark ready
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MetaPill({ children }) {
  return (
    <span style={{
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.05)',
      color: 'var(--text3)',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.2px',
      padding: '2px 7px',
      textTransform: 'uppercase'
    }}>
      {children}
    </span>
  )
}

const vegDotStyle = (isVeg) => ({
  width: '9px',
  height: '9px',
  borderRadius: '50%',
  background: isVeg ? 'var(--green)' : 'var(--red)',
  boxShadow: `0 0 0 2px ${isVeg ? 'rgba(39,174,96,0.15)' : 'rgba(231,76,60,0.15)'}`,
  flexShrink: 0,
})

const statusStyle = (status) => ({
  borderRadius: '999px',
  padding: '2px 8px',
  fontSize: '9px',
  fontWeight: '700',
  textTransform: 'uppercase',
  color: status === 'ready' ? 'var(--green)' : status === 'preparing' ? 'var(--yellow)' : 'var(--text3)',
  background: status === 'ready' ? 'rgba(39,174,96,0.12)' : status === 'preparing' ? 'rgba(243,156,18,0.12)' : 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
})

const itemActionStyle = (background, color) => ({
  border: 'none',
  borderRadius: '8px',
  background,
  color,
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '11px',
  fontWeight: '700',
  padding: '6px 10px',
})

export default OrderItem
