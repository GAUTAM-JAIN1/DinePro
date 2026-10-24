import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useOrder } from '../hooks/useOrder'
import { readVerifiedTable } from '../hooks/useTable'
import { lineTotal } from '../../../lib/money'

// One key per submission. A retry of the SAME cart reuses the key, so the
// server returns the first order instead of creating a duplicate (Bug #51).
// Change the cart and the key changes too, so an edited order is never
// mistaken for the old one.
const newSubmissionKey = () => {
  const random = globalThis.crypto?.randomUUID?.()
  return random || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function CartPage() {
  const { restaurantId, tableId } = useParams()
  const {
    cartItems,
    addToCart,
    removeFromCart,
    updateItemInstructions,
    totalAmount,
    clearCart,
  } = useCart()
  const { placeOrder, loading } = useOrder()
  const navigate = useNavigate()
  const [orderNote, setOrderNote] = useState('')
  const [orderError, setOrderError] = useState('')
  const attemptRef = useRef({ key: null, signature: null })
  const verifiedTable = readVerifiedTable(restaurantId, tableId)
  // Display only. The server works out the table number from the table doc (Bug #53).
  const tableNumber = verifiedTable?.tableNumber || tableId

  const handlePlaceOrder = async () => {
    if (loading || cartItems.length === 0) return

    // What the server will price: menu id, variant, quantity, note. Never a price.
    const payloadItems = cartItems.map(item => ({
      id: item.id,
      variant: item.variant || null,
      quantity: Number(item.quantity),
      specialInstructions: (item.specialInstructions || '').trim(),
    }))
    const specialInstructions = orderNote.trim()
    const signature = JSON.stringify({ items: payloadItems, specialInstructions })

    // Reuse the key only while the cart is unchanged (Bug #38: no client lock; a failed attempt can just be retried).
    if (!attemptRef.current.key || attemptRef.current.signature !== signature) {
      attemptRef.current = { key: newSubmissionKey(), signature }
    }

    setOrderError('')

    const result = await placeOrder({
      restaurantId,
      tableId,
      specialInstructions,
      items: payloadItems,
      idempotencyKey: attemptRef.current.key,
    })

    if (result.success) {
      attemptRef.current = { key: null, signature: null }
      clearCart()
      navigate(`/r/${restaurantId}/table/${tableId}/confirmed`)
    } else {
      setOrderError(result.error || 'Could not place order. Please try again.')
    }
  }

  if (cartItems.length === 0) return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg)',
      gap: '16px',
      padding: '24px',
      textAlign: 'center'
    }}>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '42px',
        color: 'var(--gold)'
      }}>Cart</div>
      <p style={{ color: 'var(--text2)', fontSize: '16px' }}>Your cart is empty</p>
      <button onClick={() => navigate(-1)} style={buttonStyle}>
        Browse Menu
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{
        background: 'var(--sidebar)',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <button onClick={() => navigate(-1)} aria-label="Back to menu" style={backButtonStyle}>
          Back
        </button>
        <div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            color: '#FFFDF9',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            Your Order
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,253,249,0.4)', marginTop: '2px' }}>
            Table {tableNumber}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {cartItems.map(item => (
            <div key={item.cartKey || item.id} style={cartItemStyle}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{ flex: '1', minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', lineHeight: '1.35' }}>
                    {item.name}
                  </div>
                  {item.variant && (
                    <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '3px' }}>
                      Variant: {item.variantHindi || item.variant}
                    </div>
                  )}
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '16px',
                    color: 'var(--gold)',
                    marginTop: '3px'
                  }}>
                    Rs. {item.price}
                  </div>
                </div>

                <div style={quantityControlStyle}>
                  <button onClick={() => removeFromCart(item.cartKey || item.id)} aria-label={`Remove one ${item.name}`} style={qtyButtonStyle}>
                    -
                  </button>
                  <span style={{ color: '#FFFDF9', fontSize: '14px', fontWeight: '600', minWidth: '16px', textAlign: 'center' }}>
                    {item.quantity}
                  </span>
                  <button onClick={() => addToCart(item)} aria-label={`Add one ${item.name}`} style={qtyButtonStyle}>
                    +
                  </button>
                </div>

                <div style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'var(--text2)',
                  minWidth: '70px',
                  textAlign: 'right'
                }}>
                  Rs. {lineTotal(item)}
                </div>
              </div>

              <label style={labelStyle} htmlFor={`note-${item.id}`}>
                Item instructions
              </label>
              <textarea
                id={`note-${item.cartKey || item.id}`}
                value={item.specialInstructions || ''}
                onChange={event => updateItemInstructions(item.cartKey || item.id, event.target.value)}
                placeholder="Example: less spicy, no onion, extra chutney"
                rows={2}
                maxLength={160}
                style={textareaStyle}
              />
            </div>
          ))}
        </div>

        <div style={sectionStyle}>
          <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="order-note">
            Order-level note
          </label>
          <textarea
            id="order-note"
            value={orderNote}
            onChange={event => setOrderNote(event.target.value)}
            placeholder="Example: serve together, allergy details, birthday request"
            rows={3}
            maxLength={240}
            style={textareaStyle}
          />
        </div>

        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '12px' }}>
            Bill Summary
          </div>
          {cartItems.map(item => (
            <div key={item.cartKey || item.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '12px',
              color: 'var(--text2)',
              marginBottom: '6px'
            }}>
              <span>{item.name}{item.variant ? ` (${item.variantHindi || item.variant})` : ''} x {item.quantity}</span>
              <span>Rs. {lineTotal(item)}</span>
            </div>
          ))}
          <div style={{
            borderTop: '1px solid rgba(184,135,70,0.15)',
            marginTop: '10px',
            paddingTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Subtotal</span>
            <span style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '22px',
              fontWeight: '600',
              color: 'var(--gold)'
            }}>
              Rs. {totalAmount}
            </span>
          </div>
        </div>

        <button
          onClick={handlePlaceOrder}
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? 'var(--text3)' : 'var(--btn)',
            border: '1px solid rgba(184,135,70,0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'Jost', sans-serif"
          }}
        >
          <span style={{ color: '#FFFDF9', fontSize: '15px', fontWeight: '500' }}>
            {loading ? 'Placing Order...' : 'Place Order'}
          </span>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '20px',
            fontWeight: '600',
            color: 'var(--gold-l)'
          }}>
            Rs. {totalAmount}
          </span>
        </button>
        {orderError && (
          <div style={{
            color: '#ff8a7a',
            fontSize: '12px',
            lineHeight: '1.4',
            marginTop: '10px',
            textAlign: 'center'
          }}>
            {orderError}
          </div>
        )}
      </div>
    </div>
  )
}

const buttonStyle = {
  background: 'var(--btn)',
  color: 'var(--gold-l)',
  border: 'none',
  borderRadius: '10px',
  padding: '12px 28px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  fontFamily: "'Jost', sans-serif",
}

const backButtonStyle = {
  background: 'rgba(184,135,70,0.1)',
  border: '1px solid rgba(184,135,70,0.2)',
  borderRadius: '10px',
  padding: '8px 14px',
  color: 'var(--gold-l)',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '600',
  fontFamily: "'Jost', sans-serif",
}

const cartItemStyle = {
  background: 'var(--card)',
  borderRadius: '14px',
  border: '1px solid rgba(184,135,70,0.12)',
  padding: '14px 16px',
}

const quantityControlStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  background: 'var(--btn)',
  borderRadius: '8px',
  padding: '6px 12px',
  flexShrink: 0,
}

const qtyButtonStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--gold-l)',
  fontSize: '18px',
  cursor: 'pointer',
  lineHeight: '1',
  padding: '0',
}

const sectionStyle = {
  background: 'var(--card)',
  borderRadius: '14px',
  border: '1px solid rgba(184,135,70,0.12)',
  padding: '16px',
  marginBottom: '20px',
}

const labelStyle = {
  display: 'block',
  color: 'var(--text2)',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.5px',
  marginTop: '12px',
  marginBottom: '7px',
  textTransform: 'uppercase',
}

const textareaStyle = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid rgba(184,135,70,0.15)',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '13px',
  color: 'var(--text)',
  fontFamily: "'Jost', sans-serif",
  resize: 'vertical',
  outline: 'none',
  minHeight: '74px',
}

export default CartPage
