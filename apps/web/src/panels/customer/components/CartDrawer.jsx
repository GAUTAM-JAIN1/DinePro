/**
 * CartDrawer - Slide-up cart with item count badge
 */

export default function CartDrawer({ items, onClose, onCheckout }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <div className="cart-drawer">
      <div className="cart-header">
        <h2>Cart ({items.length})</h2>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="cart-items">
        {items.map((item) => (
          <div key={item.id} className="cart-item">
            <span>{item.name}</span>
            <span>₹{item.price * item.quantity}</span>
          </div>
        ))}
      </div>
      <div className="cart-total">
        <strong>Total: ₹{total}</strong>
      </div>
      <button className="checkout-btn" onClick={onCheckout}>
        Checkout
      </button>
    </div>
  )
}
