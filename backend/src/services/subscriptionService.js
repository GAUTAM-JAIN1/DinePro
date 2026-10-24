const { HttpError } = require('./billing')

const TRIAL_DAYS = 15
const BILLING_DAYS = 30
const PLAN_AMOUNT = 2000
const MAX_DAYS = 365

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toIso(date) {
  return date.toISOString()
}

function getDefaultSubscription(now = new Date()) {
  return {
    subscriptionStatus: 'trial',
    trialStartedAt: toIso(now),
    trialEndsAt: toIso(addDays(now, TRIAL_DAYS)),
    currentPeriodStart: null,
    currentPeriodEnd: null,
    planAmount: PLAN_AMOUNT,
    lastPaidAt: null,
    suspendedAt: null,
  }
}

function getSubscriptionState(restaurant, now = new Date()) {
  const status = restaurant?.subscriptionStatus || 'trial'
  const createdAt = restaurant?.createdAt ? new Date(restaurant.createdAt) : now
  const lastPaidAt = restaurant?.lastPaidAt ? new Date(restaurant.lastPaidAt) : createdAt
  const trialEndsAt = restaurant?.trialEndsAt
    ? new Date(restaurant.trialEndsAt)
    : addDays(createdAt, TRIAL_DAYS)
  const currentPeriodEnd = restaurant?.currentPeriodEnd
    ? new Date(restaurant.currentPeriodEnd)
    : addDays(lastPaidAt, BILLING_DAYS)

  const isTrialValid = status === 'trial' && trialEndsAt && trialEndsAt >= now
  const isPaidValid = status === 'active' && currentPeriodEnd && currentPeriodEnd >= now
  const isSuspended = status === 'suspended'
  const isServiceEnabled = !isSuspended && (isTrialValid || isPaidValid)

  let effectiveStatus = status
  if (!isServiceEnabled && status !== 'suspended') {
    effectiveStatus = 'expired'
  }

  return {
    effectiveStatus,
    isServiceEnabled,
    planAmount: restaurant?.planAmount || PLAN_AMOUNT,
    trialEndsAt: toIso(trialEndsAt),
    currentPeriodEnd: toIso(currentPeriodEnd),
    daysRemaining: getDaysRemaining(
      status === 'trial' ? trialEndsAt : currentPeriodEnd,
      now
    ),
  }
}

function getDaysRemaining(endDate, now = new Date()) {
  if (!endDate) return 0
  const diff = endDate.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/** True when the restaurant is active and its paid period has not run out yet. */
function isPaidActive(current, now) {
  return Boolean(
    current?.subscriptionStatus === 'active' &&
    current.currentPeriodEnd &&
    new Date(current.currentPeriodEnd) >= now
  )
}

function resolveDays(days, fallback) {
  if (days === undefined || days === null || days === '') return fallback
  const value = Number(days)
  if (!Number.isInteger(value) || value < 1 || value > MAX_DAYS) {
    throw new HttpError(400, `days must be a whole number between 1 and ${MAX_DAYS}`)
  }
  return value
}

/**
 * Computes the Firestore update for a subscription action.
 *
 * @param current  the restaurant doc as it is right now (needed so that
 *                 renewals and grants build on the existing period)
 */
function buildSubscriptionUpdate(action, { days, current = {}, now = new Date() } = {}) {
  if (action === 'markPaid' || action === 'reactivate') {
    const billingDays = resolveDays(days, BILLING_DAYS)
    const paidNow = isPaidActive(current, now)
    // Bug #67: an early renewal stacks on the remaining paid days instead of
    // throwing them away. An expired or new period starts from today.
    const base = paidNow ? new Date(current.currentPeriodEnd) : now
    const currentPeriodStart = paidNow && current.currentPeriodStart
      ? current.currentPeriodStart
      : toIso(now)
    return {
      subscriptionStatus: 'active',
      currentPeriodStart,
      currentPeriodEnd: toIso(addDays(base, billingDays)),
      lastPaidAt: toIso(now),
      planAmount: PLAN_AMOUNT,
      suspendedAt: null,
    }
  }

  if (action === 'extendTrial') {
    const extraDays = resolveDays(days, TRIAL_DAYS)
    // Bug #27: a paid restaurant must never be pushed back into trial status.
    // The extra days go onto the paid period and the status stays 'active'.
    if (isPaidActive(current, now)) {
      return {
        currentPeriodEnd: toIso(addDays(new Date(current.currentPeriodEnd), extraDays)),
      }
    }
    return {
      subscriptionStatus: 'trial',
      trialEndsAt: toIso(addDays(now, extraDays)),
      planAmount: PLAN_AMOUNT,
      suspendedAt: null,
    }
  }

  if (action === 'suspend') {
    return {
      subscriptionStatus: 'suspended',
      suspendedAt: toIso(now),
    }
  }

  throw new HttpError(400, 'Invalid subscription action')
}

module.exports = {
  BILLING_DAYS,
  PLAN_AMOUNT,
  TRIAL_DAYS,
  buildSubscriptionUpdate,
  getDefaultSubscription,
  getSubscriptionState,
  isPaidActive,
}
