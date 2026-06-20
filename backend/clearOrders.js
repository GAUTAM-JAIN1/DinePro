require('dotenv').config()
const { db } = require('./src/services/firebaseAdmin')

// Yahan apne dono restaurant IDs daal de
const RESTAURANT_IDS = ['rest_001', 'rest_1781589726775']

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
  let total = 0
  for (const restaurantId of RESTAURANT_IDS) {
    total += await deleteAllOrders(restaurantId)
  }
  console.log(`\nTotal ${total} orders delete hue dono restaurants se.`)
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message)
    process.exit(1)
  })