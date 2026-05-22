const { db } = require('./firebaseAdmin')

const tableCollection = (restaurantId) =>
  db.collection('restaurants').doc(restaurantId).collection('tables')

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

// Get all tables for a restaurant
const getTables = async (restaurantId) => {
  const snapshot = await tableCollection(restaurantId).orderBy('tableNumber').get()
  return snapshot.docs.map(normalizeTable)
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

// Delete a table
const deleteTable = async (restaurantId, tableId) => {
  await tableCollection(restaurantId).doc(tableId).delete()
}

// Update a table (e.g. toggle active)
const updateTable = async (restaurantId, tableId, updates) => {
  const ref = tableCollection(restaurantId).doc(tableId)
  await ref.update({ ...updates, updatedAt: new Date().toISOString() })
  const doc = await ref.get()
  return normalizeTable(doc)
}

module.exports = { getTables, getTableByIdentifier, addTable, deleteTable, updateTable }
