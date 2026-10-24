import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createSocket, ensureConnected } from '@/lib/socket'
import api from '@/lib/api'

const STATUS_STEPS = [
  { key: 'new',       icon: '✓',  label: 'Order Received' },
  { key: 'preparing', icon: '🍳', label: 'Being Prepared' },
  { key: 'ready',     icon: '🚀', label: 'Ready to Serve' },
  { key: 'served',    icon: '🍽️', label: 'Served'         },
]

const STATUS_ORDER = ['new', 'preparing', 'ready', 'served', 'closed']

const ITEM_STATUS_STYLES = {
  new:       { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,253,249,0.4)', label: 'Waiting'   },
  preparing: { bg: 'rgba(184,135,70,0.15)',  color: '#b88746',               label: 'Preparing' },
  ready:     { bg: 'rgba(34,197,94,0.12)',   color: '#4ade80',               label: 'Ready'     },
  served:    { bg: 'rgba(99,102,241,0.12)',  color: '#a5b4fc',               label: 'Served'    },
}

let _socket = null

function getSocket() {
  if (!_socket) _socket = createSocket()
  return ensureConnected(_socket)
}

const calcTotal = (items = []) =>
  items.reduce((sum, item) => sum + (item.price ?? 0) * (item.quantity ?? 1), 0)

const formatPrice = (amount) =>
  `₹${Math.round(amount).toLocaleString('en-IN')}`

const getStepState = (stepKey, currentStatus) => {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus)
  const stepIdx    = STATUS_ORDER.indexOf(stepKey)
  if (stepIdx < currentIdx)  return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

function StatusStep({ step, state }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', transition: 'all 0.3s ease' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
        background: state === 'done' ? 'var(--gold, #b88746)' : state === 'active' ? 'rgba(184,135,70,0.15)' : 'rgba(255,255,255,0.05)',
        border: state === 'active' ? '1px solid rgba(184,135,70,0.4)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px',
        color: state === 'done' ? '#1a1208' : state === 'active' ? 'rgba(255,253,249,0.9)' : 'rgba(255,253,249,0.25)',
        fontWeight: '700',
        animation: state === 'active' ? 'pulse 2s infinite' : 'none',
      }}>
        {state === 'done' ? '✓' : step.icon}
      </div>
      <span style={{
        fontSize: '14px',
        color: state === 'done' ? '#FFFDF9' : state === 'active' ? 'var(--gold-l, #c9a05a)' : 'rgba(255,253,249,0.3)',
        fontWeight: state !== 'pending' ? '500' : '400',
      }}>
        {step.label}
      </span>
      {state === 'active' && (
        <div style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: 'var(--gold, #b88746)',
          animation: 'pulse 1.5s infinite', marginLeft: 'auto',
        }} />
      )}
    </div>
  )
}

function ItemRow({ item }) {
  const style = ITEM_STATUS_STYLES[item.status] ?? ITEM_STATUS_STYLES.new
  const total = (item.price ?? 0) * (item.quantity ?? 1)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '13px', color: '#FFFDF9' }}>{item.name}</span>
        {item.quantity > 1 && (
          <span style={{ fontSize: '12px', color: 'rgba(255,253,249,0.4)', marginLeft: '4px' }}>×{item.quantity}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: style.bg, color: style.color, whiteSpace: 'nowrap' }}>
          {style.label}
        </span>
        <span style={{ fontSize: '13px', color: 'rgba(255,253,249,0.5)', minWidth: '40px', textAlign: 'right' }}>
          {formatPrice(total)}
        </span>
      </div>
    </div>
  )
}

function ChefToast({ message, onDismiss }) {
  if (!message) return null
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(184,135,70,0.15), rgba(184,135,70,0.08))',
      border: '1px solid rgba(184,135,70,0.4)', borderRadius: '14px',
      padding: '14px 20px', marginBottom: '16px', animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--gold-l, #c9a05a)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>
            🍳 Message from Chef
          </div>
          <div style={{ fontSize: '15px', fontWeight: '500', color: '#FFFDF9' }}>{message}</div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'rgba(255,253,249,0.4)', fontSize: '18px', cursor: 'pointer', padding: '0 0 0 12px', lineHeight: 1 }}>×</button>
      </div>
    </div>
  )
}

function WaiterCalledBanner({ visible }) {
  if (!visible) return null
  return (
    <div style={{
      background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
      textAlign: 'center', animation: 'fadeIn 0.3s ease',
    }}>
      <span style={{ fontSize: '13px', color: '#a5b4fc' }}>🔔 Waiter notified — someone will be with you shortly!</span>
    </div>
  )
}

function OrderConfirmed() {
  const navigate = useNavigate()
  const { restaurantId, tableId } = useParams()

  const [orderStatus,  setOrderStatus]  = useState('new')
  const [orderItems,   setOrderItems]   = useState([])
  const [chefMessage,  setChefMessage]  = useState(null)
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [connected,    setConnected]    = useState(false)
  // Bug #52: show the table number from the table document, never the document id from the URL.
  const [tableNumber,  setTableNumber]  = useState(null)

  useEffect(() => {
    if (!restaurantId || !tableId) return undefined
    let cancelled = false
    api.get(`/api/tables/${restaurantId}/${encodeURIComponent(tableId)}`)
      .then(({ data }) => {
        if (!cancelled && data.table?.tableNumber) setTableNumber(String(data.table.tableNumber))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [restaurantId, tableId])

  const chefTimerRef   = useRef(null)
  const waiterTimerRef = useRef(null)

  const isSameTable = useCallback((data) =>
    String(data.tableId) === String(tableId) ||
    String(data.tableNumber) === String(tableId),
  [tableId])

  const dismissChefMessage = useCallback(() => {
    clearTimeout(chefTimerRef.current)
    setChefMessage(null)
  }, [])

  const handleCallWaiter = useCallback(() => {
    if (waiterCalled) return
    const socket = getSocket()
    socket.emit('call_waiter', { restaurantId, tableId })
    setWaiterCalled(true)
    clearTimeout(waiterTimerRef.current)
    waiterTimerRef.current = setTimeout(() => setWaiterCalled(false), 60_000)
  }, [restaurantId, tableId, waiterCalled])

  useEffect(() => {
    if (!restaurantId) return
    const socket = getSocket()

    const registered = []
    const listen = (event, handler) => {
      socket.on(event, handler)
      registered.push([event, handler])
    }

    // Bug #2: customers used to join the restaurant-wide room (join_restaurant),
    // which also carries every other table's orders, the live bill stream and
    // daily stats. join_table scopes this socket to only this table's events.
    const joinRoom = () => {
      if (!tableId) return
      socket.emit('join_table', { restaurantId, tableId: String(tableId) })
      setConnected(true)
    }

    if (socket.connected) joinRoom()

    listen('connect', joinRoom)
    listen('disconnect', () => setConnected(false))

    listen('status_changed', (updatedOrder) => {
      if (!isSameTable(updatedOrder)) return
      setOrderStatus(updatedOrder.status)
      if (Array.isArray(updatedOrder.items) && updatedOrder.items.length > 0) {
        setOrderItems(updatedOrder.items)
      }
    })

    listen('chef_message_received', (data) => {
      if (!isSameTable(data)) return
      clearTimeout(chefTimerRef.current)
      setChefMessage(data.message)
      chefTimerRef.current = setTimeout(() => setChefMessage(null), 10_000)
    })

    listen('bill_closed', (data) => {
      if (!isSameTable(data)) return
      setOrderStatus('closed')
    })

    return () => {
      registered.forEach(([event, handler]) => socket.off(event, handler))
      clearTimeout(chefTimerRef.current)
      clearTimeout(waiterTimerRef.current)
    }
  }, [restaurantId, tableId, isSameTable])

  const billTotal = calcTotal(orderItems)
  const showBill  = orderItems.length > 0
  const isSettled = orderStatus === 'closed'

  const headerLabel =
    orderStatus === 'ready'    ? 'Order Ready!'       :
    orderStatus === 'preparing'? 'Being Prepared...'  :
    orderStatus === 'served'   ? 'Enjoy your meal!'   :
    orderStatus === 'closed'   ? 'Thanks for dining!' :
    'Order Placed!'

  const headerSub =
    orderStatus === 'ready'    ? 'Your food is ready! It will be served shortly. 🍽️' :
    orderStatus === 'preparing'? 'Our chef is preparing your meal. 🍳'                :
    orderStatus === 'served'   ? 'Bon appétit! Call the waiter for anything. 🍽️'     :
    orderStatus === 'closed'   ? 'Your bill has been settled. See you again! 👋'      :
    'Sit back and relax. Your order has been received.'

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--sidebar, #1a1208)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 20px 60px',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {!connected && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px', padding: '8px 14px', marginBottom: '16px',
            fontSize: '12px', color: '#fca5a5', textAlign: 'center',
          }}>
            ⚡ Reconnecting for live updates…
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '80px', height: '80px',
            border: '1.5px solid var(--gold, #b88746)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '40px', margin: '0 auto 20px',
          }}>
            {orderStatus === 'served' ? '🍽️' : orderStatus === 'closed' ? '👋' : '🎉'}
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', fontWeight: '600', color: '#FFFDF9', margin: '0 0 8px' }}>
            {headerLabel}
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,253,249,0.5)', lineHeight: '1.6', margin: '0 auto', maxWidth: '260px' }}>
            {headerSub}
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,253,249,0.3)', marginTop: '8px' }}>
            {tableNumber ? `Table ${tableNumber}` : ''}
          </p>
        </div>

        <ChefToast message={chefMessage} onDismiss={dismissChefMessage} />
        <WaiterCalledBanner visible={waiterCalled} />

        {!isSettled && (
          <div style={{
            background: 'rgba(184,135,70,0.06)', border: '0.5px solid rgba(184,135,70,0.2)',
            borderRadius: '14px', padding: '16px 18px', marginBottom: '16px',
          }}>
            <div style={{ fontSize: '10px', letterSpacing: '1.5px', color: 'rgba(255,253,249,0.35)', textTransform: 'uppercase', marginBottom: '14px' }}>
              Live Status
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {STATUS_STEPS.map((step) => (
                <StatusStep key={step.key} step={step} state={getStepState(step.key, orderStatus)} />
              ))}
            </div>
          </div>
        )}

        {showBill && (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: '14px', padding: '16px 18px', marginBottom: '16px',
          }}>
            <div style={{ fontSize: '10px', letterSpacing: '1.5px', color: 'rgba(255,253,249,0.35)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Your Items
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {orderItems.map((item, idx) => (
                <div key={item.lineId ?? item.id ?? idx} style={{ borderBottom: idx < orderItems.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <ItemRow item={item} />
                </div>
              ))}
            </div>
            <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'rgba(255,253,249,0.5)' }}>Current Bill</span>
              <span style={{ fontSize: '17px', fontWeight: '600', color: 'var(--gold, #b88746)' }}>{formatPrice(billTotal)}</span>
            </div>
          </div>
        )}

        {!isSettled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              onClick={() => navigate(`/r/${restaurantId}/table/${tableId}`)}
              style={{
                background: 'rgba(184,135,70,0.08)', border: '1px solid rgba(184,135,70,0.25)',
                borderRadius: '12px', padding: '14px 10px', color: 'var(--gold-l, #c9a05a)',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: "'Jost', sans-serif",
              }}
            >
              + Order More
            </button>
            <button
              onClick={handleCallWaiter}
              disabled={waiterCalled}
              style={{
                background: waiterCalled ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.04)',
                border: waiterCalled ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '14px 10px',
                color: waiterCalled ? '#a5b4fc' : 'rgba(255,253,249,0.65)',
                fontSize: '13px', fontWeight: '500',
                cursor: waiterCalled ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif",
              }}
            >
              {waiterCalled ? '✓ Notified' : '🔔 Call Waiter'}
            </button>
          </div>
        )}

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}

export default OrderConfirmed