const { db, auth } = require('./firebaseAdmin')
const {
  buildSubscriptionUpdate,
  getDefaultSubscription,
  getSubscriptionState,
} = require('./subscriptionService')
const { HttpError, PAYMENT_MODES, toPaise, toRupees } = require('./billing')
const { writeAudit, writeAuditInTransaction } = require('./auditService')
const { DEFAULT_TIMEZONE } = require('./dayKey')

// Bug #33: one colour field. Older documents stored it as themeColor; reads
// always expose brandColor, so every screen agrees.
const DEFAULT_BRAND_COLOR = '#B88746'

function normalizeRestaurant(doc) {
  const data = doc.data()
  return {
    id: doc.id,
    ...data,
    brandColor: data.brandColor || data.themeColor || DEFAULT_BRAND_COLOR,
    timezone: data.timezone || DEFAULT_TIMEZONE,
    subscription: getSubscriptionState(data),
  }
}

async function listRestaurants({ includeArchived = false } = {}) {
  const snap = await db.collection('restaurants').orderBy('createdAt', 'desc').get()
  return snap.docs
    .map(normalizeRestaurant)
    .filter((r) => includeArchived || !r.archivedAt)
}

async function getRestaurant(restaurantId) {
  const doc = await db.collection('restaurants').doc(restaurantId).get()
  if (!doc.exists) return null
  return normalizeRestaurant(doc)
}

async function createRestaurant(restaurantData) {
  const now = new Date().toISOString()
  const restaurantId = restaurantData.id || `rest_${Date.now()}`
  const restaurantRef = db.collection('restaurants').doc(restaurantId)

  const restaurant = {
    name: restaurantData.name,
    address: restaurantData.address || '',
    phone: restaurantData.phone || '',
    ownerEmail: restaurantData.ownerEmail || '',
    logoUrl: restaurantData.logoUrl || '',
    brandColor: restaurantData.brandColor || DEFAULT_BRAND_COLOR,
    timezone: DEFAULT_TIMEZONE,
    onboardingCompleted: restaurantData.onboardingCompleted ?? false,
    onboardingCompletedAt: restaurantData.onboardingCompletedAt || null,
    ...getDefaultSubscription(new Date(now)),
    subscriptionStatus: restaurantData.subscriptionStatus || 'trial',
    createdAt: now,
    updatedAt: now,
  }

  await restaurantRef.set(restaurant)
  return { id: restaurantId, ...restaurant }
}

// Bug #77: settings changes are audited with before/after values for the
// fields that were touched.
async function updateRestaurant(restaurantId, updates, actor = null) {
  const restaurantRef = db.collection('restaurants').doc(restaurantId)
  const changedKeys = Object.keys(updates)
  const beforeDoc = await restaurantRef.get()
  const beforeData = beforeDoc.exists ? beforeDoc.data() : {}
  const before = Object.fromEntries(changedKeys.map((key) => [key, beforeData[key] ?? null]))

  const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() }
  await restaurantRef.update(cleanUpdates)
  await writeAudit(restaurantId, {
    actor,
    action: 'restaurant.settings',
    before,
    after: Object.fromEntries(changedKeys.map((key) => [key, updates[key]])),
  })

  const doc = await restaurantRef.get()
  return normalizeRestaurant(doc)
}

/** Bug #69: a payment must be recorded for markPaid and reactivate. */
function validatePaymentInput(payment) {
  if (!payment || typeof payment !== 'object') {
    throw new HttpError(400, 'payment is required (amount, method, reference) for this action', { code: 'PAYMENT_REQUIRED' })
  }
  const amount = Number(payment.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    throw new HttpError(400, 'payment.amount must be a positive amount', { code: 'PAYMENT_INVALID' })
  }
  if (!PAYMENT_MODES.includes(payment.method)) {
    throw new HttpError(400, `payment.method must be one of: ${PAYMENT_MODES.join(', ')}`, { code: 'PAYMENT_INVALID' })
  }
  const reference = String(payment.reference || '').trim()
  if (payment.method !== 'cash' && reference.length < 3) {
    throw new HttpError(400, 'payment.reference (UPI/bank/card ref) is required for non-cash payments', { code: 'PAYMENT_INVALID' })
  }
  return {
    amountPaid: toRupees(toPaise(amount)),
    method: payment.method,
    reference: reference.slice(0, 100),
  }
}

const SUBSCRIPTION_ACTIONS = ['markPaid', 'extendTrial', 'suspend', 'reactivate']

async function updateRestaurantSubscription(restaurantId, action, { days, payment, actor = null } = {}) {
  if (!SUBSCRIPTION_ACTIONS.includes(action)) {
    throw new HttpError(400, `action must be one of: ${SUBSCRIPTION_ACTIONS.join(', ')}`, { code: 'BAD_ACTION' })
  }
  const needsPayment = action === 'markPaid' || action === 'reactivate'
  const paymentInput = needsPayment ? validatePaymentInput(payment) : null

  const restaurantRef = db.collection('restaurants').doc(restaurantId)
  const now = new Date()
  let paymentId = null

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(restaurantRef)
    if (!snap.exists) throw new HttpError(404, 'Restaurant not found', { code: 'RESTAURANT_NOT_FOUND' })
    const current = snap.data()

    // buildSubscriptionUpdate reads the current period, so it must run on the
    // same snapshot the transaction writes against.
    const update = buildSubscriptionUpdate(action, { days, current, now })
    const updates = { ...update, updatedAt: now.toISOString() }

    if (needsPayment) {
      const paymentRef = restaurantRef.collection('payments').doc()
      paymentId = paymentRef.id
      tx.set(paymentRef, {
        ...paymentInput,
        action,
        days: days ?? null,
        periodStart: updates.currentPeriodStart,
        periodEnd: updates.currentPeriodEnd,
        recordedBy: actor,
        createdAt: now.toISOString(),
      })
    }

    tx.update(restaurantRef, updates)

    writeAuditInTransaction(tx, restaurantId, {
      actor,
      action: `subscription.${action}`,
      before: {
        subscriptionStatus: current.subscriptionStatus ?? null,
        currentPeriodEnd: current.currentPeriodEnd ?? null,
        trialEndsAt: current.trialEndsAt ?? null,
      },
      after: {
        subscriptionStatus: updates.subscriptionStatus ?? current.subscriptionStatus ?? null,
        currentPeriodEnd: updates.currentPeriodEnd ?? current.currentPeriodEnd ?? null,
        trialEndsAt: updates.trialEndsAt ?? current.trialEndsAt ?? null,
      },
      meta: { days: days ?? null, paymentId, payment: paymentInput },
    })
  })

  const doc = await restaurantRef.get()
  return { restaurant: normalizeRestaurant(doc), paymentId }
}

/**
 * Bug #58: archiving keeps every order, bill, payment and audit row. The
 * restaurant is suspended, so customers and staff get 402 and nothing new can be
 * written. Nothing is removed.
 */
async function archiveRestaurant(restaurantId, actor = null) {
  const ref = db.collection('restaurants').doc(restaurantId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Restaurant not found', { code: 'RESTAURANT_NOT_FOUND' })
  const before = doc.data()
  if (before.archivedAt) throw new HttpError(409, 'Restaurant is already archived', { code: 'ALREADY_ARCHIVED' })

  const now = new Date().toISOString()
  await ref.update({ archivedAt: now, subscriptionStatus: 'suspended', updatedAt: now })
  await writeAudit(restaurantId, {
    actor,
    action: 'restaurant.archive',
    before: { subscriptionStatus: before.subscriptionStatus ?? null, archivedAt: null },
    after: { subscriptionStatus: 'suspended', archivedAt: now },
  })
  return normalizeRestaurant(await ref.get())
}

const RESTAURANT_SUBCOLLECTIONS = [
  'staff', 'menu', 'menuCategories', 'menuItems', 'tables', 'orders',
  'orderKeys', 'payments', 'auditLogs', 'counters',
]

/**
 * Permanent delete. Only allowed after archiving, so a restaurant can't be
 * removed in one click by mistake. Removes every subcollection, including the
 * payments and audit trail that the old delete missed.
 */
async function deleteRestaurant(restaurantId) {
  const restaurantRef = db.collection('restaurants').doc(restaurantId)
  const doc = await restaurantRef.get()
  if (!doc.exists) throw new HttpError(404, 'Restaurant not found', { code: 'RESTAURANT_NOT_FOUND' })
  if (!doc.data().archivedAt) {
    throw new HttpError(409, 'Archive the restaurant before deleting it permanently', { code: 'NOT_ARCHIVED' })
  }

  const staffSnap = await restaurantRef.collection('staff').get()
  await Promise.all(
    staffSnap.docs.map(async (staffDoc) => {
      const { uid } = staffDoc.data()
      if (uid) {
        try { await auth.deleteUser(uid) } catch (e) { /* already deleted */ }
      }
    })
  )

  for (const col of RESTAURANT_SUBCOLLECTIONS) {
    const snap = await restaurantRef.collection(col).get()
    await Promise.all(snap.docs.map((d) => d.ref.delete()))
  }

  await restaurantRef.delete()
}

/** Subscription summary the admin dashboard can read (Bug #64). Dates and status only. */
async function getSubscriptionSummary(restaurantId) {
  const restaurant = await getRestaurant(restaurantId)
  if (!restaurant) throw new HttpError(404, 'Restaurant not found', { code: 'RESTAURANT_NOT_FOUND' })
  const { effectiveStatus, isServiceEnabled, daysRemaining, trialEndsAt, currentPeriodEnd, planAmount } = restaurant.subscription
  return { effectiveStatus, isServiceEnabled, daysRemaining, trialEndsAt, currentPeriodEnd, planAmount }
}

async function listStaff(restaurantId) {
  const snap = await db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('staff')
    .get()
  return snap.docs.map(d => d.data())
}

async function deleteStaffAccount(restaurantId, uid) {
  try { await auth.deleteUser(uid) } catch (e) { /* already deleted */ }
  await db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('staff')
    .doc(uid)
    .delete()
}

module.exports = {
  createRestaurant,
  getRestaurant,
  listRestaurants,
  updateRestaurant,
  updateRestaurantSubscription,
  archiveRestaurant,
  deleteRestaurant,
  getSubscriptionSummary,
  listStaff,
  deleteStaffAccount,
}