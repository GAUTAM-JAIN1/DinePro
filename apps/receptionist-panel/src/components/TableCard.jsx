import { useState } from 'react'
import BillSummary from './BillSummary'
import PrintBill from './PrintBill'

function TableCard({ tableGroup, onCloseBill, onMarkItemServed, onCancelOrder, restaurant }) {
  const [expanded, setExpanded] = useState(true)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const [settlementForm, setSettlementForm] = useState({
    paymentMode: 'cash',
    discountAmount: '',
    gstPercent: restaurant?.defaultGstPercent ?? '',
    serviceChargeAmount: restaurant?.defaultServiceCharge ?? '',
    paymentReference: '',
    notes: '',
  })

  const latestStatus = tableGroup.orders.at(-1)?.status || 'new'
  const settlement = buildSettlementPreview(tableGroup.totalAmount, settlementForm)

  const statusClasses = {
    new: 'status-new',
    preparing: 'status-preparing',
    ready: 'status-ready',
    served: 'status-served',
  }

  const statusLabels = {
    new: 'New order',
    preparing: 'Preparing',
    ready: 'Ready to serve',
    served: 'Served',
  }

  const handleCancelAll = async () => {
    setCancelling(true)
    try {
      // Cancel all open orders for this table
      for (const order of tableGroup.orders) {
        await onCancelOrder(order.id, tableGroup.tableNumber, cancelReason)
      }
      setShowCancelConfirm(false)
      setCancelReason('')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <article className={`table-card ${statusClasses[latestStatus] || 'status-new'}`}>
        <button
          type="button"
          className="w-full p-4 text-left sm:p-5"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="status-pin" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text3)]">
                  {statusLabels[latestStatus]}
                </p>
              </div>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-none text-[var(--text)]">
                Table {tableGroup.tableNumber}
              </h2>
              <p className="mt-2 text-sm text-[var(--text2)]">
                {tableGroup.orders.length} order{tableGroup.orders.length === 1 ? '' : 's'} open
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text3)]">Total</p>
              <p className="mt-1 text-2xl font-bold text-[var(--btn)]">
                Rs. {tableGroup.totalAmount}
              </p>
              <p className="mt-1 text-xs text-[var(--text2)]">
                {tableGroup.allItems.length} item{tableGroup.allItems.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <BillSummary
              items={tableGroup.allItems}
              totalAmount={tableGroup.totalAmount}
              settlement={settlement}
              orders={tableGroup.orders}
              onMarkItemServed={onMarkItemServed}
            />

            {/* 3 buttons — Print, Cancel, Settle */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShowPrint(true)}
                className="action-button secondary text-sm"
              >
                🖨️ Print
              </button>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="action-button cancel text-sm"
              >
                ✕ Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowSettlement(true)}
                className="action-button primary text-sm"
              >
                ✓ Settle
              </button>
            </div>
          </div>
        )}
      </article>

      {/* Print Bill */}
      {showPrint && (
        <PrintBill
          tableNumber={tableGroup.tableNumber}
          items={tableGroup.allItems}
          totalAmount={tableGroup.totalAmount}
          settlement={settlement}
          restaurantName={restaurant?.name || 'Restaurant'}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* Cancel Confirm Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--card)] p-6 shadow-2xl">
            <div className="mb-4 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-500">
                Cancel Order
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--text)]">
                Table {tableGroup.tableNumber}
              </h2>
              <p className="mt-2 text-sm text-[var(--text2)]">
                Ye order chef panel se bhi hat jaayega. Confirm karo?
              </p>
            </div>

            <label className="block mb-4">
              <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">
                Reason (optional)
              </span>
              <input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer left, wrong order..."
                className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setShowCancelConfirm(false); setCancelReason('') }}
                disabled={cancelling}
                className="action-button secondary"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleCancelAll}
                disabled={cancelling}
                className="action-button cancel"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {showSettlement && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-[var(--card)] p-5 shadow-2xl sm:p-6">
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--gold)]">
                Settlement
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--text)]">
                Table {tableGroup.tableNumber}
              </h2>
              {(restaurant?.defaultGstPercent > 0 || restaurant?.defaultServiceCharge > 0) && (
                <p className="mt-1 text-xs text-[var(--text3)]">
                  GST &amp; service charge pre-filled from restaurant defaults
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2">
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">Payment mode</span>
                <select
                  value={settlementForm.paymentMode}
                  onChange={(e) => setSettlementForm({ ...settlementForm, paymentMode: e.target.value })}
                  className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">Discount (Rs.)</span>
                <input
                  type="number" min="0"
                  value={settlementForm.discountAmount}
                  onChange={(e) => setSettlementForm({ ...settlementForm, discountAmount: e.target.value })}
                  className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">GST (%)</span>
                <input
                  type="number" min="0"
                  value={settlementForm.gstPercent}
                  onChange={(e) => setSettlementForm({ ...settlementForm, gstPercent: e.target.value })}
                  className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">Service charge (Rs.)</span>
                <input
                  type="number" min="0"
                  value={settlementForm.serviceChargeAmount}
                  onChange={(e) => setSettlementForm({ ...settlementForm, serviceChargeAmount: e.target.value })}
                  className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">Reference</span>
                <input
                  value={settlementForm.paymentReference}
                  onChange={(e) => setSettlementForm({ ...settlementForm, paymentReference: e.target.value })}
                  placeholder="UPI/card ref"
                  className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
                />
              </label>

              <label className="col-span-2">
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">Notes</span>
                <input
                  value={settlementForm.notes}
                  onChange={(e) => setSettlementForm({ ...settlementForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
                />
              </label>
            </div>

            <div className="mt-4">
              <BillSummary
                items={tableGroup.allItems}
                totalAmount={tableGroup.totalAmount}
                settlement={settlement}
                orders={tableGroup.orders}
                onMarkItemServed={onMarkItemServed}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowSettlement(false)} className="action-button secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { onCloseBill(tableGroup, settlement); setShowSettlement(false) }}
                className="action-button primary"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .action-button.cancel {
          min-height: 46px;
          border-radius: 14px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 800;
          padding: 12px 16px;
          transition: 160ms ease;
          border: 1px solid rgba(220, 38, 38, 0.3);
          background: rgba(220, 38, 38, 0.08);
          color: #dc2626;
        }
        .action-button.cancel:hover {
          background: rgba(220, 38, 38, 0.15);
          transform: translateY(-1px);
        }
        .action-button.cancel:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </>
  )
}

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100

function buildSettlementPreview(subtotal, form) {
  const discountAmount = Math.min(Math.max(toNumber(form.discountAmount), 0), subtotal)
  const serviceChargeAmount = Math.max(toNumber(form.serviceChargeAmount), 0)
  const gstPercent = Math.max(toNumber(form.gstPercent), 0)
  const taxableAmount = Math.max(subtotal - discountAmount + serviceChargeAmount, 0)
  const gstAmount = roundMoney((taxableAmount * gstPercent) / 100)

  return {
    subtotal: roundMoney(subtotal),
    discountAmount: roundMoney(discountAmount),
    serviceChargeAmount: roundMoney(serviceChargeAmount),
    gstPercent: roundMoney(gstPercent),
    gstAmount,
    payableAmount: roundMoney(taxableAmount + gstAmount),
    paymentMode: form.paymentMode,
    paymentReference: form.paymentReference,
    notes: form.notes,
  }
}

export default TableCard