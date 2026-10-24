// Pure billing / pricing helpers for DinePro.
//
// Deliberately free of any Firebase import so the money rules can be unit
// tested with `node --test` without a database (see backend/test/).
//
// Phase 1 rules:
//   - Money is computed in integer paise (Bug #28). Rupee values only come
//     back out at the edges, when we store or display them.
//   - Prices, names and availability come from the server's menu, never the
//     client (Bug #1, #11).
//   - GST and service charge come from restaurant settings, never from the
//     settling client (Bug #9).
//   - Discounts above the receptionist cap need an admin (Bug #9).
//   - The settled total must match what the cashier saw (Bug #40).

const OPEN_STATUSES = ['new', 'preparing', 'ready', 'served']
// Only these orders may absorb new items from a customer. Ready/served
// orders stay as they are and a fresh order is opened instead.
const MERGEABLE_STATUSES = ['new', 'preparing']
const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer', 'other']
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

// Keep in sync with RECEPTIONIST_MAX_DISCOUNT_PERCENT in
// apps/web/src/panels/reception/billingMath.js (the UI shows the same cap).
const RECEPTIONIST_MAX_DISCOUNT_PERCENT = (() => {
  const value = Number(process.env.RECEPTIONIST_MAX_DISCOUNT_PERCENT)
  return Number.isFinite(value) && value > 0 ? value : 10
})()

class HttpError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message)
    this.statusCode = statusCode
    // Extra fields (e.g. code, actualPayableAmount) are passed back to the
    // client on both REST and socket error responses.
    this.extra = extra
  }
}

const toNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const toPaise = (rupees) => Math.round(toNumber(rupees) * 100)
const toRupees = (paise) => Math.round(paise) / 100
const percentOfPaise = (basePaise, percent) => Math.round((basePaise * percent) / 100)
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

let lineCounter = 0
const newLineId = () => {
  lineCounter = (lineCounter + 1) % 1e6
  return `line_${Date.now()}_${lineCounter}_${Math.random().toString(36).slice(2, 8)}`
}

const orderSubtotalPaise = (order) =>
  (order.items || []).reduce(
    (sum, item) => sum + toPaise(item.price) * Math.round(toNumber(item.quantity, 0)),
    0
  )

const lineTotalRupees = (item) =>
  toRupees(toPaise(item.price) * Math.round(toNumber(item.quantity, 0)))

/**
 * Turns the client's requested lines into server-priced order lines.
 * Throws HttpError for unknown, sold-out or mis-variant items. Nothing from
 * the request except id, variant, quantity and note is trusted.
 *
 * @param requested  [{ id, variant, quantity, specialInstructions }]
 * @param menuById   Map<menuItemId, normalized menu doc>
 */
function resolveOrderLines(requested, menuById, makeLineId = newLineId) {
  return requested.map((line) => {
    const menu = menuById.get(line.id)
    if (!menu) {
      throw new HttpError(400, `Menu item not found: ${line.id}`, { code: 'ITEM_NOT_FOUND', itemId: line.id })
    }
    if (menu.isAvailable === false) {
      throw new HttpError(409, `${menu.name} is sold out right now`, { code: 'SOLD_OUT', itemId: line.id })
    }

    const variants = Array.isArray(menu.variants) ? menu.variants : []
    const requestedVariant = line.variant || null
    let price = toNumber(menu.price, NaN)
    let variant = null
    let variantHindi = ''

    if (menu.hasVariants && variants.length > 0) {
      const found = variants.find((v) => v.name === requestedVariant)
      if (!found) {
        throw new HttpError(400, `Pick a valid variant for ${menu.name}`, { code: 'INVALID_VARIANT', itemId: line.id })
      }
      price = toNumber(found.price, NaN)
      variant = found.name
      variantHindi = found.nameHindi || ''
    } else if (requestedVariant) {
      throw new HttpError(400, `${menu.name} does not have variants`, { code: 'INVALID_VARIANT', itemId: line.id })
    }

    if (!Number.isFinite(price) || price < 0) {
      throw new HttpError(409, `${menu.name} has no valid price on the menu`, { code: 'BAD_PRICE', itemId: line.id })
    }

    return {
      id: menu.id,
      name: menu.name,
      nameHindi: menu.nameHindi || '',
      price,
      quantity: Math.round(toNumber(line.quantity, 0)),
      variant,
      variantHindi,
      specialInstructions: String(line.specialInstructions || '').trim(),
      isVeg: menu.isVeg ?? true,
      lineId: makeLineId(),
      status: 'new',
    }
  })
}

function computeSettlement({ subtotalPaise, discountPaise = 0, serviceChargePaise = 0, gstPercent = 0 }) {
  const discount = clamp(Math.round(discountPaise), 0, subtotalPaise)
  const service = Math.max(Math.round(serviceChargePaise), 0)
  const rate = Math.max(toNumber(gstPercent), 0)
  const taxable = Math.max(subtotalPaise - discount + service, 0)
  const gst = percentOfPaise(taxable, rate)
  return {
    subtotalPaise,
    discountPaise: discount,
    serviceChargePaise: service,
    gstPercent: rate,
    gstPaise: gst,
    payablePaise: taxable + gst,
  }
}

/** Shape stored on each closed order and shown on bills (rupees). */
function toSettlementRecord(computed, { paymentMode, paymentReference = '', notes = '', invoiceNumber = null }) {
  return {
    subtotal: toRupees(computed.subtotalPaise),
    discountAmount: toRupees(computed.discountPaise),
    serviceChargeAmount: toRupees(computed.serviceChargePaise),
    gstPercent: computed.gstPercent,
    gstAmount: toRupees(computed.gstPaise),
    payableAmount: toRupees(computed.payablePaise),
    paymentMode,
    paymentReference,
    notes,
    invoiceNumber,
  }
}

function assertDiscountAllowed({ subtotalPaise, discountPaise, isAdmin }) {
  if (discountPaise > subtotalPaise) {
    throw new HttpError(400, 'Discount cannot be more than the bill subtotal', { code: 'DISCOUNT_TOO_LARGE' })
  }
  if (isAdmin) return
  const capPaise = percentOfPaise(subtotalPaise, RECEPTIONIST_MAX_DISCOUNT_PERCENT)
  if (discountPaise > capPaise) {
    throw new HttpError(
      403,
      `Discounts above ${RECEPTIONIST_MAX_DISCOUNT_PERCENT}% need admin approval`,
      { code: 'DISCOUNT_NEEDS_APPROVAL', capPercent: RECEPTIONIST_MAX_DISCOUNT_PERCENT }
    )
  }
}

function assertExpectedTotal(expectedPayableAmount, payablePaise) {
  if (toPaise(expectedPayableAmount) !== Math.round(payablePaise)) {
    throw new HttpError(
      409,
      'Bill total changed since it was opened. Refresh the bill and check it again.',
      { code: 'TOTAL_MISMATCH', actualPayableAmount: toRupees(payablePaise) }
    )
  }
}

/**
 * Splits the payable across orders in proportion to their subtotals. Integer
 * paise throughout; the last order takes the rounding remainder so the parts
 * always add up to the payable exactly.
 */
function allocatePayable(orders, payablePaise) {
  const total = orders.reduce((sum, order) => sum + order.subtotalPaise, 0)
  let running = 0
  return orders.map((order, index) => {
    const isLast = index === orders.length - 1
    const share = isLast
      ? payablePaise - running
      : total > 0
        ? Math.round((payablePaise * order.subtotalPaise) / total)
        : 0
    running += share
    return { id: order.id, settledPaise: share }
  })
}

const formatInvoiceNumber = (year, seq) => `INV-${year}-${String(seq).padStart(6, '0')}`

module.exports = {
  HttpError,
  OPEN_STATUSES,
  MERGEABLE_STATUSES,
  PAYMENT_MODES,
  IDEMPOTENCY_KEY_PATTERN,
  RECEPTIONIST_MAX_DISCOUNT_PERCENT,
  toNumber,
  toPaise,
  toRupees,
  percentOfPaise,
  newLineId,
  orderSubtotalPaise,
  lineTotalRupees,
  resolveOrderLines,
  computeSettlement,
  toSettlementRecord,
  assertDiscountAllowed,
  assertExpectedTotal,
  allocatePayable,
  formatInvoiceNumber,
}
