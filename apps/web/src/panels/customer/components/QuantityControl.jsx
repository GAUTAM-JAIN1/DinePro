/**
 * QuantityControl - +/- buttons for item quantity
 */

export default function QuantityControl({ quantity, onIncrease, onDecrease }) {
  return (
    <div className="quantity-control">
      <button onClick={onDecrease} disabled={quantity <= 1}>
        −
      </button>
      <span className="quantity">{quantity}</span>
      <button onClick={onIncrease}>+</button>
    </div>
  )
}
