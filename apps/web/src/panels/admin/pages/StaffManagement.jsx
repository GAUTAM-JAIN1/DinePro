import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import api from '@/lib/api'
import { ContentSkeleton, RowsSkeleton } from '@/components/Skeleton'

export default function StaffManagement({ restaurant }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'chef' })

  useEffect(() => { fetchStaff() }, [restaurant.id])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/api/staff/${restaurant.id}`)
      if (data.success) setStaff(data.staff)
    } catch (err) { toast.error('Could not load staff') }
    finally { setLoading(false) }
  }

  const handleAdd = async () => {
    if (!form.name || !form.email) { toast.error('Name and email are required'); return }
    setSaving(true)
    try {
      const { data } = await api.post(`/api/staff/${restaurant.id}`, form)
      if (data.success) {
        setStaff(prev => [data.staff, ...prev])
        toast.success(`Staff added! Temp password: ${data.staff.tempPassword}`, { duration: 10000 })
        setForm({ name: '', email: '', role: 'chef' })
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not add staff')
    } finally { setSaving(false) }
  }

  const handleToggle = async (uid) => {
    try {
      const { data } = await api.patch(`/api/staff/${restaurant.id}/${uid}/toggle`)
      if (data.success) {
        setStaff(prev => prev.map(s => s.uid === uid ? { ...s, isActive: data.staff.isActive } : s))
        toast.success(data.staff.isActive ? 'Staff activated' : 'Staff deactivated')
      }
    } catch (err) { toast.error('Could not update status') }
  }

  const roleBadge = (role) => {
    const colors = { chef: 'bg-orange-100 text-orange-700', receptionist: 'bg-blue-100 text-blue-700', admin: 'bg-yellow-100 text-yellow-700' }
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[role] || 'bg-gray-100 text-gray-600'}`}>{role}</span>
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      <h1 className="text-3xl font-bold text-gray-800 mb-2">👥 Staff Management</h1>
      <p className="text-gray-500 mb-6">{staff.length} staff members</p>

      {/* Add Staff Form */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Add New Staff</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full Name *"
            className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400" />
          <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email *" type="email"
            className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400" />
          <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
            className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400">
            <option value="chef">Chef</option>
            <option value="receptionist">Receptionist</option>
          </select>
          <button onClick={handleAdd} disabled={saving}
            className="bg-orange-500 text-white rounded-xl px-6 py-3 font-semibold hover:bg-orange-600 transition disabled:opacity-50">
            {saving ? 'Adding...' : '+ Add Staff'}
          </button>
        </div>
      </div>

      {/* Staff List */}
      {loading ? (
        <RowsSkeleton rows={4} />
      ) : staff.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No staff members yet.</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ minWidth: 620 }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.uid} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{s.email}</td>
                  <td className="px-6 py-4">{roleBadge(s.role)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.isActive ? 'text-green-600' : 'text-red-500'}`}>
                      <span className={`w-2 h-2 rounded-full ${s.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleToggle(s.uid)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${s.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                      {s.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
