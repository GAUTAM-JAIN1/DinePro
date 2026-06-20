const { db, auth } = require('./firebaseAdmin')
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
  return { id: restaurantId, ...restaurant }
}

async function updateRestaurant(restaurantId, updates) {
  const restaurantRef = db.collection('restaurants').doc(restaurantId)
  const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() }
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

async function deleteRestaurant(restaurantId) {
  const restaurantRef = db.collection('restaurants').doc(restaurantId)
  const doc = await restaurantRef.get()
  if (!doc.exists) throw new Error('Restaurant not found')

  // Staff accounts Firebase Auth se delete karo
  const staffSnap = await db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('staff')
    .get()

  const deletePromises = staffSnap.docs.map(async (staffDoc) => {
    const { uid } = staffDoc.data()
    if (uid) {
      try { await auth.deleteUser(uid) } catch (e) { /* already deleted */ }
    }
    return staffDoc.ref.delete()
  })
  await Promise.all(deletePromises)

  // Menu, tables bhi delete karo
  const collections = ['menuCategories', 'menuItems', 'tables', 'orders']
  for (const col of collections) {
    const snap = await restaurantRef.collection(col).get()
    await Promise.all(snap.docs.map(d => d.ref.delete()))
  }

  await restaurantRef.delete()
}

async function createStaffAccount(restaurantId, restaurantName, { email, password, role }) {
  // Firebase Auth mein user banao
  const userRecord = await auth.createUser({ email, password, displayName: `${role} - ${restaurantName}` })

  // Custom claims lagao
  await auth.setCustomUserClaims(userRecord.uid, {
    role,
    restaurantId,
  })

  // Staff subcollection mein save karo
  await db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('staff')
    .doc(userRecord.uid)
    .set({
      uid: userRecord.uid,
      email,
      role,
      restaurantId,
      createdAt: new Date().toISOString(),
    })

  return { uid: userRecord.uid, email, role }
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
  deleteRestaurant,
  createStaffAccount,
  listStaff,
  deleteStaffAccount,
}