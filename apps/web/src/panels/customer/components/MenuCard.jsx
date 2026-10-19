import { useMemo, useState } from 'react'
import { useCart } from '../context/CartContext'

function MenuCard({ item, language = 'en' }) {
  const variants = Array.isArray(item.variants) ? item.variants : []
  const hasVariants = item.hasVariants && variants.length > 0
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0)
  const selectedVariant = hasVariants ? variants[selectedVariantIndex] : null

  const { cartItems, addToCart, removeFromCart } = useCart()
  const itemName = language === 'hi' ? item.nameHindi || item.name : item.name
  const itemDescription = language === 'hi' ? item.descriptionHindi || item.description : item.description
  const variantName = selectedVariant
    ? (language === 'hi' ? selectedVariant.nameHindi || selectedVariant.name : selectedVariant.name)
    : null
  const price = Number(selectedVariant?.price ?? item.price)
  const cartKey = useMemo(() => {
    return `${item.id}:${selectedVariant?.name || 'base'}`
  }, [item.id, selectedVariant?.name])
  const cartItem = cartItems.find(i => i.cartKey === cartKey)
  const quantity = cartItem ? cartItem.quantity : 0

  const addSelectedToCart = () => {
    addToCart({
      ...item,
      price,
      cartKey,
      variant: selectedVariant?.name || null,
      variantHindi: selectedVariant?.nameHindi || '',
    })
  }

  return (
    <div className="animate-fade-up" style={{
      background: 'var(--card)',
      borderRadius: '14px',
      border: '1px solid rgba(184,135,70,0.12)',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ position: 'relative' }}>
        <img
          src={item.imageUrl || 'https://via.placeholder.com/400x200?text=Food'}
          alt={itemName}
          style={{
            width: '100%',
            height: '160px',
            objectFit: 'cover',
            display: 'block',
            background: 'var(--bg2)'
          }}
          onError={e => { e.target.src = 'https://via.placeholder.com/400x200?text=Food' }}
        />

        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '20px',
          height: '20px',
          border: `2px solid ${item.isVeg !== false ? '#2d7a2d' : '#c0392b'}`,
          borderRadius: '4px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: item.isVeg !== false ? '#2d7a2d' : '#c0392b'
          }} />
        </div>

        {item.isBestseller && (
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            background: 'var(--btn)',
            color: 'var(--gold-l)',
            fontSize: '9px',
            fontWeight: '600',
            padding: '3px 8px',
            borderRadius: '6px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}>
            Bestseller
          </div>
        )}
      </div>

      <div style={{ padding: '12px' }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '500',
          color: 'var(--text)',
          marginBottom: '3px',
          lineHeight: '1.3'
        }}>
          {itemName}
        </div>
        <div style={{
          fontSize: '11px',
          color: 'var(--text2)',
          lineHeight: '1.4',
          marginBottom: '10px',
          minHeight: '30px'
        }}>
          {itemDescription}
        </div>

        {hasVariants && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {variants.map((variant, index) => {
              const label = language === 'hi' ? variant.nameHindi || variant.name : variant.name
              const active = selectedVariantIndex === index
              return (
                <button
                  type="button"
                  key={`${variant.name}-${index}`}
                  onClick={() => setSelectedVariantIndex(index)}
                  style={{
                    background: active ? 'rgba(184,135,70,0.16)' : 'var(--bg)',
                    border: active ? '1px solid rgba(184,135,70,0.45)' : '1px solid rgba(184,135,70,0.14)',
                    borderRadius: '999px',
                    color: active ? 'var(--gold-l)' : 'var(--text2)',
                    cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif",
                    fontSize: '11px',
                    fontWeight: '600',
                    padding: '5px 9px',
                  }}
                >
                  {label} - Rs. {variant.price}
                </button>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--gold)'
            }}>
              Rs. {price}
            </div>
            {variantName && (
              <div style={{ color: 'var(--text2)', fontSize: '10px', marginTop: '2px' }}>
                {variantName}
              </div>
            )}
          </div>

          {quantity === 0 ? (
            <button
              onClick={addSelectedToCart}
              style={addButtonStyle}
            >
              ADD +
            </button>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--btn)',
              borderRadius: '8px',
              padding: '5px 12px'
            }}>
              <button onClick={() => removeFromCart(cartKey)} style={qtyButtonStyle}>-</button>
              <span style={{
                color: '#FFFDF9',
                fontSize: '14px',
                fontWeight: '600',
                minWidth: '16px',
                textAlign: 'center'
              }}>
                {quantity}
              </span>
              <button onClick={addSelectedToCart} style={qtyButtonStyle}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const addButtonStyle = {
  background: 'var(--btn)',
  color: 'var(--gold-l)',
  border: 'none',
  borderRadius: '8px',
  padding: '7px 18px',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  fontFamily: "'Jost', sans-serif",
  letterSpacing: '0.5px',
}

const qtyButtonStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--gold-l)',
  fontSize: '18px',
  cursor: 'pointer',
  lineHeight: '1',
  padding: '0',
  fontFamily: "'Jost', sans-serif",
}

export default MenuCard
