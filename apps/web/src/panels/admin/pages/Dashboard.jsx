import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { ContentSkeleton, RowsSkeleton } from '@/components/Skeleton'

export default function Dashboard({ restaurant }) {
  const [stats, setStats] = useState(null)
  const [report, setReport] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurant?.id) return
    let cancelled = false
    setLoading(true)

    Promise.all([
      api.get(`/api/orders/${restaurant.id}/stats`).catch(() => ({ data: {} })),
      api.get(`/api/orders/${restaurant.id}/daily-report`).catch(() => ({ data: {} })),
      api.get(`/api/orders/${restaurant.id}`).catch(() => ({ data: { orders: [] } })),
    ]).then(([statsRes, reportRes, ordersRes]) => {
      if (cancelled) return
      setStats(statsRes.data.stats || {})
      setReport(reportRes.data.report || {})
      setOrders((ordersRes.data.orders || []).slice(0, 10))
    }).finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [restaurant?.id])

  if (loading) return <ContentSkeleton rows={4} />

  const sub = restaurant?.subscription || {}
  const subStatus = sub.status || 'unknown'
  const daysLeft = sub.daysRemaining ?? '—'
  const subColor = subStatus === 'active' ? 'bg-green-100 text-green-700'
    : subStatus === 'trial' ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700'

  const statCards = [
    { label: "Today's Revenue", value: `₹${(stats?.dailyRevenue || 0).toLocaleString('en-IN')}`, icon: '💰', color: 'bg-green-50 text-green-700' },
    { label: 'Orders Today', value: stats?.completedOrdersToday || 0, icon: '📋', color: 'bg-blue-50 text-blue-700' },
    { label: 'Active Tables', value: orders.length, icon: '🪑', color: 'bg-orange-50 text-orange-700' },
    { label: 'Items in Queue', value: orders.reduce((s, o) => s + (o.items?.length || 0), 0), icon: '🍳', color: 'bg-purple-50 text-purple-700' },
  ]

  const hourly = report?.hourlyBreakdown || []
  const maxOrders = Math.max(...hourly.map(h => h.orders), 1)

  return (
    <div className="p-8">
      {/* Subscription Banner */}
      <div className={`${subColor} rounded-xl px-5 py-3 mb-6 flex justify-between items-center`}>
        <div>
          <span className="font-semibold text-sm">Plan: {subStatus.toUpperCase()}</span>
          <span className="text-sm ml-3">{daysLeft} days remaining</span>
        </div>
        {(subStatus === 'trial' || daysLeft < 5) && (
          <span className="text-xs font-semibold">⚠️ {subStatus === 'trial' ? 'Trial period' : 'Renew soon'}</span>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <div key={i} className={`${s.color} rounded-2xl p-5`}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm opacity-70 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Peak Hour Chart */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">📊 Orders by Hour (Today)</h3>
          <div className="flex items-end gap-1 h-40">
            {hourly.filter(h => h.hour >= 6 && h.hour <= 23).map(h => (
              <div key={h.hour} className="flex-1 flex flex-col items-center justify-end">
                <div className="bg-orange-400 rounded-t w-full min-h-[2px] transition-all"
                  style={{ height: `${(h.orders / maxOrders) * 100}%` }} />
                <span className="text-[10px] text-gray-400 mt-1">{h.hour}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Items */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">🏆 Top Items Today</h3>
          {(report?.topItems || []).length === 0 ? (
            <p className="text-gray-400 text-sm">No orders yet today</p>
          ) : (
            <div className="space-y-3">
              {report.topItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-300">#{i + 1}</span>
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-orange-600">{item.quantity}x</span>
                    <span className="text-xs text-gray-400 ml-2">₹{item.revenue}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">📋 Recent Active Orders</h3>
        {orders.length === 0 ? (
          <p className="text-gray-400 text-sm">No active orders</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ minWidth: 520 }}>
            <thead><tr className="text-left text-xs text-gray-400 uppercase">
              <th className="pb-3">Table</th><th className="pb-3">Items</th><th className="pb-3">Total</th><th className="pb-3">Status</th>
            </tr></thead>
            <tbody>
              {orders.map(o => {
                const sc = { new: 'bg-red-100 text-red-600', preparing: 'bg-yellow-100 text-yellow-700', ready: 'bg-green-100 text-green-700', served: 'bg-blue-100 text-blue-700' }
                return (
                  <tr key={o.id} className="border-t border-gray-50">
                    <td className="py-3 text-sm font-semibold">Table {o.tableNumber}</td>
                    <td className="py-3 text-sm text-gray-500">{o.items?.length || 0} items</td>
                    <td className="py-3 text-sm font-semibold text-green-600">₹{o.totalAmount}</td>
                    <td className="py-3"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${sc[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}