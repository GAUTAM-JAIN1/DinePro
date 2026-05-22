import { useState } from 'react'
import BillSummary from './BillSummary'
import PrintBill from './PrintBill'

function TableCard({ tableGroup, onCloseBill, onMarkItemServed }) {
  const [expanded, setExpanded] = useState(true)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [settlementForm, setSettlementForm] = useState({
    paymentMode: 'cash',
    discountAmount: '',
    gstPercent: '',
    serviceChargeAmount: '',
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

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setShowPrint(true)}
                className="action-button secondary"
              >
                Print Bill
              </button>
              <button
                type="button"
                onClick={() => setShowSettlement(true)}
                className="action-button primary"
              >
                Settle Bill
              </button>
            </div>
          </div>
        )}
      </article>

      {showPrint && (
        <PrintBill
          tableNumber={tableGroup.tableNumber}
          items={tableGroup.allItems}
          totalAmount={tableGroup.totalAmount}
          settlement={settlement}
          restaurantName="Tadka Junction"
          onClose={() => setShowPrint(false)}
        />
      )}

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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2">
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">Payment mode</span>
                <select
                  value={settlementForm.paymentMode}
                  onChange={(event) => setSettlementForm({ ...settlementForm, paymentMode: event.target.value })}
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
                  type="number"
                  min="0"
                  value={settlementForm.discountAmount}
                  onChange={(event) => setSettlementForm({ ...settlementForm, discountAmount: event.target.value })}
                  className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">GST (%)</span>
                <input
                  type="number"
                  min="0"
                  value={settlementForm.gstPercent}
                  onChange={(event) => setSettlementForm({ ...settlementForm, gstPercent: event.target.value })}
                  className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">Service charge (Rs.)</span>
                <input
                  type="number"
                  min="0"
                  value={settlementForm.serviceChargeAmount}
                  onChange={(event) => setSettlementForm({ ...settlementForm, serviceChargeAmount: event.target.value })}
                  className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">Reference</span>
                <input
                  value={settlementForm.paymentReference}
                  onChange={(event) => setSettlementForm({ ...settlementForm, paymentReference: event.target.value })}
                  placeholder="UPI/card ref"
                  className="w-full rounded-xl border border-[rgba(184,135,70,0.18)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--text)] outline-none"
                />
              </label>

              <label className="col-span-2">
                <span className="mb-1 block text-xs font-semibold text-[var(--text2)]">Notes</span>
                <input
                  value={settlementForm.notes}
                  onChange={(event) => setSettlementForm({ ...settlementForm, notes: event.target.value })}
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
              <button
                type="button"
                onClick={() => setShowSettlement(false)}
                className="action-button secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseBill(tableGroup, settlement)
                  setShowSettlement(false)
                }}
                className="action-button primary"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}
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
