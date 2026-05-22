import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import toast, { Toaster } from 'react-hot-toast'
import api from '../lib/api'

const CUSTOMER_URL = import.meta.env.VITE_CUSTOMER_APP_URL || 'http://localhost:5173'

export default function TableManager({ restaurant }) {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editTable, setEditTable] = useState(null)
  const [form, setForm] = useState({ tableNumber: '', label: '', capacity: 4 })
  const [showPrintAll, setShowPrintAll] = useState(false)
  const printRef = useRef()

  useEffect(() => { fetchTables() }, [restaurant.id])

  const fetchTables = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/api/tables/${restaurant.id}`)
      if (data.success) setTables(data.tables || [])
    } catch (err) { toast.error('Could not load tables') }
    finally { setLoading(false) }
  }

  const getQrUrl = (tableNum) => `${CUSTOMER_URL}/${restaurant.id}/table/${tableNum}`

  const handleAdd = async () => {
    if (!form.tableNumber) { toast.error('Table number is required'); return }
    try {
      const { data } = await api.post(`/api/tables/${restaurant.id}`, {
        tableNumber: String(form.tableNumber),
        label: form.label || `Table ${form.tableNumber}`,
        capacity: Number(form.capacity) || 4,
      })
      if (data.success) {
        setTables(prev => [...prev, data.table])
        setForm({ tableNumber: '', label: '', capacity: 4 })
        setShowAdd(false)
        toast.success('Table added!')
      }
    } catch (err) { toast.error(err?.response?.data?.error || 'Could not add table') }
  }

  const handleEdit = async () => {
    if (!editTable) return
    try {
      const { data } = await api.put(`/api/tables/${restaurant.id}/${editTable.id}`, {
        label: form.label, capacity: Number(form.capacity),
      })
      if (data.success) {
        setTables(prev => prev.map(t => t.id === editTable.id ? { ...t, label: form.label, capacity: Number(form.capacity) } : t))
        setEditTable(null)
        toast.success('Table updated!')
      }
    } catch (err) { toast.error('Could not update') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this table?')) return
    try {
      const { data } = await api.delete(`/api/tables/${restaurant.id}/${id}`)
      if (data.success) { setTables(prev => prev.filter(t => t.id !== id)); toast.success('Deleted!') }
    } catch (err) { toast.error('Could not delete') }
  }

  const downloadQR = (tableNum) => {
    const svg = document.getElementById(`qr-${tableNum}`)
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = 400; canvas.height = 400
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 400, 400)
      ctx.drawImage(img, 0, 0, 400, 400)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `table-${tableNum}-qr.png`
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">🪑 Tables & QR Codes</h1>
          <p className="text-gray-500 mt-1">{tables.length} tables</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowPrintAll(true)} className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
            🖨️ Print All QRs
          </button>
          <button onClick={() => { setShowAdd(true); setForm({ tableNumber: String(tables.length + 1), label: '', capacity: 4 }) }}
            className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition">+ Add Table</button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAdd || editTable) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setEditTable(null) } }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editTable ? 'Edit Table' : 'Add Table'}</h2>
            {!editTable && (
              <div className="mb-3">
                <label className="text-sm font-medium text-gray-700 block mb-1">Table Number *</label>
                <input value={form.tableNumber} onChange={e => setForm({...form, tableNumber: e.target.value})}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm" />
              </div>
            )}
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 block mb-1">Label</label>
              <input value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder={`Table ${form.tableNumber}`}
                className="w-full border rounded-xl px-4 py-2.5 text-sm" />
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Capacity</label>
              <input type="number" min="1" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})}
                className="w-full border rounded-xl px-4 py-2.5 text-sm" />
            </div>
            <div className="flex gap-3">
              <button onClick={editTable ? handleEdit : handleAdd}
                className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition flex-1">
                {editTable ? 'Save' : 'Add Table'}
              </button>
              <button onClick={() => { setShowAdd(false); setEditTable(null) }}
                className="border px-6 py-2.5 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Print All QRs View */}
      {showPrintAll && (
        <div className="fixed inset-0 bg-white z-50 overflow-auto p-8">
          <div className="no-print flex justify-between mb-6">
            <h2 className="text-xl font-bold">All QR Codes — {restaurant.name}</h2>
            <div className="flex gap-3">
              <button onClick={() => window.print()} className="bg-orange-500 text-white px-6 py-2 rounded-xl font-semibold">🖨️ Print</button>
              <button onClick={() => setShowPrintAll(false)} className="border px-6 py-2 rounded-xl">Close</button>
            </div>
          </div>
          <div ref={printRef} className="print-receipt grid grid-cols-2 md:grid-cols-4 gap-6">
            {tables.map(t => (
              <div key={t.id} className="border rounded-xl p-4 text-center">
                <QRCodeSVG value={getQrUrl(t.tableNumber)} size={150} className="mx-auto" />
                <p className="font-bold mt-2">{t.label || `Table ${t.tableNumber}`}</p>
                <p className="text-xs text-gray-400">{restaurant.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tables Grid */}
      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map(t => (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">{t.label || `Table ${t.tableNumber}`}</h3>
                  <p className="text-xs text-gray-400">#{t.tableNumber} · {t.capacity || 4} seats</p>
                </div>
                <span className={`w-3 h-3 rounded-full ${t.isActive !== false ? 'bg-green-400' : 'bg-gray-300'}`} />
              </div>

              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-center mb-3">
                <QRCodeSVG id={`qr-${t.tableNumber}`} value={getQrUrl(t.tableNumber)} size={120} />
              </div>

              <p className="text-xs text-gray-400 text-center mb-3 truncate">{getQrUrl(t.tableNumber)}</p>

              <div className="flex gap-2">
                <button onClick={() => downloadQR(t.tableNumber)}
                  className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-semibold hover:bg-blue-100 transition">⬇️ Download</button>
                <button onClick={() => { setEditTable(t); setForm({ tableNumber: t.tableNumber, label: t.label || '', capacity: t.capacity || 4 }) }}
                  className="px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100 transition">✏️</button>
                <button onClick={() => handleDelete(t.id)}
                  className="px-3 py-2 bg-red-50 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-100 transition">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
