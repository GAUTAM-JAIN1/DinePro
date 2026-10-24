const express = require('express')
const router = express.Router()
const { getTables, getTableByIdentifier, addTable, addTablesUpTo, deleteTable, updateTable, publicTable } = require('../services/tableService')
const { verifyToken, requireRole } = require('../middleware/auth')
const { requireActiveSubscription } = require('../middleware/subscription')
const { requireRestaurantAccess } = require('../middleware/restaurantAccess')
const { sendError } = require('../utils/httpErrors')

// GET /api/tables/:restaurantId - PUBLIC list for QR manager/customer checks
router.get('/:restaurantId', requireActiveSubscription, async (req, res) => {
  try {
    // Bug #34: the public list carries only what a customer or the QR check needs.
    const tables = (await getTables(req.params.restaurantId)).map(publicTable)
    res.json({ success: true, tables })
  } catch (err) {
    sendError(res, err, { label: 'tables' })
  }
})

// GET /api/tables/:restaurantId/:tableIdentifier - PUBLIC QR table check.
// tableIdentifier may be the Firestore table doc id or the human tableNumber.
router.get('/:restaurantId/:tableIdentifier', requireActiveSubscription, async (req, res) => {
  try {
    const table = await getTableByIdentifier(req.params.restaurantId, req.params.tableIdentifier)

    if (!table) {
      return res.status(404).json({ success: false, error: 'Table not found' })
    }

    if (table.isActive === false) {
      return res.status(403).json({ success: false, error: 'Table is inactive', table })
    }

    res.json({ success: true, table })
  } catch (err) {
    sendError(res, err, { label: 'tables' })
  }
})

// POST /api/tables/:restaurantId/bulk - ADMIN ONLY. Creates tables 1..count that don't exist yet (Bug #55).
router.post('/:restaurantId/bulk', verifyToken, requireRole('admin'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  const count = Number(req.body?.count)
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return res.status(400).json({ success: false, error: 'count must be a whole number from 1 to 100' })
  }
  try {
    const result = await addTablesUpTo(req.params.restaurantId, count)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err, { label: 'tables.bulk' })
  }
})

// POST /api/tables/:restaurantId - ADMIN ONLY
router.post('/:restaurantId', verifyToken, requireRole('admin'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  try {
    const { tableNumber } = req.body
    if (!tableNumber) {
      return res.status(400).json({ success: false, error: 'tableNumber is required' })
    }

    const existing = await getTables(req.params.restaurantId)
    const duplicate = existing.find(t => t.tableNumber === String(tableNumber))
    if (duplicate) {
      return res.status(400).json({ success: false, error: 'Table number already exists' })
    }

    const table = await addTable(req.params.restaurantId, { tableNumber: String(tableNumber) })
    res.json({ success: true, table })
  } catch (err) {
    sendError(res, err, { label: 'tables' })
  }
})

// DELETE /api/tables/:restaurantId/:tableId - ADMIN ONLY
router.delete('/:restaurantId/:tableId', verifyToken, requireRole('admin'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  try {
    await deleteTable(req.params.restaurantId, req.params.tableId)
    res.json({ success: true })
  } catch (err) {
    sendError(res, err, { label: 'tables' })
  }
})

// PUT /api/tables/:restaurantId/:tableId - ADMIN ONLY
router.put('/:restaurantId/:tableId', verifyToken, requireRole('admin'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  try {
    const table = await updateTable(req.params.restaurantId, req.params.tableId, req.body)
    res.json({ success: true, table })
  } catch (err) {
    sendError(res, err, { label: 'tables' })
  }
})

module.exports = router
