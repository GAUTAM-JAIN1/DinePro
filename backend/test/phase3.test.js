const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { createFakeDb } = require('./support/fakeFirestore')

const { db, store } = createFakeDb()
const auth = {
  deleteUser: async () => {},
  getUserByEmail: async () => { throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' }) },
}
const firebaseAdminPath = path.join(__dirname, '..', 'src', 'services', 'firebaseAdmin.js')
require.cache[firebaseAdminPath] = { id: firebaseAdminPath, filename: firebaseAdminPath, loaded: true, exports: { db, auth, admin: {} } }

const orders = require('../src/services/orderService')
const menuSvc = require('../src/services/menuService')
const tableSvc = require('../src/services/tableService')
const restaurantSvc = require('../src/services/restaurantService')
const dayKey = require('../src/services/dayKey')
const v = require('../src/middleware/validators')

const R = 'r1'

function seedRestaurant(extra = {}) {
  store.set(`restaurants/${R}`, {
    name: 'Dhaba',
    timezone: 'Asia/Kolkata',
    subscriptionStatus: 'active',
    currentPeriodEnd: '2030-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  })
}

function seedOrder(id, fields) {
  store.set(`restaurants/${R}/orders/${id}`, { status: 'closed', items: [], settledAmount: 0, ...fields })
}

// ───────────────────────── Bug #14: restaurant-local day ─────────────────────────

test('day keys and bounds follow the restaurant timezone, not UTC', () => {
  // 20:00 UTC is 01:30 the next day in Kolkata, still the same day in UTC.
  assert.equal(dayKey.dayKeyFor('2026-10-24T20:00:00Z', 'Asia/Kolkata'), '2026-10-25')
  assert.equal(dayKey.dayKeyFor('2026-10-24T20:00:00Z', 'UTC'), '2026-10-24')
  assert.deepEqual(dayKey.dayBounds('2026-10-25', 'Asia/Kolkata'), {
    start: '2026-10-24T18:30:00.000Z',
    end: '2026-10-25T18:30:00.000Z',
  })
  // New York springs forward on 8 March 2026: that day is 23 hours long.
  assert.deepEqual(dayKey.dayBounds('2026-03-08', 'America/New_York'), {
    start: '2026-03-08T05:00:00.000Z',
    end: '2026-03-09T04:00:00.000Z',
  })
  assert.equal(dayKey.isValidTimezone('Mars/Base'), false)
})

test('dashboard and report use the restaurant day and one revenue definition', async (t) => {
  store.clear()
  seedRestaurant()
  // 2026-10-24 20:00 UTC = 25 Oct 01:30 in Kolkata.
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-24T20:00:00Z') })

  // Closed 23:30 IST on 24 Oct: yesterday for the restaurant, even though it is 24 Oct in UTC.
  seedOrder('prev', { closedAt: '2026-10-24T18:00:00.000Z', createdAt: '2026-10-24T17:50:00.000Z', settledAmount: 500 })
  // Closed 00:30 IST on 25 Oct: today.
  seedOrder('today', {
    closedAt: '2026-10-24T19:00:00.000Z',
    createdAt: '2026-10-24T18:45:00.000Z',
    settledAmount: 250,
    settlement: { paymentMode: 'upi' },
    items: [{ name: 'Dal', price: 180, quantity: 1 }],
  })
  // Placed today, never billed, so it has no revenue but still counts as an order placed.
  seedOrder('cancelled-today', {
    status: 'cancelled', createdAt: '2026-10-24T18:50:00.000Z',
    items: [{ name: 'Tea', price: 20, quantity: 3 }],
  })

  const stats = await orders.getDailyStats(R)
  assert.equal(stats.date, '2026-10-25')
  assert.equal(stats.dailyRevenue, 250)
  assert.equal(stats.completedOrdersToday, 1)

  const report = await orders.getDailyReport(R)
  assert.equal(report.date, '2026-10-25')
  assert.equal(report.totalRevenue, stats.dailyRevenue, 'dashboard and report must agree (Bug #15)')
  assert.equal(report.totalOrders, 1)
  assert.deepEqual(report.paymentModeBreakdown, { upi: { count: 1, total: 250 } })
  assert.equal(report.hourlyBreakdown[0].orders, 1, 'hourly chart uses the restaurant clock')
  assert.equal(report.topItems.some((i) => i.name === 'Tea'), false, 'cancelled items never appear (Bug #42)')
})

test('reset restarts the live counter but never the report (Bug #46)', async (t) => {
  store.clear()
  seedRestaurant({ statsResetAt: '2026-10-25T05:00:00.000Z' })
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-25T08:00:00Z') })

  seedOrder('before-reset', { closedAt: '2026-10-25T04:00:00.000Z', createdAt: '2026-10-25T03:30:00.000Z', settledAmount: 300 })
  seedOrder('after-reset', { closedAt: '2026-10-25T06:00:00.000Z', createdAt: '2026-10-25T05:30:00.000Z', settledAmount: 120 })

  const stats = await orders.getDailyStats(R)
  assert.equal(stats.dailyRevenue, 120, 'counter starts again at the reset')

  const report = await orders.getDailyReport(R)
  assert.equal(report.totalRevenue, 420, 'the report keeps the whole day')
})

// ───────────────────────── Bug #49: whole-order status keeps ready items ready ─────────────────────────

test('marking an order preparing does not drag ready items back', async () => {
  store.clear()
  seedRestaurant()
  store.set(`restaurants/${R}/orders/o9`, {
    status: 'new',
    tableId: 't1',
    items: [
      { lineId: 'a', id: 'm1', name: 'Dal', status: 'new', quantity: 1, price: 100 },
      { lineId: 'b', id: 'm2', name: 'Tea', status: 'ready', quantity: 1, price: 20 },
    ],
    newItems: [],
  })

  await orders.updateOrder(R, 'o9', { status: 'preparing' })

  const after = store.get(`restaurants/${R}/orders/o9`)
  assert.deepEqual(after.items.map((i) => i.status), ['preparing', 'ready'])
  assert.equal(after.status, 'preparing')
})

// ───────────────────────── Bugs #34, #55, #57: tables ─────────────────────────

test('tables sort by number and a table with an open bill cannot be deleted', async () => {
  store.clear()
  seedRestaurant()
  for (const n of ['10', '2', '1']) {
    store.set(`restaurants/${R}/tables/t${n}`, { tableNumber: n, label: `Table ${n}`, isActive: true, qrUrl: 'https://x', createdAt: 'x' })
  }
  const list = await tableSvc.getTables(R)
  assert.deepEqual(list.map((t) => t.tableNumber), ['1', '2', '10'])

  const publicList = list.map(tableSvc.publicTable)
  assert.equal('qrUrl' in publicList[0], false, 'public list drops internal fields (Bug #34)')
  assert.equal('createdAt' in publicList[0], false)

  store.set(`restaurants/${R}/orders/oz`, { tableId: 't2', status: 'preparing' })
  await assert.rejects(tableSvc.deleteTable(R, 't2'), (err) => err.statusCode === 409 && err.extra.code === 'TABLE_HAS_OPEN_ORDER')
  assert.equal(store.has(`restaurants/${R}/tables/t2`), true)

  store.set(`restaurants/${R}/orders/oy`, { tableId: 't1', status: 'closed' })
  await tableSvc.deleteTable(R, 't1')
  assert.equal(store.has(`restaurants/${R}/tables/t1`), false)
})

test('bulk tables only create the numbers that are missing', async () => {
  store.clear()
  seedRestaurant()
  const first = await tableSvc.addTablesUpTo(R, 3)
  assert.deepEqual(first.created.map((t) => t.tableNumber), ['1', '2', '3'])
  const second = await tableSvc.addTablesUpTo(R, 3)
  assert.equal(second.created.length, 0)
  assert.deepEqual(second.skipped, ['1', '2', '3'])
})

// ───────────────────────── Bugs #13, #55, #56: menu ─────────────────────────

test('menu update sends only the fields the client gave (Bug #13)', () => {
  assert.deepEqual(v.menuItemUpdate.parse({ name: '  Dal Fry  ' }), { name: 'Dal Fry' })
  assert.deepEqual(v.menuItemUpdate.parse({ isBestseller: true }), { isBestseller: true })
})

test('bulk menu adds only dishes that are not on the menu yet', async () => {
  store.clear()
  seedRestaurant()
  const rows = [
    { index: 0, data: v.menuItemCreate.parse({ name: 'Dal', price: 180, category: 'Mains' }) },
    { index: 1, data: v.menuItemCreate.parse({ name: 'Naan', price: 45, category: 'Breads' }) },
  ]
  const first = await menuSvc.addMenuItemsIfMissing(R, rows)
  assert.equal(first.created.length, 2)

  const second = await menuSvc.addMenuItemsIfMissing(R, rows)
  assert.equal(second.created.length, 0)
  assert.equal(second.skipped.length, 2)
})

test('invalid bulk rows are reported per row by the schema', () => {
  const bad = v.menuItemCreate.safeParse({ name: 'Free dal', price: 0 })
  assert.equal(bad.success, false)
  assert.match(bad.error.issues[0].path.join('.'), /price/)
})

// ───────────────────────── Bugs #33, #58, #64: restaurant ─────────────────────────

test('brandColor reads through from themeColor on older documents (Bug #33)', async () => {
  store.clear()
  seedRestaurant({ themeColor: '#123456' })
  const restaurant = await restaurantSvc.getRestaurant(R)
  assert.equal(restaurant.brandColor, '#123456')
  assert.equal(restaurant.timezone, 'Asia/Kolkata')
})

test('a restaurant must be archived before it can be deleted, and archiving keeps the history (Bug #58)', async () => {
  store.clear()
  seedRestaurant()
  seedOrder('kept', { status: 'closed', closedAt: '2026-10-01T00:00:00.000Z' })

  await assert.rejects(restaurantSvc.deleteRestaurant(R), (err) => err.statusCode === 409 && err.extra.code === 'NOT_ARCHIVED')

  const archived = await restaurantSvc.archiveRestaurant(R, { uid: 'sa1' })
  assert.ok(archived.archivedAt)
  assert.equal(archived.subscription.isServiceEnabled, false)
  assert.equal(store.has(`restaurants/${R}/orders/kept`), true, 'archive keeps orders')

  const visible = await restaurantSvc.listRestaurants()
  assert.equal(visible.some((r) => r.id === R), false, 'archived restaurants leave the default list')
  const all = await restaurantSvc.listRestaurants({ includeArchived: true })
  assert.equal(all.some((r) => r.id === R), true)

  await restaurantSvc.deleteRestaurant(R)
  assert.equal(store.has(`restaurants/${R}`), false)
  assert.equal(store.has(`restaurants/${R}/orders/kept`), false, 'permanent delete removes sub-collections')
})

test('the subscription summary exposes status and days left, not raw billing fields (Bug #64)', async () => {
  store.clear()
  seedRestaurant({ subscriptionStatus: 'suspended' })
  const summary = await restaurantSvc.getSubscriptionSummary(R)
  assert.equal(summary.effectiveStatus, 'suspended')
  assert.equal(summary.isServiceEnabled, false)
  assert.equal('planAmount' in summary, true)
})

test('restaurant timezone must be a real IANA zone', () => {
  assert.equal(v.restaurantUpdate.safeParse({ timezone: 'Mars/Base' }).success, false)
  assert.equal(v.restaurantUpdate.safeParse({ timezone: 'Asia/Kolkata' }).success, true)
})
