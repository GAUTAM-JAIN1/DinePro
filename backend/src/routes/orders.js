const express = require('express')
const router = express.Router()
const {
  upsertOrder,
  updateOrder,
  getRestaurantOrders,
  getOrderHistory,
  getDailyStats,
  getDailyReport,
} = require('../services/orderService')
const { verifyToken, requireRole } = require('../middleware/auth')
const { requireActiveSubscription } = require('../middleware/subscription')
const { requireRestaurantAccess } = require('../middleware/restaurantAccess')

// POST /api/orders — PUBLIC (customer places order, no login needed)
router.post('/', requireActiveSubscription, async (req, res) => {
  try {
    const { restaurantId, tableId, tableNumber, items, specialInstructions } = req.body
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'restaurantId is required' })
    }

    const order = await upsertOrder(restaurantId, {
      tableId, tableNumber, items, specialInstructions
    })
    res.json({ success: true, order })
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message })
  }
})

// GET /api/orders/:restaurantId/stats — ADMIN + RECEPTIONIST
router.get('/:restaurantId/stats', verifyToken, requireRole('admin', 'receptionist'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  try {
    const stats = await getDailyStats(req.params.restaurantId)
    res.json({ success: true, stats })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/orders/:restaurantId/daily-report — ADMIN + RECEPTIONIST
router.get('/:restaurantId/daily-report', verifyToken, requireRole('admin', 'receptionist'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  try {
    const report = await getDailyReport(req.params.restaurantId)
    res.json({ success: true, report })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/orders/:restaurantId/history
router.get('/:restaurantId/history', verifyToken, requireRole('admin', 'receptionist'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const orders = await getOrderHistory(req.params.restaurantId, limit)
    res.json({ success: true, orders })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/:restaurantId', verifyToken, requireRole('admin', 'chef', 'receptionist'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  try {
    const orders = await getRestaurantOrders(req.params.restaurantId)
    res.json({ success: true, orders })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PUT /api/orders/:restaurantId/:orderId — ADMIN + CHEF + RECEPTIONIST
router.put('/:restaurantId/:orderId', verifyToken, requireRole('admin', 'chef', 'receptionist'), requireRestaurantAccess, requireActiveSubscription, async (req, res) => {
  try {
    const { restaurantId, orderId } = req.params
    const order = await updateOrder(restaurantId, orderId, req.body)
    res.json({ success: true, order })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
