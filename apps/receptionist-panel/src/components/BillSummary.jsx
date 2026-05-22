function BillSummary({ items, totalAmount, settlement, orders, onMarkItemServed }) {
  const payableAmount = settlement?.payableAmount ?? totalAmount
  const findOrderForItem = (item) =>
    orders?.find((order) =>
      order.items?.some((orderItem) => (orderItem.lineId || orderItem.id) === (item.lineId || item.id))
    )

  return (
    <div className="rounded-2xl border border-[rgba(184,135,70,0.16)] bg-[rgba(245,240,232,0.72)] p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text3)]">
          Order Items
        </p>
        <p className="text-xs font-medium text-[var(--text2)]">
          {items.length} line{items.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {items.map((item, index) => {
          const status = item.status || 'new'
          const order = findOrderForItem(item)
          return (
          <div key={item.lineId || item.id || index} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0 text-[var(--text)]">
              <span className="block truncate">{item.name}</span>
              <span className="text-xs text-[var(--text3)]">
                {item.quantity} x Rs. {item.price} | {status}
              </span>
              {onMarkItemServed && order && status === 'ready' && (
                <button
                  type="button"
                  onClick={() => onMarkItemServed(order, item)}
                  className="mt-2 rounded-lg bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700"
                >
                  Mark served
                </button>
              )}
            </span>
            <span className="shrink-0 font-semibold text-[var(--text)]">
              Rs. {item.price * item.quantity}
            </span>
          </div>
        )})}
      </div>

      {settlement && (
        <div className="mt-3 space-y-1 border-t border-[rgba(184,135,70,0.18)] pt-3 text-sm">
          <div className="flex justify-between text-[var(--text2)]">
            <span>Subtotal</span>
            <span>Rs. {settlement.subtotal}</span>
          </div>
          {settlement.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount</span>
              <span>- Rs. {settlement.discountAmount}</span>
            </div>
          )}
          {settlement.serviceChargeAmount > 0 && (
            <div className="flex justify-between text-[var(--text2)]">
              <span>Service charge</span>
              <span>Rs. {settlement.serviceChargeAmount}</span>
            </div>
          )}
          {settlement.gstAmount > 0 && (
            <div className="flex justify-between text-[var(--text2)]">
              <span>GST ({settlement.gstPercent}%)</span>
              <span>Rs. {settlement.gstAmount}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-[rgba(184,135,70,0.18)] pt-3">
        <span className="text-sm font-semibold text-[var(--text2)]">Payable</span>
        <span className="text-xl font-bold text-[var(--btn)]">Rs. {payableAmount}</span>
      </div>
    </div>
  )
}

export default BillSummary
