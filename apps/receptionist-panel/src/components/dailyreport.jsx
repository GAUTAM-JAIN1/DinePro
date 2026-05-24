import { useState, useEffect } from 'react'
import axios from 'axios'
import { auth } from '../firebase'

const BACKEND_URL = import.meta.env.VITE_API_URL

async function getAuthHeaders() {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

function DailyReport({ restaurantId, restaurantName, onClose }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true)
        const headers = await getAuthHeaders()
        const res = await axios.get(`${BACKEND_URL}/api/orders/${restaurantId}/daily-report`, { headers })
        setReport(res.data.report)
      } catch (err) {
        setError('Could not load report')
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [restaurantId])

  const handlePrint = () => window.print()

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <>
      {/* Screen modal — hidden when printing */}
      <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-2xl rounded-3xl bg-[var(--card)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(184,135,70,0.18)]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--gold)]">
                Daily Report
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--text)]">
                {today}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[rgba(184,135,70,0.1)] text-[var(--text2)] hover:bg-[rgba(184,135,70,0.2)] transition text-lg"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {loading && (
              <div className="text-center py-12 text-[var(--text2)]">Loading report...</div>
            )}
            {error && (
              <div className="text-center py-12 text-rose-500">{error}</div>
            )}
            {report && !loading && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Total Orders', value: report.totalOrders, icon: '📋' },
                    { label: 'Total Revenue', value: `Rs. ${report.totalRevenue}`, icon: '💰' },
                    { label: 'Avg Order', value: `Rs. ${report.averageOrderValue}`, icon: '📊' },
                    { label: 'Date', value: report.date, icon: '📅' },
                  ].map((card, i) => (
                    <div key={i} className="rounded-2xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] p-4 text-center">
                      <div className="text-2xl mb-1">{card.icon}</div>
                      <div className="text-lg font-bold text-[var(--btn)]">{card.value}</div>
                      <div className="text-xs text-[var(--text3)] mt-1 uppercase tracking-wide">{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* Payment Mode Breakdown */}
                {Object.keys(report.paymentModeBreakdown || {}).length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text2)] mb-3">
                      Payment Breakdown
                    </h3>
                    <div className="rounded-2xl border border-[rgba(184,135,70,0.18)] overflow-hidden">
                      {Object.entries(report.paymentModeBreakdown).map(([mode, data], i) => (
                        <div
                          key={mode}
                          className={`flex justify-between items-center px-4 py-3 text-sm ${i > 0 ? 'border-t border-[rgba(184,135,70,0.12)]' : ''}`}
                        >
                          <span className="font-semibold text-[var(--text)] capitalize">{mode}</span>
                          <div className="text-right">
                            <span className="font-bold text-[var(--btn)]">Rs. {data.total.toFixed(0)}</span>
                            <span className="text-[var(--text3)] ml-2">({data.count} orders)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top 5 Items */}
                {(report.topItems || []).length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text2)] mb-3">
                      Top Items Today
                    </h3>
                    <div className="rounded-2xl border border-[rgba(184,135,70,0.18)] overflow-hidden">
                      {report.topItems.map((item, i) => (
                        <div
                          key={i}
                          className={`flex justify-between items-center px-4 py-3 text-sm ${i > 0 ? 'border-t border-[rgba(184,135,70,0.12)]' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-[rgba(184,135,70,0.4)] font-display">#{i + 1}</span>
                            <span className="font-medium text-[var(--text)]">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[var(--gold)]">{item.quantity}x</span>
                            <span className="text-[var(--text3)] ml-2">Rs. {item.revenue}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {report.totalOrders === 0 && (
                  <div className="text-center py-8 text-[var(--text2)]">
                    No completed orders today yet.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Buttons */}
          {!loading && !error && (
            <div className="px-6 py-4 border-t border-[rgba(184,135,70,0.18)] flex justify-end gap-3">
              <button onClick={onClose} className="action-button secondary px-6">
                Close
              </button>
              <button onClick={handlePrint} className="action-button primary px-6">
                🖨️ Print Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Printable version — only visible when printing */}
      {report && (
        <div className="print-only receipt-paper" style={{ fontFamily: 'monospace', padding: '16px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h1 style={{ fontSize: '18px', margin: '0 0 4px' }}>{restaurantName}</h1>
            <p style={{ margin: '0', fontSize: '12px' }}>Daily Sales Report</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px' }}>{today}</p>
            <p style={{ margin: '8px 0', fontSize: '11px' }}>--------------------------------</p>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
              <span>Total Orders:</span><span>{report.totalOrders}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
              <span>Total Revenue:</span><span>Rs. {report.totalRevenue}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Avg Order Value:</span><span>Rs. {report.averageOrderValue}</span>
            </div>
          </div>

          <p style={{ margin: '8px 0', fontSize: '11px' }}>--------------------------------</p>

          {Object.keys(report.paymentModeBreakdown || {}).length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 6px' }}>PAYMENT BREAKDOWN</p>
              {Object.entries(report.paymentModeBreakdown).map(([mode, data]) => (
                <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span>{mode.toUpperCase()}:</span>
                  <span>Rs.{data.total.toFixed(0)} ({data.count}x)</span>
                </div>
              ))}
            </div>
          )}

          {(report.topItems || []).length > 0 && (
            <div>
              <p style={{ margin: '8px 0', fontSize: '11px' }}>--------------------------------</p>
              <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 6px' }}>TOP ITEMS</p>
              {report.topItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span>#{i + 1} {item.name}</span>
                  <span>{item.quantity}x</span>
                </div>
              ))}
            </div>
          )}

          <p style={{ margin: '12px 0 4px', fontSize: '11px', textAlign: 'center' }}>--------------------------------</p>
          <p style={{ fontSize: '11px', textAlign: 'center', margin: '0' }}>End of Report</p>
        </div>
      )}
    </>
  )
}

export default DailyReport