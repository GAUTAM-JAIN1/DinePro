import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import api from '@/lib/api'

export default function RestaurantSettings({ restaurant, setRestaurant }) {
  const [form, setForm] = useState({
    name: restaurant?.name || '',
    address: restaurant?.address || '',
    phone: restaurant?.phone || '',
    brandColor: restaurant?.brandColor || restaurant?.themeColor || '#f39c12',
    defaultGstPercent: String(restaurant?.defaultGstPercent ?? 0),
    defaultServiceCharge: String(restaurant?.defaultServiceCharge ?? 0),
    logoUrl: restaurant?.logoUrl || '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleSave = async () => {
    // Bug #76: a blank box used to save as 0 without a word. Ask for a number instead.
    const gst = Number(form.defaultGstPercent)
    const service = Number(form.defaultServiceCharge)
    if (form.defaultGstPercent === '' || !Number.isFinite(gst) || gst < 0 || gst > 100) {
      toast.error('GST 0 se 100 ke beech daalo (0 = no GST)')
      return
    }
    if (form.defaultServiceCharge === '' || !Number.isFinite(service) || service < 0) {
      toast.error('Service charge daalo (0 = no service charge)')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.put(`/api/restaurants/${restaurant.id}`, {
        ...form,
        defaultGstPercent: gst,
        defaultServiceCharge: service,
      })
      if (data.success || data.restaurant) {
        setRestaurant(prev => ({ ...prev, ...form }))
        toast.success('Settings saved!')
      }
    } catch (err) { toast.error('Could not save settings') }
    finally { setSaving(false) }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('restaurantId', restaurant.id)
      const { data } = await api.post('/api/images/upload', fd)
      if (data.success) {
        setForm(f => ({ ...f, logoUrl: data.url }))
        toast.success('Logo uploaded!')
      }
    } catch (err) { toast.error('Logo upload failed') }
    finally { setUploading(false) }
  }

  const inputStyle = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400'

  return (
    <div className="p-8 max-w-2xl">
      <Toaster position="top-right" />
      <h1 className="text-3xl font-bold text-gray-800 mb-6">⚙️ Restaurant Settings</h1>

      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 space-y-5">
        {/* Logo */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Restaurant Logo</label>
          <div className="flex items-center gap-4">
            {form.logoUrl && <img src={form.logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover border" />}
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-sm" />
            {uploading && <span className="text-orange-500 text-sm animate-pulse">Uploading...</span>}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Restaurant Name</label>
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputStyle} />
        </div>

        {/* Address */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Address</label>
          <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className={inputStyle} />
        </div>

        {/* Phone */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
          <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={inputStyle} />
        </div>

        {/* Brand Color */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Brand Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})}
              className="w-12 h-12 rounded-lg cursor-pointer border" />
            <input value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-32" />
          </div>
        </div>

        <hr className="my-2" />

        {/* GST */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Default GST (%)</label>
          <input type="number" min="0" max="28" value={form.defaultGstPercent}
            onChange={e => setForm({...form, defaultGstPercent: e.target.value})} className={inputStyle} />
          <p className="text-xs text-gray-400 mt-1">Pre-filled in settlement form. 0 = no GST.</p>
        </div>

        {/* Service Charge */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Default Service Charge (₹)</label>
          <input type="number" min="0" value={form.defaultServiceCharge}
            onChange={e => setForm({...form, defaultServiceCharge: e.target.value})} className={inputStyle} />
          <p className="text-xs text-gray-400 mt-1">Pre-filled in settlement form. 0 = no service charge.</p>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="bg-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50 w-full">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
