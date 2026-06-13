import { useMemo, useState } from 'react'
import TableCard from '../components/TableCard'
import DailyReport from "../components/dailyreport";
import { useBilling } from '../hooks/useBilling'

const formatDateTime = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function WaiterAlertBanner({ alerts, onDismiss }) {
  if (!alerts.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)',
            borderRadius: '12px', padding: '12px 16px', animation: 'fadeIn 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🔔</span>
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                Table {alert.tableNumber} is calling for a waiter
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text2)' }}>
                {formatDateTime(alert.calledAt)}
              </p>
            </div>
          </div>
          <button
            onClick={() => onDismiss(alert.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '18px', color: 'var(--text2)', padding: '4px 8px',
              borderRadius: '6px',
            }}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function BillingDashboard({ restaurantId }) {
  const {
    tableGroups, history, connected, closeBill, markItemServed, stats,
    waiterAlerts, dismissWaiterAlert, restaurant,
    cancelOrder,  // ← Task: cancelOrder added
  } = useBilling(restaurantId)

  const [searchTerm,   setSearchTerm]   = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeView,   setActiveView]   = useState('live')
  const [showReport,   setShowReport]   = useState(false)

  const liveTables     = useMemo(() => Object.values(tableGroups), [tableGroups])
  const tables         = liveTables
  const totalRevenue   = tables.reduce((sum, t) => sum + t.totalAmount, 0)
  const totalItems     = tables.reduce((sum, t) => sum + t.allItems.length, 0)
  const urgentTables   = tables.filter((t) => {
    const status = t.orders.at(-1)?.status || 'new'
    return status === 'new' || status === 'ready'
  }).length

  const filteredTables = tables.filter((table) => {
    const latestStatus = table.orders.at(-1)?.status || 'new'
    const matchesSearch = String(table.tableNumber)
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase())
    const matchesStatus = statusFilter === 'all' || latestStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredHistory = history.filter((order) =>
    String(order.tableNumber).toLowerCase().includes(searchTerm.trim().toLowerCase())
  )

  const filters = [
    { key: 'all',       label: 'All'       },
    { key: 'new',       label: 'New'       },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready',     label: 'Ready'     },
    { key: 'served',    label: 'Served'    },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-30 border-b border-[rgba(184,135,70,0.16)] bg-[rgba(255,253,249,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--gold)]">
                Receptionist Panel
              </p>
              <h1 className="font-display text-3xl font-semibold leading-tight text-[var(--text)] sm:text-4xl">
                Billing Desk
              </h1>
              <p className="mt-1 text-sm text-[var(--text2)]">
                Track live tables, print bills, and settle orders quickly.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowReport(true)}
                className="filter-button"
                title="View daily report"
              >
                📊 Daily Report
              </button>

              <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${
                connected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}>
                <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {connected ? 'Live sync' : 'Reconnecting'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="dashboard-stat">
              <span>Active Tables</span>
              <strong>{tables.length}</strong>
            </div>
            <div className="dashboard-stat">
              <span>Pending Revenue</span>
              <strong>Rs. {totalRevenue}</strong>
            </div>
            <div className="dashboard-stat highlight">
              <span>Today Revenue</span>
              <strong>Rs. {stats.dailyRevenue}</strong>
            </div>
            <div className="dashboard-stat">
              <span>Items in Queue</span>
              <strong>{totalItems}</strong>
            </div>
            <div className="dashboard-stat">
              <span>Needs Attention</span>
              <strong>{urgentTables}</strong>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

        <WaiterAlertBanner alerts={waiterAlerts} onDismiss={dismissWaiterAlert} />

        <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-[rgba(184,135,70,0.18)] bg-[var(--card)] p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {[
              { key: 'live',    label: 'Live Orders' },
              { key: 'history', label: 'History'     },
            ].map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => setActiveView(view.key)}
                className={`filter-button ${activeView === view.key ? 'is-active' : ''}`}
              >
                {view.label}
              </button>
            ))}
          </div>

          <label className="flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3">
            <span className="search-dot" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search table number"
              className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)]"
            />
          </label>

          {activeView === 'live' && (
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              {filters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                  className={`filter-button ${statusFilter === filter.key ? 'is-active' : ''}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {activeView === 'history' ? (
          history.length === 0 ? (
            <section className="empty-panel">
              <div className="empty-mark">0</div>
              <h2>No past orders</h2>
              <p>Settled bills will appear here automatically.</p>
            </section>
          ) : filteredHistory.length === 0 ? (
            <section className="empty-panel">
              <div className="empty-mark">?</div>
              <h2>No matching history</h2>
              <p>Try another table number or clear the search.</p>
            </section>
          ) : (
            <section className="history-panel">
              {filteredHistory.map((order) => (
                <article key={order.id} className="history-row">
                  <div>
                    <p className="history-kicker">Table {order.tableNumber}</p>
                    <h2>Rs. {order.settledAmount ?? order.totalAmount}</h2>
                    <p>
                      {formatDateTime(order.closedAt)} | {order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'}
                      {order.settlement?.paymentMode ? ` | ${order.settlement.paymentMode}` : ''}
                    </p>
                  </div>
                  <div className="history-items">
                    {(order.items || []).slice(0, 4).map((item, idx) => (
                      <span key={`${order.id}-${item.id || item.name}-${idx}`}>
                        {item.quantity}x {item.name}
                      </span>
                    ))}
                    {(order.items?.length || 0) > 4 && (
                      <span>+{order.items.length - 4} more</span>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )
        ) : tables.length === 0 ? (
          <section className="empty-panel">
            <div className="empty-mark">0</div>
            <h2>No active tables</h2>
            <p>Orders will appear here automatically when guests place them.</p>
          </section>
        ) : filteredTables.length === 0 ? (
          <section className="empty-panel">
            <div className="empty-mark">?</div>
            <h2>No matching tables</h2>
            <p>Try another table number or clear the status filter.</p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTables.map((tableGroup) => (
              <TableCard
                key={tableGroup.tableNumber}
                tableGroup={tableGroup}
                onCloseBill={closeBill}
                onMarkItemServed={markItemServed}
                onCancelOrder={cancelOrder}  // ← cancelOrder prop passed
                restaurant={restaurant}
              />
            ))}
          </section>
        )}
      </main>

      {showReport && (
        <DailyReport
          restaurantId={restaurantId}
          restaurantName={restaurant?.name || 'Restaurant'}
          onClose={() => setShowReport(false)}
        />
      )}

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}

export default BillingDashboard