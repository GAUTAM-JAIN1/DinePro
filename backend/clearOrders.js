require('dotenv').config()
const { db } = require('./src/services/firebaseAdmin')

// Command line arguments se restaurant IDs lo
// Usage: node clearOrders.js rest_001 rest_1781589726775
// Agar koi argument nahi diya, toh saare restaurants ke orders clear honge
const argIds = process.argv.slice(2)

async function getAllRestaurantIds() {
  const snap = await db.collection('restaurants').get()
  return snap.docs.map((doc) => doc.id)
}

async function deleteAllOrders(restaurantId) {
  const ordersRef = db.collection('restaurants').doc(restaurantId).collection('orders')
  const snapshot = await ordersRef.get()

  if (snapshot.empty) {
    console.log(`[${restaurantId}] Koi order nahi mila, kuch delete nahi karna.`)
    return 0
  }

  const batch = db.batch()
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref)
  })
  await batch.commit()

  console.log(`[${restaurantId}] ${snapshot.size} orders delete ho gaye.`)
  return snapshot.size
}

async function run() {
  let restaurantIds = argIds

  if (restaurantIds.length === 0) {
    console.log('Koi restaurant ID nahi diya gaya — saare restaurants ke orders clear honge.\n')
    restaurantIds = await getAllRestaurantIds()
    if (restaurantIds.length === 0) {
      console.log('Koi restaurant nahi mila Firestore mein.')
      return
    }
    console.log(`Found ${restaurantIds.length} restaurants: ${restaurantIds.join(', ')}\n`)
  } else {
    console.log(`Clearing orders for: ${restaurantIds.join(', ')}\n`)
  }

  let total = 0
  for (const restaurantId of restaurantIds) {
    total += await deleteAllOrders(restaurantId)
  }
  console.log(`\nTotal ${total} orders delete hue.`)
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message)
    process.exit(1)
  })