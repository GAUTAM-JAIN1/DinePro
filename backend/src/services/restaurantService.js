const { db } = require('./firebaseAdmin')
const {
  buildSubscriptionUpdate,
  getDefaultSubscription,
  getSubscriptionState,
} = require('./subscriptionService')

function normalizeRestaurant(doc) {
  const data = doc.data()
  return {
    id: doc.id,
    ...data,
    subscription: getSubscriptionState(data),
  }
}

async function listRestaurants() {
  const snap = await db.collection('restaurants').orderBy('createdAt', 'desc').get()
  return snap.docs.map(normalizeRestaurant)
}

async function getRestaurant(restaurantId) {
  const doc = await db.collection('restaurants').doc(restaurantId).get()

  if (!doc.exists) {
    return null
  }

  return normalizeRestaurant(doc)
}

async function createRestaurant(restaurantData) {
  const now = new Date().toISOString()
  const restaurantId = restaurantData.id || `rest_${Date.now()}`
  const restaurantRef = db.collection('restaurants').doc(restaurantId)

  const restaurant = {
    name: restaurantData.name,
    address: restaurantData.address || '',
    ownerEmail: restaurantData.ownerEmail || '',
    logoUrl: restaurantData.logoUrl || '',
    themeColor: restaurantData.themeColor || '#B88746',
    onboardingCompleted: restaurantData.onboardingCompleted ?? false,
    onboardingCompletedAt: restaurantData.onboardingCompletedAt || null,
    ...getDefaultSubscription(new Date(now)),
    subscriptionStatus: restaurantData.subscriptionStatus || 'trial',
    createdAt: now,
    updatedAt: now,
  }

  await restaurantRef.set(restaurant)

  return {
    id: restaurantId,
    ...restaurant,
  }
}

async function updateRestaurant(restaurantId, updates) {
  const restaurantRef = db.collection('restaurants').doc(restaurantId)
  const cleanUpdates = {
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await restaurantRef.update(cleanUpdates)

  const doc = await restaurantRef.get()
  return normalizeRestaurant(doc)
}

async function updateRestaurantSubscription(restaurantId, action, options = {}) {
  const updates = {
    ...buildSubscriptionUpdate(action, options),
    updatedAt: new Date().toISOString(),
  }

  const restaurantRef = db.collection('restaurants').doc(restaurantId)
  await restaurantRef.update(updates)

  const doc = await restaurantRef.get()
  return normalizeRestaurant(doc)
}

module.exports = {
  createRestaurant,
  getRestaurant,
  listRestaurants,
  updateRestaurant,
  updateRestaurantSubscription,
}
