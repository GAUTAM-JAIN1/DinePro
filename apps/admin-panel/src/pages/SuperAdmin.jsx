import { useEffect, useMemo, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import api from '../lib/api'

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const statusClasses = {
  active: 'bg-green-100 text-green-700',
  trial: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
  suspended: 'bg-gray-200 text-gray-700',
}

function SuperAdmin() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', ownerEmail: '' })

  const fetchRestaurants = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/restaurants')
      setRestaurants(res.data.restaurants || [])
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load restaurants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRestaurants()
  }, [])

  const stats = useMemo(() => {
    const summary = { total: restaurants.length, active: 0, trial: 0, expired: 0, suspended: 0 }
    restaurants.forEach((restaurant) => {
      const status = restaurant.subscription?.effectiveStatus || restaurant.subscriptionStatus || 'expired'
      summary[status] = (summary[status] || 0) + 1
    })
    return summary
  }, [restaurants])

  const addRestaurant = async () => {
    if (!form.name || !form.ownerEmail) {
      toast.error('Name and owner email required')
      return
    }

    try {
      const res = await api.post('/api/restaurants', form)
      setRestaurants((prev) => [res.data.restaurant, ...prev])
      setForm({ name: '', address: '', ownerEmail: '' })
      setShowForm(false)
      toast.success(`${form.name} added with 15-day trial`)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add restaurant')
    }
  }

  const runAction = async (restaurant, action, days) => {
    try {
      setSavingId(`${restaurant.id}-${action}`)
      const res = await api.patch(`/api/restaurants/${restaurant.id}/subscription`, { action, days })
      setRestaurants((prev) =>
        prev.map((item) => (item.id === restaurant.id ? res.data.restaurant : item))
      )
      const messages = {
        markPaid: 'Marked paid for 30 days',
        extendTrial: 'Trial extended',
        suspend: 'Service suspended',
        reactivate: 'Service reactivated',
      }
      toast.success(messages[action] || 'Updated')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Update failed')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Super Admin</h1>
          <p className="mt-1 text-gray-500">Manage restaurant trials and monthly access.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
        >
          + Add Restaurant
        </button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ['Total', stats.total, 'bg-blue-50 text-blue-700'],
          ['Active', stats.active, 'bg-green-50 text-green-700'],
          ['Trial', stats.trial, 'bg-yellow-50 text-yellow-700'],
          ['Expired', stats.expired, 'bg-red-50 text-red-700'],
          ['Suspended', stats.suspended, 'bg-gray-100 text-gray-700'],
        ].map(([label, value, classes]) => (
          <div key={label} className={`rounded-2xl p-5 text-center ${classes}`}>
            <p className="text-3xl font-bold">{value}</p>
            <p className="mt-1 text-sm opacity-75">{label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border-2 border-orange-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-gray-800">Add New Restaurant</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-medium text-gray-700">Restaurant Name *</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. Spice Garden"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-orange-400 focus:outline-none"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-gray-700">Owner Email *</span>
              <input
                type="email"
                value={form.ownerEmail}
                onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })}
                placeholder="owner@restaurant.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-orange-400 focus:outline-none"
              />
            </label>
            <label className="lg:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700">Address</span>
              <input
                type="text"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                placeholder="Restaurant address"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-orange-400 focus:outline-none"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={addRestaurant}
              className="rounded-xl bg-orange-500 px-8 py-3 font-semibold text-white transition hover:bg-orange-600"
            >
              Add Restaurant
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-gray-300 px-8 py-3 font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Restaurant</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Access Ends</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Plan</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={5}>Loading...</td>
              </tr>
            ) : restaurants.length === 0 ? (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={5}>No restaurants yet</td>
              </tr>
            ) : (
              restaurants.map((restaurant) => {
                const subscription = restaurant.subscription || {}
                const status = subscription.effectiveStatus || restaurant.subscriptionStatus || 'expired'
                const endsAt = status === 'trial' ? subscription.trialEndsAt : subscription.currentPeriodEnd

                return (
                  <tr key={restaurant.id} className="transition hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{restaurant.name}</p>
                      <p className="text-xs text-gray-400">{restaurant.ownerEmail || restaurant.id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[status] || statusClasses.expired}`}>
                        {status}
                      </span>
                      {subscription.daysRemaining > 0 && (
                        <p className="mt-2 text-xs text-gray-400">{subscription.daysRemaining} days left</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(endsAt)}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                        Rs. {subscription.planAmount || 2000}/month
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => runAction(restaurant, 'markPaid', 30)}
                          disabled={savingId === `${restaurant.id}-markPaid`}
                          className="rounded-lg bg-green-100 px-3 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-200 disabled:opacity-50"
                        >
                          Mark Paid
                        </button>
                        <button
                          onClick={() => runAction(restaurant, 'extendTrial', 15)}
                          disabled={savingId === `${restaurant.id}-extendTrial`}
                          className="rounded-lg bg-yellow-100 px-3 py-2 text-xs font-semibold text-yellow-700 transition hover:bg-yellow-200 disabled:opacity-50"
                        >
                          +15 Trial
                        </button>
                        <button
                          onClick={() => runAction(restaurant, status === 'suspended' ? 'reactivate' : 'suspend', 30)}
                          disabled={savingId?.startsWith(restaurant.id)}
                          className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                        >
                          {status === 'suspended' ? 'Reactivate' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SuperAdmin
