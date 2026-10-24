import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import api from '@/lib/api'
import SetupLinkDialog from '@/components/SetupLinkDialog'
import MenuManager from './MenuManager'
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
  const [staffForm, setStaffForm]       = useState({ email: '', role: 'chef' })
  const [addingStaff, setAddingStaff]   = useState(false)
  const [setupDialog, setSetupDialog]   = useState(null)

  const [deleteConfirm, setDeleteConfirm] = useState(null)
  // Bug #69: Mark Paid / Reactivate need a payment record before the server accepts them.
  const [paymentDraft, setPaymentDraft] = useState(null)

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
      // Bug #54: the owner gets an admin account and a setup link right away.
      if (res.data.owner?.setupLink) {
        setSetupDialog({ title: 'Owner account ready', email: res.data.owner.email, link: res.data.owner.setupLink })
      } else if (res.data.ownerError) {
        toast.error(`Restaurant bana, lekin owner account nahi bana: ${res.data.ownerError}`)
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Add nahi hua')
    }
  }

  const runAction = async (restaurant, action, days, payment) => {
    try {
      setSavingId(`${restaurant.id}-${action}`)
      const body = { action, days, ...(payment ? { payment } : {}) }
      const res = await api.patch(`/api/restaurants/${restaurant.id}/subscription`, body)
      setRestaurants(prev => prev.map(item => item.id === restaurant.id ? res.data.restaurant : item))
      const messages = {
        markPaid: '30 din ke liye paid mark hua (payment record save ho gaya)',
        extendTrial: '15 din add ho gaye',
        suspend: 'Service suspend ho gayi',
        reactivate: 'Service reactivate ho gayi (payment record save ho gaya)',
      }
      toast.success(messages[action] || 'Update ho gaya')
      return true
    } catch (error) {
      toast.error(error.response?.data?.error || 'Update fail')
      return false
    } finally { setSavingId(null) }
  }

  const openPaymentDraft = (restaurant, action) => {
    setPaymentDraft({ restaurant, action, days: 30, amount: '2000', method: 'upi', reference: '' })
  }

  const submitPaymentDraft = async () => {
    if (!paymentDraft) return
    const { restaurant, action, days, amount, method, reference } = paymentDraft
    if (!(Number(amount) > 0)) { toast.error('Amount sahi daalo'); return }
    if (method !== 'cash' && reference.trim().length < 3) {
      toast.error('UPI / bank / card reference daalo (kam se kam 3 characters)')
      return
    }
    // Keep the form open on failure so the admin doesn't have to retype it.
    const saved = await runAction(restaurant, action, days, { amount: Number(amount), method, reference: reference.trim() })
    if (saved) setPaymentDraft(null)
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      setSavingId(`${deleteConfirm.id}-delete`)
      await api.delete(`/api/restaurants/${deleteConfirm.id}`)
      setRestaurants(prev => prev.filter(r => r.id !== deleteConfirm.id))
      toast.success(`${deleteConfirm.name} archive ho gaya`)
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
    if (!staffForm.email) { toast.error('Email required hai'); return }
    try {
      setAddingStaff(true)
      const res = await api.post(`/api/restaurants/${staffModal.id}/staff`, staffForm)
      const created = res.data.staff
      setStaffList(prev => [...prev, created])
      setStaffForm({ email: '', role: 'chef' })
      toast.success(`${staffForm.role} account ban gaya`)
      if (created.setupLink) {
        setSetupDialog({ title: `${staffForm.role} account ready`, email: created.email, link: created.setupLink })
      } else {
        toast.error(created.setupLinkError || 'Setup link nahi bana')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Staff create nahi hua')
    } finally { setAddingStaff(false) }
  }

  const removeStaff = async (uid) => {
    if (!window.confirm('Is staff account ko remove karna hai? Ye undo nahi hoga.')) return
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
                          <button onClick={() => openPaymentDraft(restaurant, 'markPaid')} disabled={!!savingId} style={actionBtn('#15803d', '#fff')}>Mark Paid</button>
                          <button onClick={() => runAction(restaurant, 'extendTrial', 15)} disabled={!!savingId} style={actionBtn('#854d0e', '#fff')}>+15 Days</button>
                          {status === 'suspended' ? (
                            <button onClick={() => openPaymentDraft(restaurant, 'reactivate')} disabled={!!savingId} style={actionBtn('#15803d', '#fff')}>Reactivate</button>
                          ) : (
                            <button onClick={() => runAction(restaurant, 'suspend')} disabled={!!savingId} style={actionBtn('#6E6256', '#fff')}>Suspend</button>
                          )}
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
        <MenuManager restaurant={menuRestaurant} />
      )}

      {/* Payment record modal — Mark Paid / Reactivate */}
      {paymentDraft && (
        <div className="dp-overlay" style={overlayStyle}>
          <div className="dp-dialog" style={modalStyle}>
            <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '24px', color: '#1E1A17', marginTop: 0 }}>
              {paymentDraft.action === 'reactivate' ? 'Reactivate' : 'Mark Paid'} — {paymentDraft.restaurant.name}
            </h2>
            <p style={{ color: '#6E6256', fontSize: '13px', lineHeight: '1.6' }}>
              Payment ka record banega aur audit log mein jaayega. Plan: {paymentDraft.days} din.
            </p>
            <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
              <label style={{ fontSize: '13px', color: '#6E6256' }}>
                Amount (Rs.)
                <input
                  type="number" min="1" value={paymentDraft.amount}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, amount: e.target.value })}
                  style={{ width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #e5dccd' }}
                />
              </label>
              <label style={{ fontSize: '13px', color: '#6E6256' }}>
                Payment method
                <select
                  value={paymentDraft.method}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, method: e.target.value })}
                  style={{ width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #e5dccd' }}
                >
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label style={{ fontSize: '13px', color: '#6E6256' }}>
                Reference (UTR / txn id){paymentDraft.method === 'cash' ? ' — optional' : ''}
                <input
                  value={paymentDraft.reference}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, reference: e.target.value })}
                  placeholder="e.g. UTR 4189xxxxxx"
                  style={{ width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #e5dccd' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={submitPaymentDraft} disabled={!!savingId} style={primaryBtnStyle}>
                {savingId ? 'Saving...' : 'Save payment'}
              </button>
              <button onClick={() => setPaymentDraft(null)} style={ghostBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="dp-overlay" style={overlayStyle}>
          <div className="dp-dialog" style={modalStyle}>
            <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '24px', color: '#1E1A17', marginTop: 0 }}>
              Restaurant Delete Karo?
            </h2>
            <p style={{ color: '#6E6256', fontSize: '14px', lineHeight: '1.6' }}>
              <strong style={{ color: '#b91c1c' }}>{deleteConfirm.name}</strong> archive ho jayega. Customers aur staff ke liye ye band ho jayega. Orders, bills, reports aur audit history save rahenge, kuch delete nahi hoga.
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
                    <option value="admin">Admin (owner)</option>
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
                <button onClick={addStaff} disabled={addingStaff} style={primaryBtnStyle}>
                  {addingStaff ? 'Creating...' : 'Create Account & Get Setup Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {setupDialog && (
        <SetupLinkDialog
          title={setupDialog.title}
          email={setupDialog.email}
          link={setupDialog.link}
          onClose={() => setSetupDialog(null)}
        />
      )}
    </div>
  )
}

export default SuperAdmin