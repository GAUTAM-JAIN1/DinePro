const express = require('express')
const router = express.Router()
const {
  createRestaurant,
  getRestaurant,
  listRestaurants,
  updateRestaurant,
  updateRestaurantSubscription,
  archiveRestaurant,
  deleteRestaurant,
  getSubscriptionSummary,
  listStaff,
  deleteStaffAccount,
} = require('../services/restaurantService')
const { createStaff } = require('../services/staffService')
const { verifyToken, requireRole, requirePlatformAdmin } = require('../middleware/auth')
const { requireRestaurantAccess } = require('../middleware/restaurantAccess')
const { requireActiveSubscription } = require('../middleware/subscription')
const {
  validate,
  restaurantCreate,
  restaurantUpdate,
  subscriptionUpdate,
  platformStaffCreate,
} = require('../middleware/validators')
const { actorFromUser, writeAudit } = require('../services/auditService')
const { sendError, publicMessage } = require('../utils/httpErrors')

// What a customer's browser may see about a restaurant. Billing, owner and audit
// fields are never public, so a whitelist is safer than removing known keys.
const PUBLIC_RESTAURANT_FIELDS = [
  'id', 'name', 'address', 'phone', 'logoUrl', 'brandColor', 'timezone',
  'defaultGstPercent', 'defaultServiceCharge', 'onboardingCompleted',
]
const publicRestaurant = (restaurant) =>
  Object.fromEntries(PUBLIC_RESTAURANT_FIELDS.filter((key) => key in restaurant).map((key) => [key, restaurant[key]]))

// GET /api/restaurants — SuperAdmin only
router.get(
  '/',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  async (req, res) => {
    try {
      const restaurants = await listRestaurants({ includeArchived: req.query.includeArchived === 'true' })
      res.json({ success: true, restaurants })
    } catch (error) {
      sendError(res, error, { label: 'restaurants.list' })
    }
  }
)

// GET /api/restaurants/:restaurantId — public (customer app ke liye)
router.get('/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params
    const restaurant = await getRestaurant(restaurantId)
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' })
    res.json({ success: true, restaurant: publicRestaurant(restaurant) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Something went wrong' })
  }
})

// POST /api/restaurants — SuperAdmin only.
// Bug #54: when an owner email is given, the owner gets an admin account and a
// setup link in the same step. Before, the owner email was only stored, so the
// owner could never sign in. If the owner account fails, the restaurant is still
// created and the error is reported in `ownerError`, so nothing is lost.
router.post(
  '/',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  validate(restaurantCreate),
  async (req, res) => {
    try {
      const restaurant = await createRestaurant(req.body)
      const actor = actorFromUser(req.user)
      let owner = null
      let ownerError = null

      if (req.body.ownerEmail) {
        try {
          owner = await createStaff(
            restaurant.id,
            { email: req.body.ownerEmail, name: `Owner - ${restaurant.name}`, role: 'admin' },
            { restaurantName: restaurant.name }
          )
          await writeAudit(restaurant.id, {
            actor,
            action: 'staff.create',
            after: { uid: owner.uid, email: owner.email, role: owner.role },
            meta: { source: 'restaurant.create' },
          })
        } catch (err) {
          ownerError = publicMessage(err)
        }
      }

      res.json({ success: true, restaurant, owner, ownerError })
    } catch (error) {
      sendError(res, error, { label: 'restaurants.create' })
    }
  }
)

// GET /api/restaurants/:restaurantId/subscription — restaurant admin (and platform admin).
// Bug #64: the dashboard reads status and days left from here, since the public
// restaurant document never carries subscription data.
router.get(
  '/:restaurantId/subscription',
  verifyToken, requireRole('admin', 'superadmin'), requireRestaurantAccess,
  async (req, res) => {
    try {
      const subscription = await getSubscriptionSummary(req.params.restaurantId)
      res.json({ success: true, subscription })
    } catch (error) {
      sendError(res, error, { label: 'restaurants.subscription.summary' })
    }
  }
)

// DELETE /api/restaurants/:restaurantId — SuperAdmin only.
// Default: archive (suspend, keep all history). Permanent delete needs
// ?permanent=true, an archived restaurant, and the restaurant id repeated in the body as `confirm`.
router.delete(
  '/:restaurantId',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  async (req, res) => {
    try {
      const { restaurantId } = req.params
      const actor = actorFromUser(req.user)

      if (req.query.permanent === 'true') {
        if (req.body?.confirm !== restaurantId) {
          return res.status(400).json({ success: false, error: 'Send the restaurant id as confirm to delete permanently', code: 'CONFIRM_REQUIRED' })
        }
        await deleteRestaurant(restaurantId)
        console.log(`Restaurant ${restaurantId} permanently deleted by ${actor.email || actor.uid}`)
        return res.json({ success: true, message: 'Restaurant permanently deleted' })
      }

      const restaurant = await archiveRestaurant(restaurantId, actor)
      res.json({ success: true, restaurant, message: 'Restaurant archived' })
    } catch (error) {
      sendError(res, error, { label: 'restaurants.delete' })
    }
  }
)

// PATCH /api/restaurants/:restaurantId/subscription — SuperAdmin only
// Bug #69: markPaid and reactivate must carry a payment record; the response
// returns its id so the receipt can be traced.
router.patch(
  '/:restaurantId/subscription',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  validate(subscriptionUpdate),
  async (req, res) => {
    try {
      const { restaurantId } = req.params
      const { action, days, payment } = req.body
      const result = await updateRestaurantSubscription(restaurantId, action, {
        days,
        payment,
        actor: actorFromUser(req.user),
      })
      res.json({ success: true, restaurant: result.restaurant, paymentId: result.paymentId })
    } catch (error) {
      sendError(res, error, { label: 'restaurants.subscription' })
    }
  }
)

// PUT /api/restaurants/:restaurantId — Restaurant admin only (Bug #37: subscription checked on every mutation)
router.put(
  '/:restaurantId',
  verifyToken, requireRole('admin'), requireRestaurantAccess, requireActiveSubscription,
  validate(restaurantUpdate),
  async (req, res) => {
    try {
      const { restaurantId } = req.params
      const restaurant = await updateRestaurant(restaurantId, req.body, actorFromUser(req.user))
      res.json({ success: true, restaurant })
    } catch (error) {
      sendError(res, error, { label: 'restaurants.update' })
    }
  }
)

// GET /api/restaurants/:restaurantId/staff — SuperAdmin only
router.get(
  '/:restaurantId/staff',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  async (req, res) => {
    try {
      const staff = await listStaff(req.params.restaurantId)
      res.json({ success: true, staff })
    } catch (error) {
      sendError(res, error, { label: 'restaurants.staff.list' })
    }
  }
)

// POST /api/restaurants/:restaurantId/staff — SuperAdmin only.
// Bug #26: uses the same createStaff as the restaurant admin route. The client
// no longer chooses a password (Bug #25); the response carries a setup link.
router.post(
  '/:restaurantId/staff',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  validate(platformStaffCreate),
  async (req, res) => {
    try {
      const { restaurantId } = req.params
      const restaurant = await getRestaurant(restaurantId)
      if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' })

      const staff = await createStaff(restaurantId, req.body, { restaurantName: restaurant.name })
      await writeAudit(restaurantId, {
        actor: actorFromUser(req.user),
        action: 'staff.create',
        after: { uid: staff.uid, email: staff.email, role: staff.role },
      })
      res.status(201).json({ success: true, staff })
    } catch (error) {
      sendError(res, error, { label: 'restaurants.staff.create' })
    }
  }
)

// DELETE /api/restaurants/:restaurantId/staff/:uid — SuperAdmin only
router.delete(
  '/:restaurantId/staff/:uid',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  async (req, res) => {
    try {
      const { restaurantId, uid } = req.params
      await deleteStaffAccount(restaurantId, uid)
      await writeAudit(restaurantId, {
        actor: actorFromUser(req.user),
        action: 'staff.delete',
        before: { uid },
      })
      res.json({ success: true, message: 'Staff deleted' })
    } catch (error) {
      sendError(res, error, { label: 'restaurants.staff.delete' })
    }
  }
)

module.exports = router
