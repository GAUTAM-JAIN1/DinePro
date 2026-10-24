import { useMemo, useState } from 'react'
import TableCard from '../components/TableCard'
import PrintBill from '../components/PrintBill'
import DailyReport from "../components/dailyreport";
import { useBilling } from '../hooks/useBilling'
import { sumRupees } from '../billingMath'
import { AnimatePresence, motion } from 'framer-motion'

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

function AccountMenu({ userEmail, onLogout }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="filter-button"
        title="Account"
      >
        👤 {userEmail ? userEmail.split('@')[0] : 'Account'}
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: 'var(--card)', border: '1px solid rgba(184,135,70,0.18)',
            borderRadius: '12px', minWidth: '190px', zIndex: 50,
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)', overflow: 'hidden',
          }}>
            {userEmail && (
              <div style={{
                padding: '10px 14px', fontSize: '11px', color: 'var(--text2)',
                borderBottom: '1px solid rgba(184,135,70,0.12)', wordBreak: 'break-all',
              }}>
                {userEmail}
              </div>
            )}
            <button
              type="button"
              onClick={onLogout}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                color: '#dc2626', fontSize: '13px', fontWeight: '600',
                padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              🚪 Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function BillingDashboard({ restaurantId, onLogout, userEmail }) {
  const {
    tableGroups, history, connected, closeBill, markItemServed, stats,
    waiterAlerts, dismissWaiterAlert, restaurant,
    cancelOrder,
    resetStats,
    actionError,
    clearActionError,
  } = useBilling(restaurantId)

  const [reprint,       setReprint]      = useState(null)
  const [searchTerm,    setSearchTerm]   = useState('')
  const [statusFilter,  setStatusFilter] = useState('all')
  const [activeView,    setActiveView]   = useState('live')
  const [showReport,    setShowReport]   = useState(false)
  const [resetting,     setResetting]    = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

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

  // Reprint uses the invoice number stored at settlement (Bug #43). A settled
  // invoice can cover several orders from the same table, so all of them are
  // gathered back together by invoice number.
  const openReprint = (order) => {
    const invoiceNumber = order.settlement?.invoiceNumber || null
    const group = invoiceNumber
      ? history.filter((o) => o.settlement?.invoiceNumber === invoiceNumber)
      : [order]
    setReprint({
      tableNumber: order.tableNumber,
      items: group.flatMap((o) => o.items || []),
      totalAmount: sumRupees(group.map((o) => o.totalAmount || 0)),
      settlement: order.settlement,
      invoiceNumber,
      billedAt: order.closedAt,
      restaurantName: restaurant?.name || 'Restaurant',
    })
  }

  const handleReset = async () => {
    setResetting(true)
    await resetStats()
    setResetting(false)
    setShowResetConfirm(false)
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
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

              <button
                onClick={() => setShowResetConfirm(true)}
                className="filter-button"
                title="Restart the live dashboard counter. Bills and reports are not changed."
              >
                🔄 Restart live counter
              </button>

              <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${
                connected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}>
                <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {connected ? 'Live sync' : 'Reconnecting'}
              </div>

              <AccountMenu userEmail={userEmail} onLogout={onLogout} />
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

        {actionError && (
          <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
            <span>{actionError}</span>
            <button type="button" onClick={clearActionError} className="shrink-0 font-semibold underline">
              Dismiss
            </button>
          </div>
        )}

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
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => openReprint(order)}
                      className="action-button secondary text-sm"
                    >
                      🖨️ Reprint{order.settlement?.invoiceNumber ? ` · ${order.settlement.invoiceNumber}` : ''}
                    </button>
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
            <AnimatePresence initial={false} mode="popLayout">
              {filteredTables.map((tableGroup) => (
                <motion.div
                  key={tableGroup.tableNumber}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <TableCard
                    tableGroup={tableGroup}
                    onCloseBill={closeBill}
                    onMarkItemServed={markItemServed}
                    onCancelOrder={cancelOrder}
                    restaurant={restaurant}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
        )}
      </main>

      {reprint && (
        <PrintBill
          {...reprint}
          onClose={() => setReprint(null)}
        />
      )}

      {showReport && (
        <DailyReport
          restaurantId={restaurantId}
          restaurantName={restaurant?.name || 'Restaurant'}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div className="dp-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}>
          <div className="dp-dialog" style={{
            background: 'var(--card)', borderRadius: '20px',
            padding: '28px 24px', maxWidth: '360px', width: '100%',
            border: '1px solid rgba(184,135,70,0.18)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔄</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>
              Restart the live counter?
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--text2)', lineHeight: '1.5' }}>
              This restarts the live counter on the dashboard only. Bills, orders and the daily report are not changed, and the report still shows the whole day.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: '1px solid rgba(184,135,70,0.25)',
                  background: 'transparent', color: 'var(--text2)',
                  fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #2B1A0D, #5B3A1A)',
                  color: '#fff', fontSize: '14px', fontWeight: '600',
                  cursor: resetting ? 'not-allowed' : 'pointer',
                  opacity: resetting ? 0.7 : 1,
                }}
              >
                {resetting ? 'Resetting...' : 'Yes, Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}

export default BillingDashboard