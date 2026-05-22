import { useMemo, useState } from 'react'
import { useKitchenOrders } from '../hooks/useKitchenOrders'
import OrderTicket from '../components/OrderTicket'

const URGENT_AFTER_MS = 15 * 60 * 1000

function KitchenDisplay({ restaurantId }) {
  const [soundOn, setSoundOn] = useState(true)
  const [dietFilter, setDietFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const {
    orders,
    connected,
    markPreparing,
    markReady,
    updateItemStatus,
    stats,
    notificationPermission,
    requestNotificationPermission,
    sendChefMessage,
  } = useKitchenOrders(restaurantId, {
    soundEnabled: soundOn,
    browserNotificationsEnabled: true,
  })

  const categories = useMemo(() => {
    const categorySet = new Set()
    orders.forEach(order => {
      order.items?.forEach(item => {
        if (item.category) categorySet.add(item.category)
      })
    })
    return [...categorySet].sort((a, b) => a.localeCompare(b))
  }, [orders])

  const filteredOrders = useMemo(() => {
    return orders
      .map(order => {
        const visibleItems = (order.items || []).filter(item => {
          const dietMatches =
            dietFilter === 'all' ||
            (dietFilter === 'veg' && item.isVeg === true) ||
            (dietFilter === 'nonveg' && item.isVeg === false)

          const categoryMatches =
            categoryFilter === 'all' || item.category === categoryFilter

          return dietMatches && categoryMatches
        })

        return { ...order, visibleItems }
      })
      .filter(order => order.visibleItems.length > 0)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [categoryFilter, dietFilter, orders])

  const newOrders = filteredOrders.filter(o => o.status === 'new')
  const preparingOrders = filteredOrders.filter(o => o.status === 'preparing')
  const readyOrders = filteredOrders.filter(o => o.status === 'ready')
  const urgentCount = orders.filter(order => Date.now() - new Date(order.createdAt).getTime() >= URGENT_AFTER_MS).length

  const columns = [
    { key: 'new', label: 'New', color: 'var(--red)', orders: newOrders },
    { key: 'preparing', label: 'Preparing', color: 'var(--yellow)', orders: preparingOrders },
    { key: 'ready', label: 'Ready', color: 'var(--green)', orders: readyOrders },
  ]

  const resetFilters = () => {
    setDietFilter('all')
    setCategoryFilter('all')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: 'var(--bg2)',
        borderBottom: '1px solid rgba(184,135,70,0.15)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: 'var(--gold-l)',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            Tadka Junction
          </span>
          <span style={{ color: 'var(--text3)' }}>|</span>
          <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>
            Kitchen Display
          </span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: connected ? 'rgba(39,174,96,0.12)' : 'rgba(231,76,60,0.12)',
            border: `1px solid ${connected ? 'rgba(39,174,96,0.3)' : 'rgba(231,76,60,0.3)'}`,
            borderRadius: '20px',
            padding: '5px 12px'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: connected ? 'var(--green)' : 'var(--red)',
              animation: connected ? 'pulse 1.5s infinite' : 'none'
            }} />
            <span style={{
              fontSize: '11px',
              color: connected ? 'var(--green)' : 'var(--red)',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'ACTIVE', value: orders.length, color: 'var(--gold-l)' },
            { label: 'NEW', value: orders.filter(o => o.status === 'new').length, color: 'var(--red)' },
            { label: 'PREP', value: orders.filter(o => o.status === 'preparing').length, color: 'var(--yellow)' },
            { label: 'READY', value: orders.filter(o => o.status === 'ready').length, color: 'var(--green)' },
            { label: 'URGENT', value: urgentCount, color: 'var(--red)' },
            { label: 'DONE', value: stats.completedOrdersToday || 0, color: 'var(--green)' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg3)',
              border: '1px solid rgba(184,135,70,0.1)',
              borderRadius: '8px',
              padding: '7px 12px',
              textAlign: 'center',
              minWidth: '58px'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: s.color, lineHeight: '1' }}>
                {s.value}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.5px', marginTop: '2px' }}>
                {s.label}
              </div>
            </div>
          ))}

          {notificationPermission === 'default' && (
            <button type="button" onClick={requestNotificationPermission} style={topButtonStyle('var(--green)')}>
              Allow alerts
            </button>
          )}

          <button
            type="button"
            onClick={() => setSoundOn(p => !p)}
            style={topButtonStyle(soundOn ? 'var(--gold-l)' : 'var(--text3)')}
          >
            {soundOn ? 'Sound on' : 'Sound off'}
          </button>
        </div>
      </div>

      <div style={{
        background: 'var(--bg)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={filterLabelStyle}>Filter</span>
          {[
            { key: 'all', label: 'All items' },
            { key: 'veg', label: 'Veg only' },
            { key: 'nonveg', label: 'Non-veg only' },
          ].map(option => (
            <button
              type="button"
              key={option.key}
              onClick={() => setDietFilter(option.key)}
              style={filterButtonStyle(dietFilter === option.key)}
            >
              {option.label}
            </button>
          ))}

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            style={selectStyle}
          >
            <option value="all">All categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          {(dietFilter !== 'all' || categoryFilter !== 'all') && (
            <button type="button" onClick={resetFilters} style={clearButtonStyle}>
              Clear
            </button>
          )}
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
          Oldest orders first
        </div>
      </div>

      {orders.length === 0 && (
        <div style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '32px'
        }}>
          <div style={{ fontSize: '48px', opacity: '0.35' }}>No tickets</div>
          <p style={{ color: 'var(--text3)', fontSize: '18px' }}>No active orders</p>
          <p style={{ color: 'var(--text3)', fontSize: '13px', opacity: '0.7' }}>
            New orders will appear here instantly.
          </p>
        </div>
      )}

      {orders.length > 0 && filteredOrders.length === 0 && (
        <div style={{
          padding: '28px 16px',
          color: 'var(--text3)',
          textAlign: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          No orders match the current filters.
        </div>
      )}

      <div className="kitchen-columns" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '14px',
        padding: '16px',
        flex: '1',
        minHeight: 0
      }}>
        {columns.map(col => (
          <div key={col.key} style={{
            background: 'var(--bg2)',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 184px)',
            minHeight: '280px'
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: col.color,
                  boxShadow: `0 0 8px ${col.color}`
                }} />
                <span style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: col.color,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase'
                }}>
                  {col.label}
                </span>
              </div>
              <span style={{
                background: 'var(--bg3)',
                borderRadius: '8px',
                padding: '3px 10px',
                fontSize: '12px',
                fontWeight: '700',
                color: 'var(--text2)'
              }}>
                {col.orders.length}
              </span>
            </div>

            <div style={{
              flex: '1',
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {col.orders.length === 0 ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '34px 20px',
                  color: 'var(--text3)',
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  No {col.label.toLowerCase()} orders
                </div>
              ) : (
                col.orders.map(order => (
                  <OrderTicket
                    key={order.id}
                    order={order}
                    visibleItems={order.visibleItems}
                    onMarkPreparing={markPreparing}
                    onMarkReady={markReady}
                    onUpdateItemStatus={updateItemStatus}
                    onSendChefMessage={sendChefMessage}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.8)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer { 0%{opacity:0} 50%{opacity:1} 100%{opacity:0} }
        @media (max-width: 980px) {
          .kitchen-columns {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

const topButtonStyle = (color) => ({
  background: 'var(--bg3)',
  border: `1px solid ${color === 'var(--text3)' ? 'rgba(90,79,69,0.3)' : 'rgba(184,135,70,0.2)'}`,
  borderRadius: '8px',
  padding: '9px 12px',
  color,
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
})

const filterLabelStyle = {
  color: 'var(--text3)',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
}

const filterButtonStyle = (active) => ({
  background: active ? 'rgba(184,135,70,0.16)' : 'var(--bg3)',
  border: active ? '1px solid rgba(184,135,70,0.45)' : '1px solid rgba(255,255,255,0.06)',
  borderRadius: '8px',
  color: active ? 'var(--gold-l)' : 'var(--text2)',
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '12px',
  fontWeight: '700',
  padding: '8px 11px',
})

const selectStyle = {
  background: 'var(--bg3)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: 'var(--text2)',
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '12px',
  fontWeight: '600',
  padding: '8px 11px',
}

const clearButtonStyle = {
  background: 'transparent',
  border: '1px solid rgba(231,76,60,0.25)',
  borderRadius: '8px',
  color: 'var(--red)',
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '12px',
  fontWeight: '700',
  padding: '8px 11px',
}

export default KitchenDisplay
