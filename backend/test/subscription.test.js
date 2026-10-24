const test = require('node:test')
const assert = require('node:assert/strict')
const { buildSubscriptionUpdate, PLAN_AMOUNT } = require('../src/services/subscriptionService')

const NOW = new Date('2026-10-24T10:00:00.000Z')
const days = (n) => n * 24 * 60 * 60 * 1000
const iso = (ms) => new Date(NOW.getTime() + ms).toISOString()

test('markPaid on a new / expired account starts the period from today', () => {
  const update = buildSubscriptionUpdate('markPaid', { days: 30, current: { subscriptionStatus: 'trial' }, now: NOW })
  assert.equal(update.subscriptionStatus, 'active')
  assert.equal(update.currentPeriodStart, NOW.toISOString())
  assert.equal(update.currentPeriodEnd, iso(days(30)))
  assert.equal(update.planAmount, PLAN_AMOUNT)
})

test('early renewal stacks on remaining paid days instead of resetting them (Bug #67)', () => {
  const current = {
    subscriptionStatus: 'active',
    currentPeriodStart: iso(-days(20)),
    currentPeriodEnd: iso(days(10)), // 10 days left
  }
  const update = buildSubscriptionUpdate('markPaid', { days: 30, current, now: NOW })
  assert.equal(update.currentPeriodEnd, iso(days(40)), 'old 10 days + 30 new')
  assert.equal(update.currentPeriodStart, current.currentPeriodStart, 'period start is kept')
})

test('extendTrial on a paid restaurant never downgrades it to trial (Bug #27)', () => {
  const current = {
    subscriptionStatus: 'active',
    currentPeriodEnd: iso(days(5)),
  }
  const update = buildSubscriptionUpdate('extendTrial', { days: 15, current, now: NOW })
  assert.equal('subscriptionStatus' in update, false, 'status must not be written')
  assert.equal(update.currentPeriodEnd, iso(days(20)))
})

test('extendTrial on an expired or trial restaurant still grants a trial', () => {
  const update = buildSubscriptionUpdate('extendTrial', { days: 15, current: { subscriptionStatus: 'trial' }, now: NOW })
  assert.equal(update.subscriptionStatus, 'trial')
  assert.equal(update.trialEndsAt, iso(days(15)))
})

test('an active restaurant whose paid period already lapsed is treated as expired (Bug #27)', () => {
  const current = { subscriptionStatus: 'active', currentPeriodEnd: iso(-days(2)) }
  const update = buildSubscriptionUpdate('extendTrial', { days: 15, current, now: NOW })
  assert.equal(update.subscriptionStatus, 'trial')
})

test('suspend and reactivate', () => {
  assert.deepEqual(buildSubscriptionUpdate('suspend', { current: {}, now: NOW }), {
    subscriptionStatus: 'suspended',
    suspendedAt: NOW.toISOString(),
  })
  const reactivated = buildSubscriptionUpdate('reactivate', { days: 30, current: { subscriptionStatus: 'suspended' }, now: NOW })
  assert.equal(reactivated.subscriptionStatus, 'active')
  assert.equal(reactivated.suspendedAt, null)
})

test('days must be a whole number between 1 and 365', () => {
  for (const bad of [0, -5, 1.5, 366, 'abc']) {
    assert.throws(() => buildSubscriptionUpdate('markPaid', { days: bad, current: {}, now: NOW }), /days must be/)
  }
})

test('unknown action is rejected', () => {
  assert.throws(() => buildSubscriptionUpdate('refund', { current: {}, now: NOW }), /Invalid subscription action/)
})
