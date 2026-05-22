const express = require('express')
const router = express.Router()
const { getTables, getTableByIdentifier, addTable, deleteTable, updateTable } = require('../services/tableService')
const { verifyToken, requireRole } = require('../middleware/auth')
const { requireActiveSubscription } = require('../middleware/subscription')
const { requireRestaurantAccess } = require('../middleware/restaurantAccess')

// GET /api/tables/:restaurantId - PUBLIC list for QR manager/customer checks
router.get('/:restaurantId', requireActiveSubscription, async (req, res) => {
  try {
    const tables = await getTables(req.params.restaurantId)
    res.json({ success: true, tables })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
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
    res.status(500).json({ success: false, error: err.message })
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
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /api/tables/:restaurantId/:tableId - ADMIN ONLY
router.delete('/:restaurantId/:tableId', verifyToken, requireRole('admin'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  try {
    await deleteTable(req.params.restaurantId, req.params.tableId)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PUT /api/tables/:restaurantId/:tableId - ADMIN ONLY
router.put('/:restaurantId/:tableId', verifyToken, requireRole('admin'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  try {
    const table = await updateTable(req.params.restaurantId, req.params.tableId, req.body)
    res.json({ success: true, table })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
