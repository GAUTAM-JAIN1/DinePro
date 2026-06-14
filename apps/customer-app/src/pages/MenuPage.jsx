import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMenu } from '../hooks/useMenu'
import { useTable } from '../hooks/useTable'
import { useCart } from '../context/CartContext'
import MenuCard from '../components/MenuCard'
import CategoryTabs from '../components/CategoryTabs'

function MenuPage() {
  const { restaurantId, tableId } = useParams()
  const { menu, loading, error, serviceUnavailable, restaurant } = useMenu(restaurantId)
  const {
    table,
    loading: tableLoading,
    error: tableError,
    serviceUnavailable: tableServiceUnavailable,
  } = useTable(restaurantId, tableId)
  const { totalItems, totalAmount } = useCart()
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('All')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [language, setLanguage] = useState('en')
  const [dietFilter, setDietFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const categories = useMemo(() => {
    return [...new Set(menu.map(item => item.category).filter(Boolean))]
  }, [menu])

  const categoryLabels = useMemo(() => {
    const labels = { All: language === 'hi' ? 'सभी' : 'All' }
    menu.forEach(item => {
      if (item.category) {
        labels[item.category] = language === 'hi'
          ? item.categoryHindi || item.category
          : item.category
      }
    })
    return labels
  }, [language, menu])

  const filteredMenu = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return menu.filter(item => {
      if (item.isAvailable === false) return false
      if (activeCategory !== 'All' && item.category !== activeCategory) return false
      if (dietFilter === 'veg' && item.isVeg === false) return false
      if (dietFilter === 'nonveg' && item.isVeg !== false) return false
      if (!query) return true
      const searchable = [
        item.name, item.nameHindi, item.description,
        item.descriptionHindi, item.category, item.categoryHindi,
      ].filter(Boolean).join(' ').toLowerCase()
      return searchable.includes(query)
    })
  }, [activeCategory, dietFilter, menu, searchQuery])

  const tableNumber = table?.tableNumber || tableId
  const restaurantName = restaurant?.name || 'Our Menu'
  const categoryTitle = activeCategory === 'All'
    ? (language === 'hi' ? 'सभी व्यंजन' : 'All Dishes')
    : categoryLabels[activeCategory] || activeCategory

  if (!restaurantId || !tableId) {
    return <CenteredState title="Invalid QR" message="Restaurant or table is missing from this link." />
  }
  if (loading || tableLoading) {
    return <CenteredState title="Loading menu" message="Preparing your digital menu..." />
  }
  if (serviceUnavailable || tableServiceUnavailable) {
    return <CenteredState title="Service unavailable" message={`${restaurantName} is not accepting digital menu orders right now.`} />
  }
  if (error || tableError) {
    return <CenteredState title="Could not open menu" message={tableError || error} />
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; }
        .layout { display: flex; min-height: 100vh; width: 100%; overflow-x: hidden; }
        .sidebar {
          width: 200px;
          min-width: 200px;
          background: var(--sidebar);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          z-index: 50;
          flex-shrink: 0;
        }
        .main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; max-width: 100%; }
        .mobile-menu-btn { display: none; }
        .mobile-overlay { display: none; }

        @media (max-width: 640px) {
          .sidebar {
            position: fixed;
            left: -200px;
            top: 0;
            height: 100vh;
            transition: left 0.3s ease;
            z-index: 100;
          }
          .sidebar.open { left: 0; }
          .mobile-menu-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            background: var(--sidebar);
            border: 1px solid rgba(184,135,70,0.3);
            border-radius: 8px;
            cursor: pointer;
            flex-shrink: 0;
          }
          .mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 90;
          }
          .main-content { width: 100%; }
        }
      `}</style>

      <div className="layout">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(184,135,70,0.15)' }}>
            {restaurant?.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurantName} style={{
                width: '44px', height: '44px', objectFit: 'cover',
                borderRadius: '50%', marginBottom: '10px',
                border: '1px solid rgba(184,135,70,0.25)'
              }} />
            ) : (
              <div style={{
                width: '44px', height: '44px', border: '1.5px solid var(--gold)',
                borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: '10px',
                color: 'var(--gold)', fontSize: '12px', fontWeight: '700'
              }}>MENU</div>
            )}
            <div style={{ fontFamily: "'Cormorant Garamond', serif", color: '#FFFDF9', fontSize: '16px', fontWeight: '600' }}>
              {restaurantName}
            </div>
            <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,253,249,0.3)', textTransform: 'uppercase', marginTop: '3px' }}>
              Digital Menu
            </div>
          </div>

          <div style={{ margin: '14px 16px', background: 'rgba(184,135,70,0.12)', border: '1px solid rgba(184,135,70,0.25)', borderRadius: '10px', padding: '10px 12px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', color: 'var(--gold-l)', textTransform: 'uppercase' }}>Your Table</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", color: '#FFFDF9', fontSize: '22px', fontWeight: '600', marginTop: '2px' }}>
              {tableNumber}
            </div>
          </div>

          <div style={{ flex: '1', padding: '8px 10px', overflowY: 'auto' }}>
            <CategoryTabs
              categories={categories}
              activeCategory={activeCategory}
              getLabel={(cat) => categoryLabels[cat] || cat}
              onSelect={(cat) => { setActiveCategory(cat); setSidebarOpen(false) }}
            />
          </div>
        </div>

        {/* Main content */}
        <div className="main-content">
          {/* Top bar */}
          <div style={{
            background: 'var(--card)', borderBottom: '1px solid rgba(184,135,70,0.12)',
            padding: '10px 14px', display: 'flex', alignItems: 'center',
            gap: '8px', position: 'sticky', top: '0', zIndex: '30', flexWrap: 'wrap'
          }}>
            {/* Hamburger for mobile */}
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <span style={{ color: 'var(--gold)', fontSize: '18px' }}>☰</span>
            </button>

            {/* Search */}
            <div style={{
              flex: '1', minWidth: '120px', background: 'var(--bg)',
              border: '1px solid rgba(184,135,70,0.2)', borderRadius: '10px',
              padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <span style={{ color: 'var(--text2)', fontSize: '12px' }}>Search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'hi' ? 'डिश खोजें...' : 'Search dishes...'}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  fontFamily: "'Jost', sans-serif", fontSize: '12px',
                  color: 'var(--text)', width: '100%'
                }}
              />
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: language === 'hi' ? 'सभी' : 'All' },
                { key: 'veg', label: language === 'hi' ? 'शाकाहारी' : 'Veg' },
                { key: 'nonveg', label: language === 'hi' ? 'नॉन-वेज' : 'Non-Veg' },
              ].map(filter => (
                <button type="button" key={filter.key} onClick={() => setDietFilter(filter.key)} style={pillStyle(dietFilter === filter.key)}>
                  {filter.label}
                </button>
              ))}
              <button type="button" onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')} style={pillStyle(true)}>
                {language === 'en' ? 'HI' : 'EN'}
              </button>
            </div>
          </div>

          {/* Menu items */}
          <div style={{ flex: '1', padding: '16px', overflowY: 'auto' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '24px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
              {categoryTitle}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '12px', fontStyle: 'italic' }}>
              {filteredMenu.length} {language === 'hi' ? 'आइटम उपलब्ध' : 'items available'}
            </div>
            <div style={{ width: '40px', height: '1.5px', background: 'var(--gold)', marginBottom: '20px' }} />

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '12px'
            }}>
              {filteredMenu.map(item => (
                <MenuCard key={item.id} item={item} language={language} />
              ))}
            </div>

            {filteredMenu.length === 0 && (
              <div style={{ color: 'var(--text2)', textAlign: 'center', padding: '36px 12px' }}>
                {language === 'hi' ? 'कोई आइटम नहीं मिला।' : 'No items found.'}
              </div>
            )}
          </div>

          {/* Cart button */}
          {totalItems > 0 && (
            <div style={{ padding: '12px 16px', background: 'var(--card)', borderTop: '1px solid rgba(184,135,70,0.12)', position: 'sticky', bottom: '0' }}>
              <button
                onClick={() => navigate(`/${restaurantId}/table/${table?.id || tableId}/cart`)}
                style={{
                  width: '100%', background: 'var(--btn)', border: '1px solid rgba(184,135,70,0.3)',
                  borderRadius: '12px', padding: '13px 16px', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer', fontFamily: "'Jost', sans-serif"
                }}
              >
                <span style={{ background: 'rgba(184,135,70,0.2)', color: 'var(--gold-l)', fontSize: '11px', fontWeight: '600', padding: '4px 8px', borderRadius: '8px' }}>
                  {totalItems} {language === 'hi' ? 'आइटम' : 'items'}
                </span>
                <span style={{ color: '#FFFDF9', fontSize: '13px', fontWeight: '500' }}>
                  {language === 'hi' ? 'कार्ट देखें' : 'View Cart'}
                </span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '17px', fontWeight: '600', color: 'var(--gold-l)' }}>
                  Rs. {totalAmount}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function CenteredState({ title, message }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: '24px', textAlign: 'center' }}>
      <div>
        <h1 style={{ color: 'var(--text)', fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', marginBottom: '8px' }}>{title}</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px' }}>{message}</p>
      </div>
    </div>
  )
}

const pillStyle = (active) => ({
  padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
  background: active ? 'var(--btn)' : 'var(--bg)',
  color: active ? 'var(--gold-l)' : 'var(--text2)',
  border: active ? '1px solid rgba(184,135,70,0.3)' : '1px solid rgba(184,135,70,0.15)',
  cursor: 'pointer', fontFamily: "'Jost', sans-serif", whiteSpace: 'nowrap'
})

export default MenuPage