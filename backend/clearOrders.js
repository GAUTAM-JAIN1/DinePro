require('dotenv').config()
const { db } = require('./src/services/firebaseAdmin')

// Bug #29: this used to run with ZERO confirmation — `node clearOrders.js`
// with no arguments wiped every order for every restaurant on the project
// instantly. A typo (forgetting the restaurant id) was indistinguishable
// from "delete everything". Now:
//   - restaurant id(s) are always required explicitly, OR
//   - --all opts into the "every restaurant" behaviour
//   - --confirm is required to actually delete anything (dry-run otherwise)
//
// Usage:
//   node clearOrders.js rest_001 rest_1781589726775 --confirm
//   node clearOrders.js --all --confirm
//   node clearOrders.js rest_001                      (dry run — lists counts, deletes nothing)

const rawArgs = process.argv.slice(2)
const confirmed = rawArgs.includes('--confirm')
const wantsAll = rawArgs.includes('--all')
const argIds = rawArgs.filter((a) => a !== '--confirm' && a !== '--all')

async function getAllRestaurantIds() {
  const snap = await db.collection('restaurants').get()
  return snap.docs.map((doc) => doc.id)
}

async function countOrders(restaurantId) {
  const snap = await db.collection('restaurants').doc(restaurantId).collection('orders').get()
  return snap.docs
}

async function deleteAllOrders(restaurantId) {
  const docs = await countOrders(restaurantId)

  if (docs.length === 0) {
    console.log(`[${restaurantId}] Koi order nahi mila, kuch delete nahi karna.`)
    return 0
  }

  if (!confirmed) {
    console.log(`[${restaurantId}] DRY RUN — ${docs.length} orders delete hote (re-run with --confirm).`)
    return 0
  }

  const batch = db.batch()
  docs.forEach((doc) => batch.delete(doc.ref))
  await batch.commit()

  console.log(`[${restaurantId}] ${docs.length} orders delete ho gaye.`)
  return docs.length
}

async function run() {
  if (argIds.length === 0 && !wantsAll) {
    console.error(
      'Usage: node clearOrders.js <restaurantId...> --confirm\n' +
      '   or: node clearOrders.js --all --confirm   (ALL restaurants — use with care)\n' +
      'Add --confirm to actually delete; without it this is a dry run.'
    )
    process.exitCode = 1
    return
  }

  let restaurantIds = argIds

  if (wantsAll) {
    restaurantIds = await getAllRestaurantIds()
    if (restaurantIds.length === 0) {
      console.log('Koi restaurant nahi mila Firestore mein.')
      return
    }
    console.log(`--all: found ${restaurantIds.length} restaurants: ${restaurantIds.join(', ')}\n`)
  } else {
    console.log(`Clearing orders for: ${restaurantIds.join(', ')}\n`)
  }

  if (!confirmed) {
    console.log('⚠️  --confirm not passed — this is a DRY RUN, nothing will be deleted.\n')
  }

  let total = 0
  for (const restaurantId of restaurantIds) {
    total += await deleteAllOrders(restaurantId)
  }
  console.log(`\nTotal ${total} orders delete hue.${confirmed ? '' : ' (dry run)'}`)
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message)
    process.exit(1)
  })
