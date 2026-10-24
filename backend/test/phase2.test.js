const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { createFakeDb } = require('./support/fakeFirestore')

// Fake Firebase Admin Auth: enough surface for staffService and the socket guard.
function createFakeAuth() {
  const users = new Map()
  const byEmail = new Map()
  const calls = []
  let counter = 0
  const notFound = () => Object.assign(new Error('There is no user record'), { code: 'auth/user-not-found' })

  return {
    users,
    calls,
    async getUserByEmail(email) {
      const user = byEmail.get(email)
      if (!user) throw notFound()
      return user
    },
    async getUser(uid) {
      const user = users.get(uid)
      if (!user) throw notFound()
      return user
    },
    async createUser({ email, displayName, password }) {
      if (byEmail.has(email)) {
        throw Object.assign(new Error('email exists'), { code: 'auth/email-already-exists' })
      }
      counter += 1
      const record = {
        uid: `uid${counter}`,
        email,
        displayName,
        disabled: false,
        customClaims: {},
        hasPassword: Boolean(password),
      }
      users.set(record.uid, record)
      byEmail.set(email, record)
      return record
    },
    async setCustomUserClaims(uid, claims) {
      users.get(uid).customClaims = { ...claims }
      calls.push(['claims', uid, { ...claims }])
    },
    async updateUser(uid, props) {
      Object.assign(users.get(uid), props)
      calls.push(['update', uid, props])
    },
    async revokeRefreshTokens(uid) {
      calls.push(['revoke', uid])
    },
    async generatePasswordResetLink(email) {
      calls.push(['link', email])
      return `https://auth.example.test/reset?email=${encodeURIComponent(email)}`
    },
    async deleteUser(uid) {
      const user = users.get(uid)
      users.delete(uid)
      if (user) byEmail.delete(user.email)
    },
  }
}

const { db, store } = createFakeDb()
const auth = createFakeAuth()
const firebaseAdminPath = path.join(__dirname, '..', 'src', 'services', 'firebaseAdmin.js')
require.cache[firebaseAdminPath] = { id: firebaseAdminPath, filename: firebaseAdminPath, loaded: true, exports: { db, auth, admin: {} } }

const staffService = require('../src/services/staffService')
const { requireRestaurantAccess } = require('../src/middleware/restaurantAccess')
const { sendError, publicMessage } = require('../src/utils/httpErrors')
const { createWindowLimiter } = require('../src/utils/windowLimiter')
const { isAllowedImageUrl } = require('../src/utils/imageUrl')
const { tableKey } = require('../src/middleware/rateLimit')
const v = require('../src/middleware/validators')
const { canAct, allowEvent } = require('../src/socket/orderSocket')

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
}

function parses(schema, data) {
  return schema.safeParse(data).success
}

// ───────────────────────── Bug #18: tenant check ─────────────────────────

test('tenant check refuses a request that names no restaurant', () => {
  const res = fakeRes()
  let called = false
  requireRestaurantAccess({ params: {}, body: {}, query: {}, user: { restaurantId: 'r1', role: 'admin' } }, res, () => { called = true })
  assert.equal(called, false)
  assert.equal(res.statusCode, 403)
})

test('tenant check refuses mismatched params, body and query', () => {
  const res = fakeRes()
  requireRestaurantAccess({ params: { restaurantId: 'r1' }, body: { restaurantId: 'r2' }, query: {}, user: { restaurantId: 'r1' } }, res, () => assert.fail('must not pass'))
  assert.equal(res.statusCode, 403)
})

test('tenant check refuses staff from another restaurant', () => {
  const res = fakeRes()
  requireRestaurantAccess({ params: { restaurantId: 'r2' }, body: {}, query: {}, user: { restaurantId: 'r1', role: 'admin' } }, res, () => assert.fail('must not pass'))
  assert.equal(res.statusCode, 403)
})

test('tenant check lets staff act on their own restaurant and platform admins anywhere', () => {
  let passed = 0
  requireRestaurantAccess({ params: { restaurantId: 'r1' }, body: {}, query: {}, user: { restaurantId: 'r1', role: 'admin' } }, fakeRes(), () => { passed += 1 })
  requireRestaurantAccess({ params: {}, body: { restaurantId: 'r9' }, query: {}, user: { role: 'superadmin' } }, fakeRes(), () => { passed += 1 })
  assert.equal(passed, 2)
})

// ───────────────────────── Bug #24: error leaks ─────────────────────────

test('server errors send a generic message, not the internal text', (t) => {
  t.mock.method(console, 'error', () => {})
  const res = fakeRes()
  sendError(res, new Error('FAILED_PRECONDITION: index for collection restaurants/r1/orders missing'), { label: 'test' })
  assert.equal(res.statusCode, 500)
  assert.equal(res.body.error, 'Something went wrong. Please try again.')
  assert.doesNotMatch(JSON.stringify(res.body), /index|restaurants\/r1/)
})

test('deliberate client errors keep their message and extra fields', () => {
  const res = fakeRes()
  const { HttpError } = require('../src/services/billing')
  sendError(res, new HttpError(409, 'Bill total changed', { code: 'TOTAL_MISMATCH', actualPayableAmount: 500 }))
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.error, 'Bill total changed')
  assert.equal(res.body.actualPayableAmount, 500)
})

test('malformed JSON bodies stay a 400 with their parser message', () => {
  const res = fakeRes()
  sendError(res, Object.assign(new SyntaxError('Unexpected token } in JSON'), { type: 'entity.parse.failed', status: 400 }))
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /Unexpected token/)
})

test('a duplicate auth email maps to 409 without exposing the SDK text', () => {
  const err = Object.assign(new Error('The email address is already in use by another account.'), { code: 'auth/email-already-exists' })
  assert.equal(publicMessage(err), 'A user with this email already exists')
  const res = fakeRes()
  sendError(res, err)
  assert.equal(res.statusCode, 409)
})

// ───────────────────────── Bug #19, #20, #60, #61: input bounds ─────────────────────────

test('price rejects Infinity, negatives and amounts above the cap', () => {
  const base = { name: 'Dal', category: 'Mains' }
  assert.equal(parses(v.menuItemCreate, { ...base, price: 'Infinity' }), false)
  assert.equal(parses(v.menuItemCreate, { ...base, price: -5 }), false)
  assert.equal(parses(v.menuItemCreate, { ...base, price: 100001 }), false)
  assert.equal(parses(v.menuItemCreate, { ...base, price: '120' }), true)
})

test('order quantity is capped at 50 whole units', () => {
  const item = (quantity) => ({ id: 'm1', quantity })
  const order = (quantity) => ({
    restaurantId: 'r1', tableId: 't1', idempotencyKey: 'abcdefgh1234',
    items: [item(quantity)],
  })
  assert.equal(parses(v.orderCreate, order(51)), false)
  assert.equal(parses(v.orderCreate, order('Infinity')), false)
  assert.equal(parses(v.orderCreate, order(50)), true)
})

test('image URLs must be https on an allowed host', () => {
  delete process.env.ALLOWED_IMAGE_HOSTS
  assert.equal(isAllowedImageUrl('https://res.cloudinary.com/demo/image/upload/a.jpg'), true)
  assert.equal(isAllowedImageUrl(''), true)
  assert.equal(isAllowedImageUrl('http://res.cloudinary.com/demo/a.jpg'), false)
  assert.equal(isAllowedImageUrl('javascript:alert(1)'), false)
  assert.equal(isAllowedImageUrl('https://evil.example.com/a.png'), false)
  assert.equal(isAllowedImageUrl('https://user:pass@res.cloudinary.com/a.jpg'), false)

  process.env.ALLOWED_IMAGE_HOSTS = 'images.example.org'
  assert.equal(isAllowedImageUrl('https://images.example.org/x.png'), true)
  delete process.env.ALLOWED_IMAGE_HOSTS
})

test('menu and logo URLs go through the same host check', () => {
  assert.equal(parses(v.menuItemCreate, { name: 'A', price: 10, imageUrl: 'javascript:alert(1)' }), false)
  assert.equal(parses(v.restaurantUpdate, { logoUrl: 'http://res.cloudinary.com/a.png' }), false)
  assert.equal(parses(v.restaurantUpdate, { logoUrl: 'https://res.cloudinary.com/a.png' }), true)
})

test('restaurant updates still refuse subscription fields', () => {
  assert.equal(parses(v.restaurantUpdate, { subscriptionStatus: 'active' }), false)
})

test('item status accepts only the kitchen statuses', () => {
  const event = (status) => ({ restaurantId: 'r1', orderId: 'o1', itemKey: 'line1', status })
  assert.equal(parses(v.itemStatusEvent, event('ready')), true)
  assert.equal(parses(v.itemStatusEvent, event('new')), false)
  assert.equal(parses(v.itemStatusEvent, event('<script>')), false)
})

test('chef messages are required and capped at 240 characters', () => {
  const base = { restaurantId: 'r1' }
  assert.equal(parses(v.chefMessageEvent, { ...base, message: '   ' }), false)
  assert.equal(parses(v.chefMessageEvent, { ...base, message: 'x'.repeat(241) }), false)
  assert.equal(parses(v.chefMessageEvent, { ...base, message: 'Pls hurry' }), true)
})

test('staff creation drops any password a client sends', () => {
  const parsed = v.staffCreate.parse({ email: 'chef@example.com', name: 'Chef', role: 'chef', password: 'hunter2' })
  assert.equal('password' in parsed, false)
  assert.equal(parses(v.platformStaffCreate, { email: 'x@example.com', role: 'superadmin' }), false)
  assert.equal(parses(v.platformStaffCreate, { email: 'owner@example.com', role: 'admin' }), true)
})

// ───────────────────────── Bug #80: flood limit ─────────────────────────

test('window limiter blocks past the cap and recovers after the window', () => {
  const allow = createWindowLimiter({ max: 3, windowMs: 1000 })
  assert.equal(allow('s', 0), true)
  assert.equal(allow('s', 1), true)
  assert.equal(allow('s', 2), true)
  assert.equal(allow('s', 3), false)
  assert.equal(allow('other', 3), true)
  assert.equal(allow('s', 1001), true)
})

// ───────────────────────── Bug #22: table-keyed order limit ─────────────────────────

test('order rate limit is keyed by table, not by shared IP', () => {
  assert.equal(tableKey({ body: { restaurantId: 'r1', tableId: 't5' }, ip: '10.0.0.1' }), 'table:r1:t5')
  assert.equal(tableKey({ body: { restaurantId: 'r1', tableId: 't6' }, ip: '10.0.0.1' }), 'table:r1:t6')
  assert.match(tableKey({ body: {}, ip: '10.0.0.1' }), /^ip:/)
})

// ───────────────────────── Bug #12 / #26 / #25: staff lifecycle ─────────────────────────

test('creating staff makes a passwordless account with a setup link and no temp password', async () => {
  store.clear()
  const staff = await staffService.createStaff('r1', { email: 'Chef@Example.com', name: 'Asha', role: 'chef' }, { restaurantName: 'Dhaba' })
  assert.equal(staff.isActive, true)
  assert.equal(staff.name, 'Asha')
  assert.match(staff.setupLink, /auth\.example\.test\/reset/)
  assert.equal('tempPassword' in staff, false)
  assert.equal(auth.users.get(staff.uid).hasPassword, false)
  assert.deepEqual(auth.users.get(staff.uid).customClaims, { role: 'chef', restaurantId: 'r1' })
})

test('creating staff never reuses an existing account', async () => {
  store.clear()
  const other = await auth.createUser({ email: 'owner@other.com', displayName: 'Other' })
  await auth.setCustomUserClaims(other.uid, { role: 'admin', restaurantId: 'r9' })
  await assert.rejects(
    staffService.createStaff('r1', { email: 'owner@other.com', name: 'X', role: 'admin' }),
    (err) => err.statusCode === 409
  )
  assert.deepEqual(auth.users.get(other.uid).customClaims, { role: 'admin', restaurantId: 'r9' })
})

test('deactivating disables the account, revokes sessions and removes the restaurant claim', async () => {
  store.clear()
  auth.calls.length = 0
  const staff = await staffService.createStaff('r1', { email: 'rec@example.com', name: 'Ravi', role: 'receptionist' })

  const result = await staffService.toggleStaff('r1', staff.uid, { actorUid: 'some-admin' })

  assert.equal(result.isActive, false)
  assert.equal(auth.users.get(staff.uid).disabled, true)
  assert.ok(auth.calls.some(([kind, uid]) => kind === 'revoke' && uid === staff.uid))
  assert.deepEqual(auth.users.get(staff.uid).customClaims, { role: 'receptionist', restaurantId: null })
  assert.equal(store.get(`restaurants/r1/staff/${staff.uid}`).isActive, false)

  const back = await staffService.toggleStaff('r1', staff.uid, { actorUid: 'some-admin' })
  assert.equal(back.isActive, true)
  assert.equal(auth.users.get(staff.uid).disabled, false)
  assert.deepEqual(auth.users.get(staff.uid).customClaims, { role: 'receptionist', restaurantId: 'r1' })
})

test('an admin cannot deactivate their own account', async () => {
  store.clear()
  const admin = await staffService.createStaff('r1', { email: 'boss@example.com', name: 'Boss', role: 'admin' })
  await assert.rejects(
    staffService.toggleStaff('r1', admin.uid, { actorUid: admin.uid }),
    (err) => err.statusCode === 400 && err.extra.code === 'SELF_DEACTIVATE'
  )
  assert.equal(auth.users.get(admin.uid).disabled, false)
})

test('legacy staff docs without isActive are treated as active and can be deactivated', async () => {
  store.clear()
  const legacy = await auth.createUser({ email: 'old@example.com', displayName: 'Old' })
  store.set(`restaurants/r1/staff/${legacy.uid}`, { uid: legacy.uid, email: 'old@example.com', role: 'chef', restaurantId: 'r1' })
  const result = await staffService.toggleStaff('r1', legacy.uid, { actorUid: 'x' })
  assert.equal(result.isActive, false)
  assert.equal(auth.users.get(legacy.uid).disabled, true)
})

test('setup link can be re-issued for a staff member of that restaurant only', async () => {
  store.clear()
  const staff = await staffService.createStaff('r1', { email: 'new@example.com', name: 'New', role: 'chef' })
  const again = await staffService.createSetupLink('r1', staff.uid)
  assert.match(again.setupLink, /reset\?email=new%40example\.com/)
  await assert.rejects(staffService.createSetupLink('r2', staff.uid), (err) => err.statusCode === 404)
})

// ───────────────────────── Bug #12 / #37 / #80: socket identity and roles ─────────────────────────

test('socket roles: chefs run kitchen events, receptionists run cancels, and nobody crosses tenants', () => {
  const chef = { role: 'chef', restaurantId: 'r1' }
  const reception = { role: 'receptionist', restaurantId: 'r1' }
  assert.equal(canAct(chef, 'item_status', 'r1'), true)
  assert.equal(canAct(chef, 'cancel_order', 'r1'), false)
  assert.equal(canAct(reception, 'cancel_order', 'r1'), true)
  assert.equal(canAct(reception, 'item_status', 'r2'), false)
  assert.equal(canAct(null, 'item_status', 'r1'), false)
  assert.equal(canAct({ role: 'superadmin' }, 'close_bill', 'anything'), true)
})

test('socket flood limit applies per socket and per IP', () => {
  const sock = (id, ip) => ({ id, data: { ip } })
  let allowed = 0
  for (let i = 0; i < 12; i += 1) {
    if (allowEvent(sock(`s-${i}`, '203.0.113.5'), 'join_restaurant')) allowed += 1
  }
  // Per-IP ceiling for join_restaurant is 10 × 4 = 40, so 12 different sockets all pass.
  assert.equal(allowed, 12)

  const one = sock('same-socket', '198.51.100.7')
  let blocked = 0
  for (let i = 0; i < 12; i += 1) {
    if (!allowEvent(one, 'join_restaurant')) blocked += 1
  }
  assert.equal(blocked, 2)
})
