const TRIAL_DAYS = 15
const BILLING_DAYS = 30
const PLAN_AMOUNT = 2000

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

function buildSubscriptionUpdate(action, options = {}) {
  const now = new Date()
  const days = Number(options.days) || BILLING_DAYS

  if (action === 'markPaid') {
    return {
      subscriptionStatus: 'active',
      currentPeriodStart: toIso(now),
      currentPeriodEnd: toIso(addDays(now, days)),
      lastPaidAt: toIso(now),
      planAmount: PLAN_AMOUNT,
      suspendedAt: null,
    }
  }

  if (action === 'extendTrial') {
    const trialDays = Number(options.days) || TRIAL_DAYS
    return {
      subscriptionStatus: 'trial',
      trialEndsAt: toIso(addDays(now, trialDays)),
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

  if (action === 'reactivate') {
    return {
      subscriptionStatus: 'active',
      currentPeriodStart: toIso(now),
      currentPeriodEnd: toIso(addDays(now, days)),
      lastPaidAt: toIso(now),
      planAmount: PLAN_AMOUNT,
      suspendedAt: null,
    }
  }

  throw new Error('Invalid subscription action')
}

module.exports = {
  BILLING_DAYS,
  PLAN_AMOUNT,
  TRIAL_DAYS,
  buildSubscriptionUpdate,
  getDefaultSubscription,
  getSubscriptionState,
}
