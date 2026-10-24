const express = require('express')
const router = express.Router()
const { createStaff, createSetupLink, listStaff, toggleStaff } = require('../services/staffService')
const { verifyToken, requireRole } = require('../middleware/auth')
const { requireRestaurantAccess } = require('../middleware/restaurantAccess')
const { requireActiveSubscription } = require('../middleware/subscription')
const { validate, staffCreate } = require('../middleware/validators')
const { actorFromUser, writeAudit } = require('../services/auditService')
const { sendError } = require('../utils/httpErrors')

// Every route here is restaurant-admin only and scoped to the caller's own restaurant.
const adminOnly = [verifyToken, requireRole('admin'), requireRestaurantAccess]

// POST /api/staff/:restaurantId — Add staff member (returns a one-time setupLink, never a password)
router.post(
  '/:restaurantId',
  ...adminOnly, requireActiveSubscription,
  validate(staffCreate),
  async (req, res) => {
    try {
      const { restaurantId } = req.params
      const staff = await createStaff(restaurantId, req.body, { restaurantName: req.restaurant?.name })
      await writeAudit(restaurantId, {
        actor: actorFromUser(req.user),
        action: 'staff.create',
        after: { uid: staff.uid, email: staff.email, role: staff.role },
      })
      res.status(201).json({ success: true, staff })
    } catch (err) {
      sendError(res, err, { label: 'staff.create' })
    }
  }
)

// GET /api/staff/:restaurantId — List all staff
router.get('/:restaurantId', ...adminOnly, async (req, res) => {
  try {
    const staff = await listStaff(req.params.restaurantId)
    res.json({ success: true, staff })
  } catch (err) {
    sendError(res, err, { label: 'staff.list' })
  }
})

// POST /api/staff/:restaurantId/:uid/setup-link — New setup link for an existing staff member
router.post(
  '/:restaurantId/:uid/setup-link',
  ...adminOnly, requireActiveSubscription,
  async (req, res) => {
    try {
      const { restaurantId, uid } = req.params
      const result = await createSetupLink(restaurantId, uid)
      await writeAudit(restaurantId, {
        actor: actorFromUser(req.user),
        action: 'staff.setup_link',
        meta: { uid },
      })
      res.json({ success: true, ...result })
    } catch (err) {
      sendError(res, err, { label: 'staff.setup-link' })
    }
  }
)

// PATCH /api/staff/:restaurantId/:uid/toggle — Activate/deactivate staff
router.patch(
  '/:restaurantId/:uid/toggle',
  ...adminOnly, requireActiveSubscription,
  async (req, res) => {
    try {
      const { restaurantId, uid } = req.params
      const staff = await toggleStaff(restaurantId, uid, { actorUid: req.user.uid })
      await writeAudit(restaurantId, {
        actor: actorFromUser(req.user),
        action: 'staff.toggle',
        after: { uid, isActive: staff.isActive },
      })
      res.json({ success: true, staff })
    } catch (err) {
      sendError(res, err, { label: 'staff.toggle' })
    }
  }
)

module.exports = router
