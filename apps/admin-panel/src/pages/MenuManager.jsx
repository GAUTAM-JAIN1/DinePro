import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import api from '../lib/api'

function MenuManager({ restaurant }) {
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const emptyForm = {
    name: '', nameHindi: '', price: '', category: '', categoryHindi: '',
    description: '', descriptionHindi: '', imageUrl: '', isVeg: true,
    isAvailable: true, hasVariants: false, variants: [],
  }
  const [form, setForm] = useState(emptyForm)

  // Derive categories from menu data
  const categories = ['All', ...new Set(menuItems.map(i => i.category).filter(Boolean))]

  useEffect(() => { fetchMenu() }, [restaurant.id])

  const fetchMenu = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/api/menu/${restaurant.id}`)
      if (data.success) setMenuItems(data.menu)
      else toast.error('Failed to load menu')
    } catch (err) {
      toast.error('Could not connect to backend')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => { setForm(emptyForm); setEditItem(null); setShowForm(false) }

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error('Name and price are required!'); return }
    if (form.hasVariants && form.variants.length === 0) { toast.error('Add at least one variant'); return }
    setSaving(true)
    try {
      const payload = { ...form, price: Number(form.price) }
      if (editItem) {
        const { data } = await api.put(`/api/menu/${restaurant.id}/${editItem.id}`, payload)
        if (data.success) {
          setMenuItems(prev => prev.map(i => i.id === editItem.id ? data.item : i))
          toast.success('Item updated!')
        }
      } else {
        const { data } = await api.post(`/api/menu/${restaurant.id}`, payload)
        if (data.success) {
          setMenuItems(prev => [...prev, data.item])
          toast.success('Item added!')
        }
      }
      resetForm()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not save')
    } finally { setSaving(false) }
  }

  const handleEdit = (item) => {
    setForm({
      name: item.name || '', nameHindi: item.nameHindi || '',
      price: item.price || '', category: item.category || '',
      categoryHindi: item.categoryHindi || '',
      description: item.description || '', descriptionHindi: item.descriptionHindi || '',
      imageUrl: item.imageUrl || '', isVeg: item.isVeg ?? true,
      isAvailable: item.isAvailable ?? true,
      hasVariants: item.hasVariants ?? false,
      variants: item.variants || [],
    })
    setEditItem(item)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return
    try {
      const { data } = await api.delete(`/api/menu/${restaurant.id}/${id}`)
      if (data.success) { setMenuItems(prev => prev.filter(i => i.id !== id)); toast.success('Deleted!') }
    } catch (err) { toast.error('Could not delete') }
  }

  const toggleAvailability = async (item) => {
    try {
      const { data } = await api.patch(`/api/menu/${restaurant.id}/${item.id}/toggle`)
      if (data.success) {
        setMenuItems(prev => prev.map(i => i.id === item.id ? data.item : i))
      }
    } catch (err) { toast.error('Could not toggle') }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('restaurantId', restaurant.id)
      const { data } = await api.post('/api/images/upload', fd)
      if (data.success) {
        setForm(f => ({ ...f, imageUrl: data.url }))
        toast.success('Image uploaded!')
      }
    } catch (err) { toast.error('Upload failed') }
    finally { setUploadingImage(false) }
  }

  // Variant helpers
  const addVariant = () => setForm(f => ({ ...f, variants: [...f.variants, { name: '', nameHindi: '', price: '' }] }))
  const removeVariant = (idx) => setForm(f => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }))
  const updateVariant = (idx, field, val) => setForm(f => ({
    ...f, variants: f.variants.map((v, i) => i === idx ? { ...v, [field]: val } : v)
  }))

  // Filter
  const filtered = menuItems
    .filter(i => filterCat === 'All' || i.category === filterCat)
    .filter(i => {
      if (!search) return true
      const q = search.toLowerCase()
      return (i.name || '').toLowerCase().includes(q) || (i.nameHindi || '').toLowerCase().includes(q)
    })

  // Group by category
  const grouped = {}
  filtered.forEach(i => {
    const cat = i.category || 'Uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(i)
  })

  const inputStyle = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400'
  const labelStyle = 'text-sm font-medium text-gray-700 block mb-1'

  return (
    <div className="p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">🍽️ Menu Manager</h1>
          <p className="text-gray-500 mt-1">{loading ? 'Loading...' : `${menuItems.length} items`}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition">
          + Add Item
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none">
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && resetForm()}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{editItem ? 'Edit Item' : 'Add New Item'}</h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Name EN/HI */}
              <div><label className={labelStyle}>Name (English) *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Butter Chicken" className={inputStyle} /></div>
              <div><label className={labelStyle}>Name (Hindi)</label>
                <input type="text" value={form.nameHindi} onChange={e => setForm({...form, nameHindi: e.target.value})} placeholder="बटर चिकन" className={inputStyle} /></div>

              {/* Price + Category */}
              <div><label className={labelStyle}>Price (₹) *</label>
                <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="250" className={inputStyle} /></div>
              <div><label className={labelStyle}>Category</label>
                <input type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="Mains" list="cat-list" className={inputStyle} />
                <datalist id="cat-list">{categories.filter(c => c !== 'All').map(c => <option key={c} value={c} />)}</datalist>
              </div>

              {/* Category Hindi */}
              <div><label className={labelStyle}>Category (Hindi)</label>
                <input type="text" value={form.categoryHindi} onChange={e => setForm({...form, categoryHindi: e.target.value})} placeholder="मुख्य" className={inputStyle} /></div>

              {/* Veg toggle */}
              <div className="flex items-center gap-3 pt-6">
                <label className="text-sm font-medium text-gray-700">Veg/Non-Veg:</label>
                <button type="button" onClick={() => setForm({...form, isVeg: !form.isVeg})}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${form.isVeg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {form.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                </button>
              </div>

              {/* Description EN/HI */}
              <div className="col-span-2"><label className={labelStyle}>Description (English)</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Short description" className={inputStyle} rows={2} /></div>
              <div className="col-span-2"><label className={labelStyle}>Description (Hindi)</label>
                <textarea value={form.descriptionHindi} onChange={e => setForm({...form, descriptionHindi: e.target.value})} placeholder="विवरण" className={inputStyle} rows={2} /></div>

              {/* Image Upload */}
              <div className="col-span-2">
                <label className={labelStyle}>Image</label>
                <div className="flex gap-3 items-center">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm" />
                  {uploadingImage && <span className="text-sm text-orange-500 animate-pulse">Uploading...</span>}
                  {form.imageUrl && <img src={form.imageUrl} alt="preview" className="w-16 h-16 rounded-lg object-cover" />}
                </div>
              </div>

              {/* Variants */}
              <div className="col-span-2 border-t pt-4 mt-2">
                <div className="flex items-center gap-3 mb-3">
                  <label className="text-sm font-medium text-gray-700">Has Variants?</label>
                  <button type="button" onClick={() => setForm({...form, hasVariants: !form.hasVariants})}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${form.hasVariants ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                    {form.hasVariants ? 'Yes' : 'No'}
                  </button>
                </div>
                {form.hasVariants && (
                  <div className="space-y-2">
                    {form.variants.map((v, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input value={v.name} onChange={e => updateVariant(idx, 'name', e.target.value)} placeholder="Half / Full" className="border rounded-lg px-3 py-2 text-sm flex-1" />
                        <input value={v.nameHindi} onChange={e => updateVariant(idx, 'nameHindi', e.target.value)} placeholder="हिंदी" className="border rounded-lg px-3 py-2 text-sm w-24" />
                        <input type="number" value={v.price} onChange={e => updateVariant(idx, 'price', e.target.value)} placeholder="₹" className="border rounded-lg px-3 py-2 text-sm w-24" />
                        <button onClick={() => removeVariant(idx)} className="text-red-500 text-lg">✕</button>
                      </div>
                    ))}
                    <button onClick={addVariant} className="text-orange-500 text-sm font-semibold">+ Add Variant</button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="bg-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50">
                {saving ? 'Saving...' : editItem ? 'Update Item' : 'Save Item'}
              </button>
              <button onClick={resetForm} className="border border-gray-300 text-gray-600 px-8 py-3 rounded-xl font-semibold hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="text-center py-20 text-gray-400 text-lg">Loading menu...</div>}

      {/* Empty */}
      {!loading && menuItems.length === 0 && (
        <div className="text-center py-20 text-gray-400 text-lg">No items yet. Click <strong>+ Add Item</strong> to start.</div>
      )}

      {/* Menu Items grouped by category */}
      {!loading && Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="mb-8">
          <h2 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">{cat}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
              <div key={item.id}
                className={`bg-white rounded-2xl shadow-sm overflow-hidden border-2 transition ${item.isAvailable ? 'border-gray-100' : 'border-red-200 opacity-60'}`}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-40 object-cover" onError={e => { e.target.style.display = 'none' }} />
                ) : (
                  <div className="w-full h-24 bg-gray-50 flex items-center justify-center text-3xl text-gray-300">{item.isVeg !== false ? '🥬' : '🍖'}</div>
                )}
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full border ${item.isVeg !== false ? 'border-green-500 bg-green-400' : 'border-red-500 bg-red-400'}`} />
                        <h3 className="font-bold text-gray-800">{item.name}</h3>
                      </div>
                      {item.nameHindi && <p className="text-xs text-gray-400 ml-5">{item.nameHindi}</p>}
                      <p className="text-xs text-gray-400 mt-1">{item.category}</p>
                    </div>
                    <span className="text-green-600 font-bold">₹{item.price}</span>
                  </div>
                  {item.description && <p className="text-gray-500 text-xs mt-2">{item.description}</p>}
                  {item.hasVariants && item.variants?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.variants.map((v, i) => (
                        <span key={i} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{v.name}: ₹{v.price}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => toggleAvailability(item)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${item.isAvailable ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                      {item.isAvailable ? '✅ Available' : '❌ Sold Out'}
                    </button>
                    <button onClick={() => handleEdit(item)} className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-200 transition">✏️</button>
                    <button onClick={() => handleDelete(item.id)} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-200 transition">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default MenuManager
