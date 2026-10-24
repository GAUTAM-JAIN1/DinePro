const test = require('node:test')
const assert = require('node:assert/strict')
const billing = require('../src/services/billing')

const menu = (overrides = {}) => new Map([[
  'm1',
  { id: 'm1', name: 'Paneer Tikka', price: 100, isAvailable: true, hasVariants: false, variants: [], isVeg: true, ...overrides },
]])

test('client-supplied price never reaches the order (Bug #1)', () => {
  const lines = billing.resolveOrderLines(
    [{ id: 'm1', quantity: 2, variant: null, specialInstructions: '' }],
    menu(),
    () => 'line_fixed'
  )
  assert.equal(lines[0].price, 100)
  assert.equal(lines[0].name, 'Paneer Tikka')
  assert.equal(billing.orderSubtotalPaise({ items: lines }), 20000)
})

test('variant price comes from the menu variant (Bug #1)', () => {
  const m = menu({
    hasVariants: true,
    variants: [{ name: 'Half', price: 60, nameHindi: 'आधा' }, { name: 'Full', price: 110 }],
  })
  const [line] = billing.resolveOrderLines([{ id: 'm1', quantity: 1, variant: 'Full' }], m)
  assert.equal(line.price, 110)
  assert.equal(line.variant, 'Full')
  assert.throws(
    () => billing.resolveOrderLines([{ id: 'm1', quantity: 1, variant: 'Quarter' }], m),
    (err) => err.statusCode === 400 && err.extra.code === 'INVALID_VARIANT'
  )
  assert.throws(
    () => billing.resolveOrderLines([{ id: 'm1', quantity: 1, variant: null }], m),
    (err) => err.statusCode === 400
  )
})

test('sold-out items are refused (Bug #11)', () => {
  assert.throws(
    () => billing.resolveOrderLines([{ id: 'm1', quantity: 1 }], menu({ isAvailable: false })),
    (err) => err.statusCode === 409 && err.extra.code === 'SOLD_OUT'
  )
})

test('unknown menu item and variant on a plain item are refused', () => {
  assert.throws(
    () => billing.resolveOrderLines([{ id: 'nope', quantity: 1 }], menu()),
    (err) => err.statusCode === 400 && err.extra.code === 'ITEM_NOT_FOUND'
  )
  assert.throws(
    () => billing.resolveOrderLines([{ id: 'm1', quantity: 1, variant: 'Large' }], menu()),
    (err) => err.statusCode === 400 && err.extra.code === 'INVALID_VARIANT'
  )
})

test('paise math avoids float drift (Bug #28)', () => {
  // In JS, 0.1 * 3 = 0.30000000000000004 — the integer path must not show that.
  assert.equal(billing.toPaise(0.1) * 3, 30)
  assert.equal(billing.lineTotalRupees({ price: 0.1, quantity: 3 }), 0.3)
  const items = [{ price: 0.1, quantity: 1 }, { price: 0.2, quantity: 1 }]
  assert.equal(billing.toRupees(billing.orderSubtotalPaise({ items })), 0.3)
})

test('settlement: discount, service charge and GST are computed server-side', () => {
  const computed = billing.computeSettlement({
    subtotalPaise: 100000, // Rs. 1000
    discountPaise: 10000,  // Rs. 100
    serviceChargePaise: 5000, // Rs. 50
    gstPercent: 5,
  })
  assert.equal(computed.payablePaise, 99750) // taxable 950 + 5% = 997.50
  const record = billing.toSettlementRecord(computed, { paymentMode: 'upi', invoiceNumber: 'INV-2026-000001' })
  assert.equal(record.gstAmount, 47.5)
  assert.equal(record.payableAmount, 997.5)
  assert.equal(record.invoiceNumber, 'INV-2026-000001')
})

test('discount above the receptionist cap needs an admin (Bug #9)', () => {
  const subtotalPaise = 100000 // cap is 10% by default = Rs. 100
  assert.doesNotThrow(() => billing.assertDiscountAllowed({ subtotalPaise, discountPaise: 10000, isAdmin: false }))
  assert.throws(
    () => billing.assertDiscountAllowed({ subtotalPaise, discountPaise: 10001, isAdmin: false }),
    (err) => err.statusCode === 403 && err.extra.code === 'DISCOUNT_NEEDS_APPROVAL'
  )
  assert.doesNotThrow(() => billing.assertDiscountAllowed({ subtotalPaise, discountPaise: 50000, isAdmin: true }))
})

test('discount larger than the bill is refused even for admins', () => {
  assert.throws(
    () => billing.assertDiscountAllowed({ subtotalPaise: 1000, discountPaise: 1001, isAdmin: true }),
    (err) => err.statusCode === 400
  )
})

test('settled total must equal what the cashier saw (Bug #40)', () => {
  assert.doesNotThrow(() => billing.assertExpectedTotal(997.5, 99750))
  assert.doesNotThrow(() => billing.assertExpectedTotal('997.50', 99750))
  assert.throws(
    () => billing.assertExpectedTotal(900, 99750),
    (err) => err.statusCode === 409 && err.extra.code === 'TOTAL_MISMATCH' && err.extra.actualPayableAmount === 997.5
  )
})

test('allocation across orders adds up exactly (Bug #40 follow-up)', () => {
  const orders = [
    { id: 'a', subtotalPaise: 33333 },
    { id: 'b', subtotalPaise: 33333 },
    { id: 'c', subtotalPaise: 33334 },
  ]
  const shares = billing.allocatePayable(orders, 100001)
  assert.equal(shares.reduce((sum, s) => sum + s.settledPaise, 0), 100001)
})

test('allocation with zero subtotal does not divide by zero', () => {
  const shares = billing.allocatePayable([{ id: 'a', subtotalPaise: 0 }, { id: 'b', subtotalPaise: 0 }], 0)
  assert.deepEqual(shares.map((s) => s.settledPaise), [0, 0])
})

test('invoice numbers are zero-padded and readable', () => {
  assert.equal(billing.formatInvoiceNumber(2026, 1), 'INV-2026-000001')
  assert.equal(billing.formatInvoiceNumber(2026, 123456), 'INV-2026-123456')
})
