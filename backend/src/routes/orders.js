const express = require('express')
const router = express.Router()
const {
  upsertOrder,
  updateOrder,
  getRestaurantOrders,
  getOrderHistory,
  getDailyStats,
  resetDailyStats,
  getDailyReport,
} = require('../services/orderService')
const { actorFromUser } = require('../services/auditService')
const { verifyToken, requireRole } = require('../middleware/auth')
const { requireActiveSubscription } = require('../middleware/subscription')
const { requireRestaurantAccess } = require('../middleware/restaurantAccess')
const { orderRateLimit, orderIpRateLimit } = require('../middleware/rateLimit')
const { sendError } = require('../utils/httpErrors')
const { validate, orderCreate, orderStatusUpdate } = require('../middleware/validators')
const { broadcastNewOrder } = require('../socket/orderSocket')

// POST /api/orders — PUBLIC (customer places order)
router.post(
  '/',
  orderIpRateLimit,
  orderRateLimit,
  requireActiveSubscription,
  validate(orderCreate),
  async (req, res) => {
    try {
      const { restaurantId, tableId, items, specialInstructions, idempotencyKey } = req.body
      const { order, replayed } = await upsertOrder(restaurantId, {
        tableId, items, specialInstructions, idempotencyKey,
      })

      // A replayed request (client retry) was already announced the first
      // time, so don't announce it again.
      const io = req.app.get('io')
      if (io && !replayed) {
        broadcastNewOrder(io, order).catch((err) =>
          console.error('broadcastNewOrder failed:', err.message)
        )
      }

      res.json({ success: true, order, replayed })
    } catch (err) {
      sendError(res, err, { label: 'orders.create' })
    }
  }
)

// GET /api/orders/:restaurantId/stats — ADMIN + RECEPTIONIST
router.get(
  '/:restaurantId/stats',
  verifyToken, requireRole('admin', 'receptionist'), requireRestaurantAccess, requireActiveSubscription,
  async (req, res) => {
    try {
      const stats = await getDailyStats(req.params.restaurantId)
      res.json({ success: true, stats })
    } catch (err) {
      sendError(res, err, { label: 'orders' })
    }
  }
)

// POST /api/orders/:restaurantId/stats/reset — ADMIN + RECEPTIONIST
router.post(
  '/:restaurantId/stats/reset',
  verifyToken, requireRole('admin', 'receptionist'), requireRestaurantAccess, requireActiveSubscription,
  async (req, res) => {
    try {
      const result = await resetDailyStats(req.params.restaurantId, actorFromUser(req.user))
      res.json({ success: true, ...result })
    } catch (err) {
      sendError(res, err, { label: 'orders' })
    }
  }
)

// GET /api/orders/:restaurantId/daily-report — ADMIN + RECEPTIONIST
router.get(
  '/:restaurantId/daily-report',
  verifyToken, requireRole('admin', 'receptionist'), requireRestaurantAccess, requireActiveSubscription,
  async (req, res) => {
    try {
      const report = await getDailyReport(req.params.restaurantId)
      res.json({ success: true, report })
    } catch (err) {
      sendError(res, err, { label: 'orders' })
    }
  }
)

// GET /api/orders/:restaurantId/history
router.get(
  '/:restaurantId/history',
  verifyToken, requireRole('admin', 'receptionist'), requireRestaurantAccess, requireActiveSubscription,
  async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 100)
      const orders = await getOrderHistory(req.params.restaurantId, limit)
      res.json({ success: true, orders })
    } catch (err) {
      sendError(res, err, { label: 'orders' })
    }
  }
)

// GET /api/orders/:restaurantId
router.get(
  '/:restaurantId',
  verifyToken, requireRole('admin', 'chef', 'receptionist'), requireRestaurantAccess, requireActiveSubscription,
  async (req, res) => {
    try {
      const orders = await getRestaurantOrders(req.params.restaurantId)
      res.json({ success: true, orders })
    } catch (err) {
      sendError(res, err, { label: 'orders' })
    }
  }
)

// PUT /api/orders/:restaurantId/:orderId — kitchen status transitions only.
// Bug #10: this used to forward req.body straight into updateOrder with no
// validation at all, so a caller could set totalAmount, settledAmount,
// items, closedAt — any field on the order doc. orderStatusUpdate below
// whitelists this down to the one legitimate use (new -> preparing -> ready
// -> served); settlement, cancellation and item edits go through their own
// dedicated endpoints/sockets instead.
router.put(
  '/:restaurantId/:orderId',
  verifyToken, requireRole('admin', 'chef', 'receptionist'), requireRestaurantAccess, requireActiveSubscription,
  validate(orderStatusUpdate),
  async (req, res) => {
    try {
      const { restaurantId, orderId } = req.params
      const order = await updateOrder(restaurantId, orderId, req.body)
      res.json({ success: true, order })
    } catch (err) {
      sendError(res, err, { label: 'orders' })
    }
  }
)

module.exports = router