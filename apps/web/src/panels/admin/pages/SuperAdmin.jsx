import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import api from '@/lib/api'
import { ContentSkeleton, RowsSkeleton } from '@/components/Skeleton'

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_STYLES = {
  active:    { bg: '#dcfce7', color: '#15803d' },
  trial:     { bg: '#fef9c3', color: '#854d0e' },
  expired:   { bg: '#fee2e2', color: '#b91c1c' },
  suspended: { bg: '#f3f4f6', color: '#374151' },
}
const ROLE_STYLES = {
  chef:          { bg: '#fff7ed', color: '#c2410c' },
  receptionist:  { bg: '#eff6ff', color: '#1d4ed8' },
}

// ─── tiny shared style tokens ────────────────────────────────────────────────
const primaryBtnStyle = {
  background: 'linear-gradient(135deg,#2B1A0D,#5B3A1A)',
  color: '#F5F0E8', border: 'none', borderRadius: '10px',
  padding: '11px 22px', fontSize: '14px', fontWeight: '700',
  cursor: 'pointer', fontFamily: 'Jost,sans-serif',
}
const ghostBtnStyle = {
  background: 'transparent', color: '#6E6256',
  border: '1px solid #EFE7DB', borderRadius: '10px',
  padding: '11px 22px', fontSize: '14px', fontWeight: '600',
  cursor: 'pointer', fontFamily: 'Jost,sans-serif',
}
const actionBtn = (bg, color) => ({
  background: bg, color, border: 'none', borderRadius: '8px',
  padding: '7px 12px', fontSize: '12px', fontWeight: '700',
  cursor: 'pointer', fontFamily: 'Jost,sans-serif',
})
const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: '600',
  color: '#6E6256', marginBottom: '6px',
  textTransform: 'uppercase', letterSpacing: '0.5px',
}
const inputStyle = {
  width: '100%', border: '1px solid #EFE7DB', borderRadius: '10px',
  padding: '10px 14px', fontSize: '14px', color: '#1E1A17',
  background: '#FFFDF9', outline: 'none',
  fontFamily: 'Jost,sans-serif', boxSizing: 'border-box',
}
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '20px',
}
const modalStyle = {
  background: '#FFFDF9', borderRadius: '20px', padding: '32px',
  width: '100%', maxWidth: '480px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
}

// ─── Menu Management sub-component ───────────────────────────────────────────
function MenuPanel({ restaurant }) {
  const [menuItems, setMenuItems]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showForm, setShowForm]         = useState(false)
  const [editItem, setEditItem]         = useState(null)
  const [search, setSearch]             = useState('')
  const [filterCat, setFilterCat]       = useState('All')

  const emptyForm = {
    name: '', nameHindi: '', price: '', category: '', categoryHindi: '',
    subcategory: '', subcategoryHindi: '',
    description: '', descriptionHindi: '', imageUrl: '',
    isVeg: true, isAvailable: true, isBestseller: false,
    hasVariants: false, variants: [],
  }
  const [form, setForm] = useState(emptyForm)

  const categories = ['All', ...new Set(menuItems.map(i => i.category).filter(Boolean))]

  // Existing subcategories for the currently-selected category — used as datalist suggestions
  const subcategorySuggestions = useMemo(() => {
    if (!form.category) return []
    return [...new Set(
      menuItems
        .filter(i => i.category === form.category && i.subcategory)
        .map(i => i.subcategory)
    )]
  }, [menuItems, form.category])

  useEffect(() => { fetchMenu() }, [restaurant.id])

  const fetchMenu = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/api/menu/${restaurant.id}`)
      if (data.success) setMenuItems(data.menu)
    } catch { toast.error('Menu load nahi hua') }
    finally { setLoading(false) }
  }

  const resetForm = () => { setForm(emptyForm); setEditItem(null); setShowForm(false) }

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error('Name aur price required hai!'); return }
    if (form.hasVariants && form.variants.length === 0) { toast.error('Kam se kam ek variant add karo'); return }
    setSaving(true)
    try {
      const payload = { ...form, price: Number(form.price) }
      if (editItem) {
        const { data } = await api.put(`/api/menu/${restaurant.id}/${editItem.id}`, payload)
        if (data.success) {
          setMenuItems(prev => prev.map(i => i.id === editItem.id ? data.item : i))
          toast.success('Item update ho gaya!')
        }
      } else {
        const { data } = await api.post(`/api/menu/${restaurant.id}`, payload)
        if (data.success) {
          setMenuItems(prev => [...prev, data.item])
          toast.success('Item add ho gaya!')
        }
      }
      resetForm()
    } catch (err) { toast.error(err?.response?.data?.error || 'Save nahi hua') }
    finally { setSaving(false) }
  }

  const handleEdit = (item) => {
    setForm({
      name: item.name || '', nameHindi: item.nameHindi || '',
      price: item.price || '', category: item.category || '',
      categoryHindi: item.categoryHindi || '',
      subcategory: item.subcategory || '', subcategoryHindi: item.subcategoryHindi || '',
      description: item.description || '', descriptionHindi: item.descriptionHindi || '',
      imageUrl: item.imageUrl || '', isVeg: item.isVeg ?? true,
      isAvailable: item.isAvailable ?? true, isBestseller: item.isBestseller ?? false,
      hasVariants: item.hasVariants ?? false, variants: item.variants || [],
    })
    setEditItem(item); setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete karo?')) return
    try {
      const { data } = await api.delete(`/api/menu/${restaurant.id}/${id}`)
      if (data.success) { setMenuItems(prev => prev.filter(i => i.id !== id)); toast.success('Deleted!') }
    } catch { toast.error('Delete nahi hua') }
  }

  const toggleAvailability = async (item) => {
    try {
      const { data } = await api.patch(`/api/menu/${restaurant.id}/${item.id}/toggle`)
      if (data.success) setMenuItems(prev => prev.map(i => i.id === item.id ? data.item : i))
    } catch { toast.error('Toggle nahi hua') }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('restaurantId', restaurant.id)
      const { data } = await api.post('/api/images/upload', fd)
      if (data.success) { setForm(f => ({ ...f, imageUrl: data.url })); toast.success('Image upload ho gaya!') }
    } catch { toast.error('Upload fail ho gaya') }
    finally { setUploadingImage(false) }
  }

  const addVariant    = () => setForm(f => ({ ...f, variants: [...f.variants, { name: '', nameHindi: '', price: '' }] }))
  const removeVariant = (idx) => setForm(f => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }))
  const updateVariant = (idx, field, val) => setForm(f => ({
    ...f, variants: f.variants.map((v, i) => i === idx ? { ...v, [field]: val } : v)
  }))

  const filtered = menuItems
    .filter(i => filterCat === 'All' || i.category === filterCat)
    .filter(i => !search || (i.name || '').toLowerCase().includes(search.toLowerCase()))

  // Category -> Subcategory -> items nested grouping.
  // Items without a subcategory land in a "General" bucket within their category.
  const grouped = useMemo(() => {
    const result = {}
    filtered.forEach(i => {
      const cat = i.category || 'Uncategorized'
      const subcat = i.subcategory?.trim() || 'General'
      if (!result[cat]) result[cat] = {}
      if (!result[cat][subcat]) result[cat][subcat] = []
      result[cat][subcat].push(i)
    })
    return result
  }, [filtered])

  const inp = {
    width: '100%', border: '1px solid #EFE7DB', borderRadius: '10px',
    padding: '10px 14px', fontSize: '13px', color: '#1E1A17',
    background: '#FFFDF9', outline: 'none', fontFamily: 'Jost,sans-serif',
    boxSizing: 'border-box',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '26px', fontWeight: '700', color: '#1E1A17', margin: 0 }}>
            {restaurant.name} — Menu
          </h2>
          <p style={{ color: '#6E6256', fontSize: '13px', margin: '4px 0 0' }}>{menuItems.length} items</p>
        </div>
        <button onClick={() => setShowForm(true)} style={primaryBtnStyle}>+ Item Add Karo</button>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
          style={{ ...inp, flex: 1 }} />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ ...inp, width: 'auto' }}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="dp-overlay" style={overlayStyle} onClick={e => e.target === e.currentTarget && resetForm()}>
          <div className="dp-dialog" style={{ ...modalStyle, maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '22px', fontWeight: '700', color: '#1E1A17', marginTop: 0 }}>
              {editItem ? 'Item Edit Karo' : 'Naya Item Add Karo'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
              {/* Name EN */}
              <label>
                <span style={labelStyle}>Name (English) *</span>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Cheese Burger" style={inp} />
              </label>
              {/* Name HI */}
              <label>
                <span style={labelStyle}>Name (Hindi)</span>
                <input type="text" value={form.nameHindi} onChange={e => setForm({ ...form, nameHindi: e.target.value })}
                  placeholder="चीज़ बर्गर" style={inp} />
              </label>

              {/* Price */}
              <label>
                <span style={labelStyle}>Price (₹) *</span>
                <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                  placeholder="250" style={inp} />
              </label>
              {/* Category */}
              <label>
                <span style={labelStyle}>Category</span>
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="Starters" list="cat-list-sa" style={inp} />
                <datalist id="cat-list-sa">
                  {categories.filter(c => c !== 'All').map(c => <option key={c} value={c} />)}
                </datalist>
              </label>

              {/* Category Hindi */}
              <label>
                <span style={labelStyle}>Category (Hindi)</span>
                <input type="text" value={form.categoryHindi} onChange={e => setForm({ ...form, categoryHindi: e.target.value })}
                  placeholder="स्टार्टर" style={inp} />
              </label>

              {/* Subcategory */}
              <label>
                <span style={labelStyle}>Subcategory <span style={{ textTransform: 'none', fontWeight: '400', color: '#9c9389' }}>(optional)</span></span>
                <input type="text" value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}
                  placeholder="Burgers" list="subcat-list-sa" style={inp} />
                <datalist id="subcat-list-sa">
                  {subcategorySuggestions.map(s => <option key={s} value={s} />)}
                </datalist>
              </label>

              {/* Subcategory Hindi */}
              <label>
                <span style={labelStyle}>Subcategory (Hindi)</span>
                <input type="text" value={form.subcategoryHindi} onChange={e => setForm({ ...form, subcategoryHindi: e.target.value })}
                  placeholder="बर्गर" style={inp} />
              </label>

              {/* Veg toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '24px' }}>
                <span style={labelStyle}>Veg/Non-Veg:</span>
                <button type="button" onClick={() => setForm({ ...form, isVeg: !form.isVeg })}
                  style={{
                    background: form.isVeg ? '#dcfce7' : '#fee2e2',
                    color: form.isVeg ? '#15803d' : '#b91c1c',
                    border: 'none', borderRadius: '8px', padding: '8px 16px',
                    fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Jost,sans-serif',
                  }}>
                  {form.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                </button>
              </div>

              {/* Bestseller toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px' }}>
                <span style={labelStyle}>Bestseller:</span>
                <button type="button" onClick={() => setForm({ ...form, isBestseller: !form.isBestseller })}
                  style={{
                    background: form.isBestseller ? '#fef9c3' : '#f3f4f6',
                    color: form.isBestseller ? '#854d0e' : '#374151',
                    border: 'none', borderRadius: '8px', padding: '8px 16px',
                    fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Jost,sans-serif',
                  }}>
                  {form.isBestseller ? '⭐ Yes' : 'No'}
                </button>
              </div>

              {/* Description EN */}
              <div style={{ gridColumn: '1/-1' }}>
                <span style={labelStyle}>Description (English)</span>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description..." style={{ ...inp, minHeight: '70px', resize: 'vertical' }} rows={2} />
              </div>
              {/* Description HI */}
              <div style={{ gridColumn: '1/-1' }}>
                <span style={labelStyle}>Description (Hindi)</span>
                <textarea value={form.descriptionHindi} onChange={e => setForm({ ...form, descriptionHindi: e.target.value })}
                  placeholder="विवरण..." style={{ ...inp, minHeight: '70px', resize: 'vertical' }} rows={2} />
              </div>

              {/* Image Upload */}
              <div style={{ gridColumn: '1/-1' }}>
                <span style={labelStyle}>Image</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ fontSize: '13px' }} />
                  {uploadingImage && (
                    <span style={{ color: '#B88746', fontSize: '13px', fontFamily: 'Jost,sans-serif' }}>Uploading...</span>
                  )}
                  {form.imageUrl && (
                    <img src={form.imageUrl} alt="preview"
                      style={{ width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #EFE7DB' }} />
                  )}
                </div>
              </div>

              {/* Variants */}
              <div style={{ gridColumn: '1/-1', borderTop: '1px solid #EFE7DB', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={labelStyle}>Variants hain?</span>
                  <button type="button" onClick={() => setForm({ ...form, hasVariants: !form.hasVariants })}
                    style={{
                      background: form.hasVariants ? '#fef9c3' : '#f3f4f6',
                      color: form.hasVariants ? '#854d0e' : '#374151',
                      border: 'none', borderRadius: '8px', padding: '6px 14px',
                      fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Jost,sans-serif',
                    }}>
                    {form.hasVariants ? 'Haan' : 'Nahi'}
                  </button>
                </div>
                {form.hasVariants && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.variants.map((v, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input value={v.name} onChange={e => updateVariant(idx, 'name', e.target.value)}
                          placeholder="Half / Full" style={{ ...inp, flex: 1 }} />
                        <input value={v.nameHindi} onChange={e => updateVariant(idx, 'nameHindi', e.target.value)}
                          placeholder="हिंदी" style={{ ...inp, width: '100px' }} />
                        <input type="number" value={v.price} onChange={e => updateVariant(idx, 'price', e.target.value)}
                          placeholder="₹" style={{ ...inp, width: '90px' }} />
                        <button onClick={() => removeVariant(idx)}
                          style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '14px' }}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <button onClick={addVariant}
                      style={{ ...ghostBtnStyle, alignSelf: 'flex-start', padding: '7px 16px', fontSize: '13px' }}>
                      + Variant Add Karo
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
                {saving ? 'Saving...' : editItem ? 'Update Karo' : 'Save Karo'}
              </button>
              <button onClick={resetForm} style={ghostBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <RowsSkeleton rows={4} height={72} />
      )}

      {/* Empty */}
      {!loading && menuItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6E6256' }}>
          Koi item nahi hai. <strong>+ Item Add Karo</strong> se shuru karo.
        </div>
      )}

      {/* Menu grid: Category -> Subcategory -> items */}
      {!loading && Object.entries(grouped).map(([cat, subcats]) => (
        <div key={cat} style={{ marginBottom: '32px' }}>
          <h3 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '22px', fontWeight: '700', color: '#1E1A17', marginBottom: '14px', borderBottom: '2px solid #B88746', paddingBottom: '8px' }}>
            {cat}
          </h3>

          {Object.entries(subcats).map(([subcat, items]) => (
            <div key={subcat} style={{ marginBottom: '20px', marginLeft: '4px' }}>
              {/* Only show a subcategory heading when it's a real subcategory, or when there are multiple buckets in this category */}
              {(subcat !== 'General' || Object.keys(subcats).length > 1) && (
                <h4 style={{
                  fontFamily: 'Jost,sans-serif', fontSize: '13px', fontWeight: '700',
                  color: '#B88746', textTransform: 'uppercase', letterSpacing: '0.6px',
                  marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#B88746' }} />
                  {subcat}
                </h4>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '16px' }}>
                {items.map(item => (
                  <div key={item.id} style={{
                    background: '#fff', borderRadius: '16px', overflow: 'hidden',
                    border: item.isAvailable ? '1px solid #EFE7DB' : '2px solid #fee2e2',
                    opacity: item.isAvailable ? 1 : 0.7,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name}
                        style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <div style={{ width: '100%', height: '80px', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                        {item.isVeg !== false ? '🥬' : '🍖'}
                      </div>
                    )}
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              width: '12px', height: '12px', borderRadius: '3px', flexShrink: 0,
                              border: `2px solid ${item.isVeg !== false ? '#2d7a2d' : '#c0392b'}`,
                              background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.isVeg !== false ? '#2d7a2d' : '#c0392b', display: 'block' }} />
                            </span>
                            <span style={{ fontWeight: '700', color: '#1E1A17', fontSize: '14px' }}>{item.name}</span>
                          </div>
                          {item.nameHindi && <p style={{ fontSize: '11px', color: '#6E6256', margin: '2px 0 0 18px' }}>{item.nameHindi}</p>}
                        </div>
                        <span style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '16px', fontWeight: '700', color: '#B88746', marginLeft: '8px' }}>
                          ₹{item.price}
                        </span>
                      </div>

                      {item.description && (
                        <p style={{ fontSize: '11px', color: '#6E6256', margin: '4px 0', lineHeight: '1.4' }}>
                          {item.description}
                        </p>
                      )}

                      {item.isBestseller && (
                        <span style={{ fontSize: '10px', background: '#fef9c3', color: '#854d0e', borderRadius: '6px', padding: '2px 8px', fontWeight: '700' }}>
                          ⭐ Bestseller
                        </span>
                      )}

                      {item.hasVariants && item.variants?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '6px 0' }}>
                          {item.variants.map((v, i) => (
                            <span key={i} style={{ fontSize: '10px', background: '#F5F0E8', color: '#6E6256', padding: '2px 8px', borderRadius: '20px' }}>
                              {v.name}: ₹{v.price}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                        <button onClick={() => toggleAvailability(item)}
                          style={{
                            flex: 1, padding: '7px', borderRadius: '8px', border: 'none',
                            background: item.isAvailable ? '#dcfce7' : '#fee2e2',
                            color: item.isAvailable ? '#15803d' : '#b91c1c',
                            fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Jost,sans-serif',
                          }}>
                          {item.isAvailable ? '✅ Available' : '❌ Sold Out'}
                        </button>
                        <button onClick={() => handleEdit(item)}
                          style={{ ...actionBtn('#eff6ff', '#1d4ed8'), padding: '7px 12px' }}>✏️</button>
                        <button onClick={() => handleDelete(item.id)}
                          style={{ ...actionBtn('#fee2e2', '#b91c1c'), padding: '7px 12px' }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main SuperAdmin component ────────────────────────────────────────────────
function SuperAdmin({ onManageRestaurant }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab]       = useState('restaurants') // 'restaurants' | 'menu'
  const [menuRestaurant, setMenuRestaurant] = useState(null)

  const [restaurants, setRestaurants]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [savingId, setSavingId]         = useState(null)

  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState({ name: '', address: '', ownerEmail: '' })

  const [staffModal, setStaffModal]     = useState(null)
  const [staffList, setStaffList]       = useState([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffForm, setStaffForm]       = useState({ email: '', password: '', role: 'chef' })
  const [addingStaff, setAddingStaff]   = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchRestaurants = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/restaurants')
      setRestaurants(res.data.restaurants || [])
    } catch (error) {
      toast.error(error.response?.data?.error || 'Restaurants load nahi hue')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchRestaurants() }, [])

  const stats = useMemo(() => {
    const s = { total: restaurants.length, active: 0, trial: 0, expired: 0, suspended: 0 }
    restaurants.forEach(r => {
      const status = r.subscription?.effectiveStatus || r.subscriptionStatus || 'expired'
      s[status] = (s[status] || 0) + 1
    })
    return s
  }, [restaurants])

  const addRestaurant = async () => {
    if (!form.name || !form.ownerEmail) { toast.error('Name aur owner email required hai'); return }
    try {
      const res = await api.post('/api/restaurants', form)
      setRestaurants(prev => [res.data.restaurant, ...prev])
      setForm({ name: '', address: '', ownerEmail: '' })
      setShowForm(false)
      toast.success(`${form.name} add ho gaya 15-day trial ke saath`)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Add nahi hua')
    }
  }

  const runAction = async (restaurant, action, days) => {
    try {
      setSavingId(`${restaurant.id}-${action}`)
      const res = await api.patch(`/api/restaurants/${restaurant.id}/subscription`, { action, days })
      setRestaurants(prev => prev.map(item => item.id === restaurant.id ? res.data.restaurant : item))
      const messages = {
        markPaid: '30 din ke liye paid mark hua',
        extendTrial: 'Trial 15 din extend hua',
        suspend: 'Service suspend ho gayi',
        reactivate: 'Service reactivate ho gayi',
      }
      toast.success(messages[action] || 'Update ho gaya')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Update fail')
    } finally { setSavingId(null) }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      setSavingId(`${deleteConfirm.id}-delete`)
      await api.delete(`/api/restaurants/${deleteConfirm.id}`)
      setRestaurants(prev => prev.filter(r => r.id !== deleteConfirm.id))
      toast.success(`${deleteConfirm.name} delete ho gaya`)
      setDeleteConfirm(null)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Delete fail')
    } finally { setSavingId(null) }
  }

  const openStaffModal = async (restaurant) => {
    setStaffModal(restaurant); setStaffLoading(true)
    try {
      const res = await api.get(`/api/restaurants/${restaurant.id}/staff`)
      setStaffList(res.data.staff || [])
    } catch { toast.error('Staff load nahi hua') }
    finally { setStaffLoading(false) }
  }

  const addStaff = async () => {
    if (!staffForm.email || !staffForm.password) { toast.error('Email aur password required'); return }
    if (staffForm.password.length < 6) { toast.error('Password kam se kam 6 characters ka hona chahiye'); return }
    try {
      setAddingStaff(true)
      const res = await api.post(`/api/restaurants/${staffModal.id}/staff`, staffForm)
      setStaffList(prev => [...prev, res.data.staff])
      setStaffForm({ email: '', password: '', role: 'chef' })
      toast.success(`${staffForm.role} account ban gaya`)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Staff create nahi hua')
    } finally { setAddingStaff(false) }
  }

  const removeStaff = async (uid) => {
    try {
      await api.delete(`/api/restaurants/${staffModal.id}/staff/${uid}`)
      setStaffList(prev => prev.filter(s => s.uid !== uid))
      toast.success('Staff remove ho gaya')
    } catch { toast.error('Remove nahi hua') }
  }

  const handleManage = (restaurant) => {
    onManageRestaurant(restaurant.id)
    navigate('/admin/dashboard')
  }

  const openMenuPanel = (restaurant) => {
    setMenuRestaurant(restaurant)
    setActiveTab('menu')
  }

  // ── Tab bar ────────────────────────────────────────────────────────────────
  const tabStyle = (active) => ({
    padding: '10px 20px', border: 'none', cursor: 'pointer',
    fontFamily: 'Jost,sans-serif', fontSize: '14px', fontWeight: '700',
    borderBottom: active ? '2px solid #B88746' : '2px solid transparent',
    background: 'none', color: active ? '#B88746' : '#6E6256',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ padding: '32px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Jost,sans-serif' }}>
      <Toaster position="top-right" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '36px', fontWeight: '700', color: '#1E1A17', margin: 0 }}>
            Super Admin
          </h1>
          <p style={{ color: '#6E6256', marginTop: '4px', fontSize: '14px' }}>
            Restaurants, staff, subscriptions aur menu manage karo
          </p>
        </div>
        {activeTab === 'restaurants' && (
          <button onClick={() => setShowForm(true)} style={primaryBtnStyle}>+ Restaurant Add Karo</button>
        )}
        {activeTab === 'menu' && menuRestaurant && (
          <button onClick={() => { setActiveTab('restaurants'); setMenuRestaurant(null) }} style={ghostBtnStyle}>
            ← Restaurants par wapas jao
          </button>
        )}
      </div>

      {/* Stats — sirf restaurants tab mein */}
      {activeTab === 'restaurants' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            ['Total', stats.total, '#eff6ff', '#1d4ed8'],
            ['Active', stats.active, '#dcfce7', '#15803d'],
            ['Trial', stats.trial, '#fef9c3', '#854d0e'],
            ['Expired', stats.expired, '#fee2e2', '#b91c1c'],
            ['Suspended', stats.suspended, '#f3f4f6', '#374151'],
          ].map(([label, value, bg, color]) => (
            <div key={label} style={{ background: bg, borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', fontWeight: '700', color, margin: 0 }}>{value}</p>
              <p style={{ fontSize: '13px', color, opacity: 0.75, margin: '4px 0 0' }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar — menu tab sirf tab bar dikhe jab menu restaurant select ho */}
      {menuRestaurant && (
        <div style={{ borderBottom: '1px solid #EFE7DB', marginBottom: '24px', display: 'flex' }}>
          <button style={tabStyle(activeTab === 'restaurants')} onClick={() => setActiveTab('restaurants')}>
            Restaurants
          </button>
          <button style={tabStyle(activeTab === 'menu')} onClick={() => setActiveTab('menu')}>
            📋 {menuRestaurant.name} — Menu
          </button>
        </div>
      )}

      {/* ── RESTAURANTS TAB ── */}
      {activeTab === 'restaurants' && (
        <>
          {/* Add Restaurant Form */}
          {showForm && (
            <div style={{ background: '#FFFDF9', border: '2px solid #D4A15A', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '22px', fontWeight: '700', color: '#1E1A17', marginTop: 0 }}>
                Naya Restaurant Add Karo
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '16px' }}>
                {[
                  { label: 'Restaurant Name *', key: 'name', type: 'text', placeholder: 'e.g. Spice Garden' },
                  { label: 'Owner Email *', key: 'ownerEmail', type: 'email', placeholder: 'owner@restaurant.com' },
                  { label: 'Address', key: 'address', type: 'text', placeholder: 'Restaurant address' },
                ].map(({ label, key, type, placeholder }) => (
                  <label key={key}>
                    <span style={labelStyle}>{label}</span>
                    <input type={type} value={form[key]}
                      onChange={e => setForm({ ...form, [key]: e.target.value })}
                      placeholder={placeholder} style={inputStyle} />
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button onClick={addRestaurant} style={primaryBtnStyle}>Add Restaurant</button>
                <button onClick={() => setShowForm(false)} style={ghostBtnStyle}>Cancel</button>
              </div>
            </div>
          )}

          {/* Restaurants Table */}
          <div style={{ background: '#FFFDF9', borderRadius: '16px', overflow: 'hidden', border: '1px solid #EFE7DB' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F5F0E8', borderBottom: '1px solid #EFE7DB' }}>
                  {['Restaurant', 'Status', 'Access Ends', 'Plan', 'Actions'].map(col => (
                    <th key={col} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6E6256', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: '16px' }}><RowsSkeleton rows={4} /></td></tr>
                ) : restaurants.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#6E6256' }}>Koi restaurant nahi hai</td></tr>
                ) : restaurants.map(restaurant => {
                  const sub = restaurant.subscription || {}
                  const status = sub.effectiveStatus || restaurant.subscriptionStatus || 'expired'
                  const endsAt = status === 'trial' ? sub.trialEndsAt : sub.currentPeriodEnd
                  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.expired

                  return (
                    <tr key={restaurant.id} style={{ borderBottom: '1px solid #F5F0E8' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <p style={{ fontWeight: '700', color: '#1E1A17', margin: 0, fontSize: '15px' }}>{restaurant.name}</p>
                        <p style={{ fontSize: '12px', color: '#6E6256', margin: '2px 0 0' }}>{restaurant.ownerEmail || restaurant.id}</p>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ background: statusStyle.bg, color: statusStyle.color, borderRadius: '999px', padding: '4px 12px', fontSize: '12px', fontWeight: '700' }}>
                          {status}
                        </span>
                        {sub.daysRemaining > 0 && (
                          <p style={{ fontSize: '11px', color: '#6E6256', margin: '4px 0 0' }}>{sub.daysRemaining} days left</p>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6E6256' }}>{formatDate(endsAt)}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ background: '#f3e8ff', color: '#7e22ce', borderRadius: '999px', padding: '4px 12px', fontSize: '12px', fontWeight: '700' }}>
                          ₹{sub.planAmount || 2000}/mo
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          <button onClick={() => handleManage(restaurant)} style={actionBtn('#B88746', '#fff')}>Manage</button>
                          <button onClick={() => openMenuPanel(restaurant)} style={actionBtn('#0d9488', '#fff')}>📋 Menu</button>
                          <button onClick={() => openStaffModal(restaurant)} style={actionBtn('#1d4ed8', '#fff')}>Staff</button>
                          <button onClick={() => runAction(restaurant, 'markPaid', 30)} disabled={!!savingId} style={actionBtn('#15803d', '#fff')}>Mark Paid</button>
                          <button onClick={() => runAction(restaurant, 'extendTrial', 15)} disabled={!!savingId} style={actionBtn('#854d0e', '#fff')}>+15 Trial</button>
                          <button onClick={() => runAction(restaurant, status === 'suspended' ? 'reactivate' : 'suspend')} disabled={!!savingId}
                            style={actionBtn(status === 'suspended' ? '#15803d' : '#6E6256', '#fff')}>
                            {status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                          <button onClick={() => setDeleteConfirm(restaurant)} disabled={!!savingId} style={actionBtn('#b91c1c', '#fff')}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}

      {/* ── MENU TAB ── */}
      {activeTab === 'menu' && menuRestaurant && (
        <MenuPanel restaurant={menuRestaurant} />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="dp-overlay" style={overlayStyle}>
          <div className="dp-dialog" style={modalStyle}>
            <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '24px', color: '#1E1A17', marginTop: 0 }}>
              Restaurant Delete Karo?
            </h2>
            <p style={{ color: '#6E6256', fontSize: '14px', lineHeight: '1.6' }}>
              <strong style={{ color: '#b91c1c' }}>{deleteConfirm.name}</strong> aur uske saare staff accounts, menu, tables permanently delete ho jayenge. Ye action undo nahi ho sakta.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={handleDelete}
                disabled={savingId?.endsWith('-delete')}
                style={{ ...primaryBtnStyle, background: '#b91c1c' }}
              >
                {savingId?.endsWith('-delete') ? 'Deleting...' : 'Haan, Delete Karo'}
              </button>
              <button onClick={() => setDeleteConfirm(null)} style={ghostBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {staffModal && (
        <div className="dp-overlay" style={overlayStyle}>
          <div className="dp-dialog" style={{ ...modalStyle, maxWidth: '560px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '24px', color: '#1E1A17', margin: 0 }}>
                {staffModal.name} — Staff
              </h2>
              <button onClick={() => setStaffModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6E6256' }}>✕</button>
            </div>

            {staffLoading ? (
              <RowsSkeleton rows={3} />
            ) : staffList.length === 0 ? (
              <p style={{ color: '#6E6256', fontSize: '14px' }}>Koi staff account nahi hai abhi.</p>
            ) : (
              <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {staffList.map(s => {
                  const rs = ROLE_STYLES[s.role] || ROLE_STYLES.chef
                  return (
                    <div key={s.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F0E8', borderRadius: '10px', padding: '12px 16px' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '600', color: '#1E1A17', fontSize: '14px' }}>{s.email}</p>
                        <span style={{ background: rs.bg, color: rs.color, borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: '700' }}>
                          {s.role}
                        </span>
                      </div>
                      <button onClick={() => removeStaff(s.uid)} style={actionBtn('#b91c1c', '#fff')}>Remove</button>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ borderTop: '1px solid #EFE7DB', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1E1A17', marginTop: 0 }}>Naya Staff Add Karo</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label>
                  <span style={labelStyle}>Role</span>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="chef">Chef</option>
                    <option value="receptionist">Receptionist</option>
                  </select>
                </label>
                <label>
                  <span style={labelStyle}>Email</span>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="chef@restaurant.com"
                    style={inputStyle}
                  />
                </label>
                <label>
                  <span style={labelStyle}>Password</span>
                  <input
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    placeholder="Min 6 characters"
                    style={inputStyle}
                  />
                </label>
                <button onClick={addStaff} disabled={addingStaff} style={primaryBtnStyle}>
                  {addingStaff ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperAdmin