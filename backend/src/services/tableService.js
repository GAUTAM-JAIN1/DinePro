const { db } = require('./firebaseAdmin')
const { HttpError, OPEN_STATUSES } = require('./billing')

const tableCollection = (restaurantId) =>
  db.collection('restaurants').doc(restaurantId).collection('tables')

const orderCollection = (restaurantId) =>
  db.collection('restaurants').doc(restaurantId).collection('orders')

const normalizeTable = (doc) => {
  const data = doc.data()
  return {
    id: doc.id,
    label: data.label || `Table ${data.tableNumber || doc.id}`,
    capacity: data.capacity ?? null,
    isActive: data.isActive ?? true,
    qrUrl: data.qrUrl || '',
    ...data,
  }
}

/**
 * What the public, unauthenticated list may show. Bug #34: the full document
 * (timestamps, QR data, internal fields) used to be served to anyone with a
 * restaurant id.
 */
const publicTable = (table) => ({
  id: table.id,
  tableNumber: table.tableNumber,
  label: table.label,
  capacity: table.capacity,
  isActive: table.isActive,
})

// Bug #34: table numbers are text ("1", "2", "10"). Sort them as numbers, so
// 10 comes after 9 instead of after 1.
const byTableNumber = (a, b) =>
  String(a.tableNumber ?? '').localeCompare(String(b.tableNumber ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  })

// Get all tables for a restaurant
const getTables = async (restaurantId) => {
  const snapshot = await tableCollection(restaurantId).get()
  return snapshot.docs.map(normalizeTable).sort(byTableNumber)
}

const getTableByIdentifier = async (restaurantId, tableIdentifier) => {
  const tableId = String(tableIdentifier)
  const directDoc = await tableCollection(restaurantId).doc(tableId).get()

  if (directDoc.exists) {
    return normalizeTable(directDoc)
  }

  const byNumber = await tableCollection(restaurantId)
    .where('tableNumber', '==', tableId)
    .limit(1)
    .get()

  if (!byNumber.empty) {
    return normalizeTable(byNumber.docs[0])
  }

  return null
}

// Add a new table
const addTable = async (restaurantId, tableData) => {
  const now = new Date().toISOString()
  const docRef = await tableCollection(restaurantId).add({
    tableNumber: tableData.tableNumber,
    label: tableData.label || `Table ${tableData.tableNumber}`,
    capacity: Number(tableData.capacity) || 4,
    qrUrl: tableData.qrUrl || '',
    isActive: true,
    createdAt: now,
    updatedAt: now
  })
  const doc = await docRef.get()
  return normalizeTable(doc)
}

/**
 * Bug #57: a table with an open bill can't be deleted. Its orders would be left
 * pointing at a table that no longer exists, so the bill could never be settled
 * from the table screen. Settle or cancel the bill first.
 */
const deleteTable = async (restaurantId, tableId) => {
  const orders = await orderCollection(restaurantId).where('tableId', '==', tableId).get()
  const open = orders.docs.map((d) => d.data()).filter((o) => OPEN_STATUSES.includes(o.status))
  if (open.length > 0) {
    throw new HttpError(
      409,
      'This table has an open bill. Settle or cancel it before deleting the table.',
      { code: 'TABLE_HAS_OPEN_ORDER', openOrderCount: open.length }
    )
  }
  await tableCollection(restaurantId).doc(tableId).delete()
}

// Update a table (e.g. toggle active)
const updateTable = async (restaurantId, tableId, updates) => {
  const ref = tableCollection(restaurantId).doc(tableId)
  await ref.update({ ...updates, updatedAt: new Date().toISOString() })
  const doc = await ref.get()
  return normalizeTable(doc)
}

/**
 * Bug #55: the setup wizard asks for "tables 1..N". Creating only the missing
 * ones makes the same request safe to repeat, and to resume after a failure.
 */
const addTablesUpTo = async (restaurantId, count) => {
  const existing = await getTables(restaurantId)
  const have = new Set(existing.map((t) => String(t.tableNumber)))
  const created = []
  const skipped = []
  for (let n = 1; n <= count; n += 1) {
    const tableNumber = String(n)
    if (have.has(tableNumber)) {
      skipped.push(tableNumber)
      continue
    }
    created.push(await addTable(restaurantId, { tableNumber }))
  }
  return { created, skipped }
}

module.exports = {
  getTables,
  getTableByIdentifier,
  addTable,
  addTablesUpTo,
  deleteTable,
  updateTable,
  publicTable,
}
