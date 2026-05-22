function CategoryTabs({ categories, activeCategory, onSelect, getLabel = (cat) => cat }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '8px 0'
    }}>
      {['All', ...categories].map(cat => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            borderRadius: '10px',
            border: activeCategory === cat
              ? '1px solid rgba(184,135,70,0.3)'
              : '1px solid transparent',
            background: activeCategory === cat
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
            fontWeight: activeCategory === cat ? '500' : '400',
            color: activeCategory === cat ? '#FFFDF9' : 'rgba(255,253,249,0.5)',
            fontFamily: "'Jost', sans-serif",
            letterSpacing: '0.3px'
          }}>
            {getLabel(cat)}
          </span>
        </button>
      ))}
    </div>
  )
}

export default CategoryTabs
