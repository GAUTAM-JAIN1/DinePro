function PrintBill({ tableNumber, items, totalAmount, settlement, restaurantName, onClose }) {
  const handlePrint = () => window.print()
  const payableAmount = settlement?.payableAmount ?? totalAmount

  // Task 3.3 — Auto-generate bill number: BILL-YYYYMMDD-HHMMSS
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const billNumber = `BILL-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

  return (
    <>
      {/* Screen overlay — hidden when printing */}
      <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center">
        <div className="w-full max-w-sm rounded-3xl bg-[var(--card)] p-5 shadow-2xl sm:p-6">
          <div className="mb-4 border-b border-[rgba(184,135,70,0.18)] pb-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--gold)]">
              Bill Preview
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--text)]">
              {restaurantName}
            </h2>
            <p className="mt-1 text-sm text-[var(--text2)]">Table {tableNumber}</p>
            <p className="mt-1 text-xs text-[var(--text3)]">
              {now.toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-xs font-mono text-[var(--text3)]">{billNumber}</p>
          </div>

          <div className="mb-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {items.map((item, index) => (
              <div key={index} className="flex justify-between gap-3 text-sm">
                <span className="text-[var(--text2)]">
                  {item.name} x {item.quantity}
                </span>
                <span className="font-semibold text-[var(--text)]">
                  Rs. {item.price * item.quantity}
                </span>
              </div>
            ))}
          </div>

          <div className="mb-5 border-t border-[rgba(184,135,70,0.18)] pt-4">
            {settlement && (
              <div className="mb-3 space-y-1 text-sm text-[var(--text2)]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rs. {settlement.subtotal}</span>
                </div>
                {settlement.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>- Rs. {settlement.discountAmount}</span>
                  </div>
                )}
                {settlement.serviceChargeAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Service charge</span>
                    <span>Rs. {settlement.serviceChargeAmount}</span>
                  </div>
                )}
                {settlement.gstAmount > 0 && (
                  <div className="flex justify-between">
                    <span>GST ({settlement.gstPercent}%)</span>
                    <span>Rs. {settlement.gstAmount}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Payable Amount</span>
              <span className="text-[var(--btn)]">Rs. {payableAmount}</span>
            </div>
            {settlement?.paymentMode && (
              <p className="mt-2 text-center text-xs uppercase tracking-[0.16em] text-[var(--text3)]">
                {settlement.paymentMode}
              </p>
            )}
            <p className="mt-2 text-center text-xs text-[var(--text3)]">
              Thank you for dining with us.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className="action-button secondary">
              Close
            </button>
            <button type="button" onClick={handlePrint} className="action-button primary">
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Task 3.3 — Actual print receipt — only visible when printing */}
      <div className="print-only receipt-paper">
        <div className="receipt-header">
          <h1>{restaurantName}</h1>
          <p>Table {tableNumber}</p>
          <p>{now.toLocaleString('en-IN')}</p>
          <p className="bill-number">{billNumber}</p>
          <div className="receipt-divider">--------------------------------</div>
        </div>

        <div className="receipt-items">
          {items.map((item, index) => (
            <div key={index} className="receipt-item">
              <span>{item.name} x{item.quantity}</span>
              <span>Rs.{item.price * item.quantity}</span>
            </div>
          ))}
        </div>

        <div className="receipt-divider">--------------------------------</div>

        <div className="receipt-totals">
          <div className="receipt-item">
            <span>Subtotal</span>
            <span>Rs.{settlement?.subtotal ?? totalAmount}</span>
          </div>
          {settlement?.discountAmount > 0 && (
            <div className="receipt-item">
              <span>Discount</span>
              <span>-Rs.{settlement.discountAmount}</span>
            </div>
          )}
          {settlement?.serviceChargeAmount > 0 && (
            <div className="receipt-item">
              <span>Service Charge</span>
              <span>Rs.{settlement.serviceChargeAmount}</span>
            </div>
          )}
          {settlement?.gstAmount > 0 && (
            <div className="receipt-item">
              <span>GST ({settlement.gstPercent}%)</span>
              <span>Rs.{settlement.gstAmount}</span>
            </div>
          )}
          <div className="receipt-divider">--------------------------------</div>
          <div className="receipt-item receipt-total">
            <span>TOTAL</span>
            <span>Rs.{payableAmount}</span>
          </div>
          {settlement?.paymentMode && (
            <div className="receipt-payment">
              Payment: {settlement.paymentMode.toUpperCase()}
              {settlement.paymentReference ? ` (${settlement.paymentReference})` : ''}
            </div>
          )}
        </div>

        <div className="receipt-footer">
          <div className="receipt-divider">--------------------------------</div>
          <p>Thank you for dining with us!</p>
          <p>Please visit again</p>
        </div>
      </div>
    </>
  )
}

export default PrintBill