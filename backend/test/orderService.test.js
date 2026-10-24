const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { createFakeDb } = require('./support/fakeFirestore')

// Swap the real Firebase bootstrap for the in-memory fake BEFORE the services load.
const { db, store } = createFakeDb()
const firebaseAdminPath = path.join(__dirname, '..', 'src', 'services', 'firebaseAdmin.js')
require.cache[firebaseAdminPath] = { id: firebaseAdminPath, filename: firebaseAdminPath, loaded: true, exports: { db, auth: {}, admin: {} } }

const orders = require('../src/services/orderService')

const R = 'r1'
const future = new Date(Date.now() + 30 * 86400e3).toISOString()

function seed() {
  store.clear()
  store.set(`restaurants/${R}`, {
    name: 'Test Dhaba', defaultGstPercent: 5, defaultServiceCharge: 0,
    subscriptionStatus: 'active', currentPeriodEnd: future, createdAt: new Date().toISOString(),
  })
  store.set(`restaurants/${R}/tables/t1`, { tableNumber: '5', label: 'Table 5', isActive: true })
  store.set(`restaurants/${R}/menu/m1`, { name: 'Paneer Tikka', price: 100, isAvailable: true, hasVariants: false, variants: [] })
  store.set(`restaurants/${R}/menu/m2`, {
    name: 'Thali', price: 0, isAvailable: true, hasVariants: true,
    variants: [{ name: 'Half', price: 60 }, { name: 'Full', price: 110 }],
  })
  store.set(`restaurants/${R}/menu/m3`, { name: 'Soup', price: 80, isAvailable: false, hasVariants: false, variants: [] })
}

const orderDocs = () => [...store].filter(([k]) => k.split('/').length === 4 && k.startsWith(`restaurants/${R}/orders/`)).map(([k, v]) => ({ id: k.split('/')[3], ...v }))

const line = (id, quantity = 1, variant = null) => ({ id, quantity, variant, specialInstructions: '' })
const key = (n) => `idem-key-${n}-abcdef`

test('first order is priced from the menu and attached to the canonical table doc (Bug #1, #53)', async () => {
  seed()
  const { order, replayed } = await orders.upsertOrder(R, {
    tableId: '5', // customer arrived via the QR with the table NUMBER
    items: [line('m1', 2)],
    specialInstructions: '',
    idempotencyKey: key(1),
  })
  assert.equal(replayed, false)
  assert.equal(order.tableId, 't1', 'stored under the table doc id')
  assert.equal(order.tableNumber, '5', 'table number comes from the table doc')
  assert.equal(order.totalAmount, 200)
  assert.equal(order.status, 'new')
  assert.equal(orderDocs().length, 1)
})

test('a second order on the same table merges into the one open bill (Bug #6, #7)', async () => {
  seed()
  const first = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(2) })
  const second = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 2)], idempotencyKey: key(3) })
  assert.equal(second.order.id, first.order.id, 'merged into the existing bill')
  assert.equal(second.order.totalAmount, 300)
  assert.equal(second.order.items.length, 2)
  assert.equal(orderDocs().length, 1)
})

test('retrying with the same idempotency key returns the first order and is not announced twice (Bug #51, #38)', async () => {
  seed()
  const first = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(4) })
  const retry = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(4) })
  assert.equal(retry.replayed, true)
  assert.equal(retry.order.id, first.order.id)
  assert.equal(retry.order.totalAmount, first.order.totalAmount, 'no double-add on retry')
})

test('sold-out item is refused and nothing is written (Bug #11)', async () => {
  seed()
  await assert.rejects(
    orders.upsertOrder(R, { tableId: 't1', items: [line('m3', 1)], idempotencyKey: key(5) }),
    (err) => err.statusCode === 409 && err.extra.code === 'SOLD_OUT'
  )
  assert.equal(orderDocs().length, 0)
  assert.equal(store.has(`restaurants/${R}/orderKeys/${key(5)}`), false)
})

test('inactive or missing table is refused (Bug #11)', async () => {
  seed()
  store.set(`restaurants/${R}/tables/t9`, { tableNumber: '9', isActive: false })
  await assert.rejects(
    orders.upsertOrder(R, { tableId: 't9', items: [line('m1', 1)], idempotencyKey: key(6) }),
    (err) => err.statusCode === 403
  )
  await assert.rejects(
    orders.upsertOrder(R, { tableId: 'ghost', items: [line('m1', 1)], idempotencyKey: key(7) }),
    (err) => err.statusCode === 404
  )
})

test('a cancelled order is never revived; the next order opens a fresh bill (Bug #8)', async () => {
  seed()
  const first = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(8) })
  await orders.cancelOrder(R, first.order.id, { reason: 'wrong table', actor: { email: 'rec@x.in', role: 'receptionist' } })
  const next = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(9) })
  assert.notEqual(next.order.id, first.order.id)
  assert.equal(next.order.status, 'new')
  assert.equal(store.get(`restaurants/${R}/orders/${first.order.id}`).status, 'cancelled')
  const listed = await orders.getRestaurantOrders(R)
  assert.deepEqual(listed.map((o) => o.id), [next.order.id], 'cancelled orders are not listed')
})

test('cancelling one order leaves the rest of the table alone (Bug #41)', async () => {
  seed()
  const a = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(10) })
  await orders.updateOrder(R, a.order.id, { status: 'ready' })
  const b = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(11) })
  await orders.cancelOrder(R, b.order.id, { reason: '', actor: null })
  assert.equal(store.get(`restaurants/${R}/orders/${a.order.id}`).status, 'ready')
  assert.equal(store.get(`restaurants/${R}/orders/${b.order.id}`).status, 'cancelled')
})

test('an order with served items needs a reason to cancel (Bug #41)', async () => {
  seed()
  const a = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(12) })
  await orders.updateOrder(R, a.order.id, { status: 'served' })
  await assert.rejects(
    orders.cancelOrder(R, a.order.id, { reason: '', actor: null }),
    (err) => err.statusCode === 400 && err.extra.code === 'REASON_REQUIRED'
  )
  await orders.cancelOrder(R, a.order.id, { reason: 'Customer walked out', actor: null })
  assert.equal(store.get(`restaurants/${R}/orders/${a.order.id}`).status, 'cancelled')
})

test('settlement is computed on the server, rejects open-order drift, and blocks re-settling (Bug #9, #40, #43, #44)', async () => {
  seed()
  const a = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 2)], idempotencyKey: key(13) }) // 200
  // Mark the first bill ready so the next order opens a NEW bill on the same
  // table: this is the "order came in while the cashier had the bill open" case.
  await orders.updateOrder(R, a.order.id, { status: 'ready' })
  const c = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(15) }) // 100, new bill
  assert.notEqual(c.order.id, a.order.id)

  // Settling only the first bill while the new one is open must be refused.
  await assert.rejects(
    orders.closeBill(R, {
      orderIds: [a.order.id],
      settlement: { expectedPayableAmount: 210, discountAmount: 0, paymentMode: 'cash' },
    }),
    (err) => err.statusCode === 409 && err.extra.code === 'ORDERS_CHANGED'
  )
  assert.equal(store.get(`restaurants/${R}/orders/${a.order.id}`).status, 'ready', 'refused settle changed nothing')

  // Wrong expected total (cashier saw a stale 900) is refused.
  await assert.rejects(
    orders.closeBill(R, {
      orderIds: [a.order.id, c.order.id],
      settlement: { expectedPayableAmount: 900, discountAmount: 0, paymentMode: 'cash' },
    }),
    (err) => err.statusCode === 409 && err.extra.code === 'TOTAL_MISMATCH' && err.extra.actualPayableAmount === 315
  )
  assert.equal(store.get(`restaurants/${R}/orders/${c.order.id}`).status, 'new', 'mismatch changed nothing')

  // Correct settle: subtotal 300 + 5% GST = 315, one invoice number.
  const result = await orders.closeBill(R, {
    orderIds: [a.order.id, c.order.id],
    settlement: { expectedPayableAmount: '315', discountAmount: 0, paymentMode: 'upi', paymentReference: 'UPI-123' },
    actor: { email: 'rec@x.in', role: 'receptionist' },
    isAdmin: false,
  })
  assert.equal(result.settledAmount, 315)
  assert.equal(result.settlement.gstAmount, 15)
  assert.match(result.invoiceNumber, /^INV-\d{4}-000001$/)
  const settledA = store.get(`restaurants/${R}/orders/${a.order.id}`)
  const settledC = store.get(`restaurants/${R}/orders/${c.order.id}`)
  assert.equal(settledA.status, 'closed')
  assert.equal(settledA.invoiceNumber, result.invoiceNumber)
  assert.equal(
    Math.round((settledA.settledAmount + settledC.settledAmount) * 100),
    31500,
    'per-order shares add up to the payable exactly'
  )

  // Settling again is blocked (no double payment).
  await assert.rejects(
    orders.closeBill(R, { orderIds: [a.order.id], settlement: { expectedPayableAmount: 210 } }),
    (err) => err.extra.code === 'ALREADY_SETTLED'
  )

  // The next bill on the table gets the next invoice number.
  const d = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(16) })
  assert.notEqual(d.order.id, a.order.id, 'a new order after settlement opens a new bill')
  const second = await orders.closeBill(R, {
    orderIds: [d.order.id],
    settlement: { expectedPayableAmount: 105, discountAmount: 0 },
  })
  assert.match(second.invoiceNumber, /-000002$/)
})

test('receptionist discount above the cap is refused; admin can approve it (Bug #9)', async () => {
  seed()
  const a = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 1)], idempotencyKey: key(17) }) // 100
  await assert.rejects(
    orders.closeBill(R, { orderIds: [a.order.id], settlement: { expectedPayableAmount: 88.2, discountAmount: 16 }, isAdmin: false }),
    (err) => err.statusCode === 403 && err.extra.code === 'DISCOUNT_NEEDS_APPROVAL'
  )
  // Rs. 100 bill, Rs. 16 discount (above the 10% cap), 5% GST on the remaining Rs. 84 = Rs. 88.20
  const result = await orders.closeBill(R, {
    orderIds: [a.order.id],
    settlement: { expectedPayableAmount: 88.2, discountAmount: 16 },
    isAdmin: true,
  })
  assert.equal(result.settledAmount, 88.2)
})

test('daily report leaves cancelled orders out of item counts (Bug #42, #45)', async () => {
  seed()
  const a = await orders.upsertOrder(R, { tableId: 't1', items: [line('m1', 3)], idempotencyKey: key(18) })
  await orders.cancelOrder(R, a.order.id, { reason: 'mistake', actor: null })
  const report = await orders.getDailyReport(R)
  assert.equal(report.topItems.length, 0)
  assert.equal(report.totalOrders, 0)
})
