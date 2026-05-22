function StatusBadge({ status }) {
  const config = {
    new: {
      label: 'New order',
      style: {
        background: 'rgba(231,76,60,0.15)',
        color: '#E74C3C',
        border: '1px solid rgba(231,76,60,0.3)',
        animation: 'pulse 1.5s infinite'
      }
    },
    preparing: {
      label: 'Preparing',
      style: {
        background: 'rgba(243,156,18,0.15)',
        color: '#F39C12',
        border: '1px solid rgba(243,156,18,0.3)'
      }
    },
    ready: {
      label: 'Ready',
      style: {
        background: 'rgba(39,174,96,0.15)',
        color: '#27AE60',
        border: '1px solid rgba(39,174,96,0.3)'
      }
    }
  }

  const c = config[status] || config.new

  return (
    <span style={{
      padding: '4px 12px',
      borderRadius: '999px',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      ...c.style
    }}>
      {c.label}
    </span>
  )
}

export default StatusBadge
