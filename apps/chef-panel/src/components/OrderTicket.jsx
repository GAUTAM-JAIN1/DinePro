import { useEffect, useMemo, useState } from 'react'
import StatusBadge from './StatusBadge'
import OrderItem from './OrderItem'

const QUICK_REPLIES = ['5 min more', 'Out of stock', 'Coming soon']
const URGENT_AFTER_SECONDS = 15 * 60

function OrderTicket({ order, visibleItems, onMarkPreparing, onMarkReady, onUpdateItemStatus, onSendChefMessage }) {
  const [elapsed, setElapsed] = useState(() => getElapsedSeconds(order.createdAt))
  const [customMessage, setCustomMessage] = useState('')
  const [sentReply, setSentReply] = useState(null)

  useEffect(() => {
    setElapsed(getElapsedSeconds(order.createdAt))
    const interval = setInterval(() => {
      setElapsed(getElapsedSeconds(order.createdAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [order.createdAt])

  const itemsToShow = visibleItems?.length ? visibleItems : order.items || []
  const isUrgent = elapsed >= URGENT_AFTER_SECONDS
  const timerColor = isUrgent ? 'var(--red)' : elapsed >= 10 * 60 ? 'var(--yellow)' : 'var(--text2)'

  const newItemKeys = useMemo(() => {
    return new Set((order.newItems || []).map(item => item.lineId || item.id))
  }, [order.newItems])

  const newItems = itemsToShow.filter(item => newItemKeys.has(item.lineId || item.id))
  const previousItems = newItems.length > 0
    ? itemsToShow.filter(item => !newItemKeys.has(item.lineId || item.id))
    : itemsToShow

  const borderColor = {
    new: 'rgba(231,76,60,0.45)',
    preparing: 'rgba(243,156,18,0.45)',
    ready: 'rgba(39,174,96,0.45)'
  }[order.status] || 'rgba(255,255,255,0.08)'

  const bgColor = isUrgent
    ? 'rgba(231,76,60,0.12)'
    : ({
      new: 'rgba(231,76,60,0.06)',
      preparing: 'rgba(243,156,18,0.06)',
      ready: 'rgba(39,174,96,0.06)'
    }[order.status] || 'var(--bg3)')

  const sendChefMessage = (message) => {
    const trimmed = message.trim()
    if (!trimmed) return

    setSentReply(trimmed)
    onSendChefMessage(order, trimmed)
    setCustomMessage('')
    setTimeout(() => setSentReply(null), 3000)
  }

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${isUrgent ? 'var(--red)' : borderColor}`,
      borderRadius: '8px',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: isUrgent ? '0 0 0 1px rgba(231,76,60,0.22), 0 12px 28px rgba(231,76,60,0.1)' : 'none'
    }}>
      {isUrgent && (
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          height: '3px',
          background: 'linear-gradient(90deg, transparent, var(--red), transparent)',
          animation: 'shimmer 1.6s infinite'
        }} />
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '12px'
      }}>
        <div>
          <div style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text)',
            lineHeight: '1'
          }}>
            Table {order.tableNumber}
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text2)',
            marginTop: '5px'
          }}>
            {itemsToShow.length} shown / {(order.items || []).length} total items
          </div>
        </div>

        <div style={{ textAlign: 'right', minWidth: '92px' }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            color: timerColor,
            fontVariantNumeric: 'tabular-nums',
            animation: isUrgent ? 'blink 1s infinite' : 'none'
          }}>
            {formatElapsed(elapsed)}
          </div>
          <div style={{
            fontSize: '9px',
            color: isUrgent ? 'var(--red)' : 'var(--text3)',
            letterSpacing: '0.5px',
            marginTop: '2px',
            textTransform: 'uppercase',
            fontWeight: '700'
          }}>
            {isUrgent ? 'Urgent' : 'Time since order'}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <StatusBadge status={order.status} />
        {isUrgent && <span style={urgentBadgeStyle}>Over 15 min</span>}
      </div>

      {order.specialInstructions && (
        <div style={noteStyle}>
          <strong>Order note:</strong> {order.specialInstructions}
        </div>
      )}

      <div style={{ marginBottom: '14px' }}>
        {newItems.length > 0 && (
          <>
            <SectionTitle color="var(--red)">New items added</SectionTitle>
            {newItems.map((item, i) => (
              <div key={item.lineId || item.id || i} style={newItemWrapperStyle}>
                <OrderItem
                  item={item}
                  onSetStatus={(status) => onUpdateItemStatus(order, item, status)}
                />
              </div>
            ))}

            {previousItems.length > 0 && (
              <>
                <div style={dividerStyle} />
                <SectionTitle color="var(--text3)">Previous items</SectionTitle>
              </>
            )}
          </>
        )}

        {previousItems.map((item, i) => (
          <OrderItem
            key={item.lineId || item.id || i}
            item={item}
            onSetStatus={(status) => onUpdateItemStatus(order, item, status)}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: order.status === 'ready' ? '1fr' : '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {order.status !== 'ready' && (
          <button
            type="button"
            onClick={() => onMarkPreparing(order)}
            style={actionButtonStyle('var(--yellow)', '#1a0f00')}
          >
            Mark all preparing
          </button>
        )}
        {order.status !== 'ready' ? (
          <button
            type="button"
            onClick={() => onMarkReady(order)}
            style={actionButtonStyle('var(--green)', '#fff')}
          >
            Mark all ready
          </button>
        ) : (
          <div style={readyStateStyle}>
            Ready for pickup
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {QUICK_REPLIES.map(reply => (
          <button
            type="button"
            key={reply}
            onClick={() => sendChefMessage(reply)}
            style={quickReplyStyle(sentReply === reply)}
          >
            {sentReply === reply ? `Sent: ${reply}` : reply}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          sendChefMessage(customMessage)
        }}
        style={{ display: 'flex', gap: '6px' }}
      >
        <input
          value={customMessage}
          onChange={(event) => setCustomMessage(event.target.value)}
          placeholder="Custom message to table"
          style={customInputStyle}
        />
        <button type="submit" style={sendButtonStyle} disabled={!customMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}

function SectionTitle({ children, color }) {
  return (
    <div style={{
      fontSize: '10px',
      fontWeight: '700',
      color,
      letterSpacing: '1px',
      textTransform: 'uppercase',
      marginBottom: '6px'
    }}>
      {children}
    </div>
  )
}

function getElapsedSeconds(createdAt) {
  const start = new Date(createdAt).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / 1000))
}

function formatElapsed(seconds) {
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m ago`
}

const urgentBadgeStyle = {
  borderRadius: '999px',
  padding: '4px 10px',
  background: 'rgba(231,76,60,0.14)',
  border: '1px solid rgba(231,76,60,0.35)',
  color: 'var(--red)',
  fontSize: '10px',
  fontWeight: '800',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
}

const noteStyle = {
  background: 'rgba(184,135,70,0.08)',
  border: '1px solid rgba(184,135,70,0.2)',
  borderRadius: '8px',
  color: 'var(--gold-l)',
  fontSize: '12px',
  lineHeight: '1.4',
  marginBottom: '12px',
  padding: '8px 10px',
}

const newItemWrapperStyle = {
  background: 'rgba(231,76,60,0.08)',
  border: '1px solid rgba(231,76,60,0.25)',
  borderRadius: '8px',
  marginBottom: '4px',
  padding: '2px 6px',
}

const dividerStyle = {
  height: '1px',
  background: 'rgba(255,255,255,0.06)',
  margin: '10px 0',
}

const actionButtonStyle = (background, color) => ({
  width: '100%',
  background,
  color,
  border: 'none',
  borderRadius: '8px',
  padding: '11px 10px',
  fontSize: '12px',
  fontWeight: '800',
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
})

const readyStateStyle = {
  width: '100%',
  background: 'rgba(39,174,96,0.1)',
  border: '1px solid rgba(39,174,96,0.2)',
  borderRadius: '8px',
  padding: '11px 10px',
  fontSize: '12px',
  fontWeight: '700',
  color: 'var(--green)',
  textAlign: 'center',
}

const quickReplyStyle = (active) => ({
  background: active ? 'rgba(184,135,70,0.15)' : '#222',
  border: active ? '1px solid rgba(184,135,70,0.4)' : '1px solid rgba(255,255,255,0.06)',
  borderRadius: '999px',
  padding: '5px 10px',
  fontSize: '10px',
  color: active ? 'var(--gold-l)' : 'var(--text2)',
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: '700',
})

const customInputStyle = {
  minWidth: 0,
  flex: 1,
  background: 'var(--bg3)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '12px',
  outline: 'none',
  padding: '9px 10px',
}

const sendButtonStyle = {
  background: 'var(--gold)',
  border: 'none',
  borderRadius: '8px',
  color: '#160f08',
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '12px',
  fontWeight: '800',
  padding: '9px 12px',
}

export default OrderTicket
