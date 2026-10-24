const { db } = require('./firebaseAdmin')
const { HttpError } = require('./billing')

function normalizeMenuItem(doc) {
  const data = doc.data()

  return {
    id: doc.id,
    ...data,
    isAvailable: data.isAvailable ?? data.available ?? true,
    sortOrder: data.sortOrder ?? 0,
    subcategory: data.subcategory ?? '',
    subcategoryHindi: data.subcategoryHindi ?? '',
  }
}

async function getRestaurantMenu(restaurantId, options = {}) {
  let query = db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('menu')

  if (options.availableOnly) {
    query = query.where('isAvailable', '==', true)
  }

  const snapshot = await query.orderBy('sortOrder', 'asc').get()
  return snapshot.docs.map(normalizeMenuItem)
}

async function addMenuItem(restaurantId, itemData) {
  const now = new Date().toISOString()
  const menuRef = db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('menu')

  const docRef = await menuRef.add({
    name: itemData.name,
    nameHindi: itemData.nameHindi || '',
    description: itemData.description || '',
    descriptionHindi: itemData.descriptionHindi || '',
    price: Number(itemData.price),
    category: itemData.category || 'Mains',
    categoryHindi: itemData.categoryHindi || '',
    subcategory: itemData.subcategory || '',
    subcategoryHindi: itemData.subcategoryHindi || '',
    imageUrl: itemData.imageUrl || '',
    isVeg: itemData.isVeg ?? true,
    isAvailable: itemData.isAvailable ?? true,
    isBestseller: itemData.isBestseller ?? false,
    hasVariants: itemData.hasVariants ?? false,
    variants: itemData.variants || [],
    sortOrder: itemData.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  })

  const doc = await docRef.get()
  return normalizeMenuItem(doc)
}

async function updateMenuItem(restaurantId, itemId, updates) {
  const itemRef = db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('menu')
    .doc(itemId)

  const cleanUpdates = {
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  if (cleanUpdates.price !== undefined) {
    cleanUpdates.price = Number(cleanUpdates.price)
  }

  await itemRef.update(cleanUpdates)

  const doc = await itemRef.get()
  return normalizeMenuItem(doc)
}

async function deleteMenuItem(restaurantId, itemId) {
  await db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('menu')
    .doc(itemId)
    .delete()

  return { success: true }
}

async function toggleItemAvailability(restaurantId, itemId) {
  const itemRef = db
    .collection('restaurants')
    .doc(restaurantId)
    .collection('menu')
    .doc(itemId)

  const doc = await itemRef.get()
  if (!doc.exists) throw new HttpError(404, 'Menu item not found', { code: 'MENU_ITEM_NOT_FOUND' })

  const current = doc.data()
  const newAvail = !(current.isAvailable ?? current.available ?? true)

  await itemRef.update({
    isAvailable: newAvail,
    updatedAt: new Date().toISOString(),
  })

  return normalizeMenuItem(await itemRef.get())
}

async function reorderMenuItems(restaurantId, items) {
  const batch = db.batch()
  const menuCol = db.collection('restaurants').doc(restaurantId).collection('menu')

  for (const { id, sortOrder } of items) {
    batch.update(menuCol.doc(id), { sortOrder, updatedAt: new Date().toISOString() })
  }

  await batch.commit()
  return { success: true }
}

/**
 * Bug #55: adds dishes that are not on the menu yet, matched by name and
 * category, so the same setup request can be repeated safely.
 * `rows` is [{ index, data }] where data already passed menuItemCreate.
 */
async function addMenuItemsIfMissing(restaurantId, rows) {
  const existing = await getRestaurantMenu(restaurantId)
  const keyOf = (item) =>
    `${String(item.name || '').trim().toLowerCase()}|${String(item.category || 'Mains').trim().toLowerCase()}`
  const known = new Set(existing.map(keyOf))
  const created = []
  const skipped = []

  for (const row of rows) {
    const key = keyOf(row.data)
    if (known.has(key)) {
      skipped.push({ index: row.index, name: row.data.name, reason: 'already on the menu' })
      continue
    }
    known.add(key)
    created.push(await addMenuItem(restaurantId, row.data))
  }

  return { created, skipped }
}

module.exports = {
  addMenuItemsIfMissing,
  addMenuItem,
  deleteMenuItem,
  getRestaurantMenu,
  updateMenuItem,
  toggleItemAvailability,
  reorderMenuItems,
}