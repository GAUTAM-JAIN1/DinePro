function CategoryTabs({
  categories,
  activeCategory,
  activeSubcategory,
  onSelect,
  onSelectSubcategory,
  getLabel = (cat) => cat,
  getSubcategories = () => [],
  getSubcategoryLabel = (sub) => sub,
  expandedCategory,
  onToggleExpand,
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '8px 0'
    }}>
      {/* "All" — no subcategories, behaves as before */}
      <button
        onClick={() => onSelect('All')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          borderRadius: '10px',
          border: activeCategory === 'All'
            ? '1px solid rgba(184,135,70,0.3)'
            : '1px solid transparent',
          background: activeCategory === 'All'
            ? 'rgba(184,135,70,0.12)'
            : 'transparent',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          transition: 'all 0.15s'
        }}
      >
        <span style={{
          fontSize: '12px',
          fontWeight: activeCategory === 'All' ? '500' : '400',
          color: activeCategory === 'All' ? '#FFFDF9' : 'rgba(255,253,249,0.5)',
          fontFamily: "'Jost', sans-serif",
          letterSpacing: '0.3px'
        }}>
          {getLabel('All')}
        </span>
      </button>

      {categories.map(cat => {
        const subcats = getSubcategories(cat)
        const hasSubcats = subcats.length > 0
        const isActive = activeCategory === cat
        const isExpanded = expandedCategory === cat

        return (
          <div key={cat}>
            <button
              onClick={() => {
                onSelect(cat)
                if (hasSubcats) onToggleExpand(cat)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '10px 16px',
                borderRadius: '10px',
                border: isActive
                  ? '1px solid rgba(184,135,70,0.3)'
                  : '1px solid transparent',
                background: isActive
                  ? 'rgba(184,135,70,0.12)'
                  : 'transparent',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
            >
              <span style={{
                fontSize: '12px',
                fontWeight: isActive ? '500' : '400',
                color: isActive ? '#FFFDF9' : 'rgba(255,253,249,0.5)',
                fontFamily: "'Jost', sans-serif",
                letterSpacing: '0.3px'
              }}>
                {getLabel(cat)}
              </span>
              {hasSubcats && (
                <span style={{
                  fontSize: '9px',
                  color: isActive ? '#FFFDF9' : 'rgba(255,253,249,0.35)',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}>
                  ▶
                </span>
              )}
            </button>

            {/* Subcategory list — only shown when this category is expanded */}
            {hasSubcats && isExpanded && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                marginLeft: '14px',
                marginTop: '2px',
                marginBottom: '4px',
                borderLeft: '1px solid rgba(184,135,70,0.2)',
                paddingLeft: '10px',
              }}>
                <button
                  onClick={() => onSelectSubcategory(cat, 'All')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 12px', borderRadius: '8px',
                    border: 'none',
                    background: (isActive && (!activeSubcategory || activeSubcategory === 'All'))
                      ? 'rgba(184,135,70,0.1)' : 'transparent',
                    cursor: 'pointer', width: '100%', textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontSize: '11px',
                    color: (isActive && (!activeSubcategory || activeSubcategory === 'All'))
                      ? '#FFFDF9' : 'rgba(255,253,249,0.4)',
                    fontFamily: "'Jost', sans-serif",
                  }}>
                    All {getLabel(cat)}
                  </span>
                </button>
                {subcats.map(sub => {
                  const subActive = isActive && activeSubcategory === sub
                  return (
                    <button
                      key={sub}
                      onClick={() => onSelectSubcategory(cat, sub)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '7px 12px', borderRadius: '8px',
                        border: 'none',
                        background: subActive ? 'rgba(184,135,70,0.1)' : 'transparent',
                        cursor: 'pointer', width: '100%', textAlign: 'left',
                      }}
                    >
                      <span style={{
                        fontSize: '11px',
                        color: subActive ? '#FFFDF9' : 'rgba(255,253,249,0.4)',
                        fontFamily: "'Jost', sans-serif",
                      }}>
                        {getSubcategoryLabel(sub)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default CategoryTabs