const express = require('express')
const router = express.Router()
const {
  createRestaurant,
  getRestaurant,
  listRestaurants,
  updateRestaurant,
  updateRestaurantSubscription,
  deleteRestaurant,
  createStaffAccount,
  listStaff,
  deleteStaffAccount,
} = require('../services/restaurantService')
const { verifyToken, requireRole, requirePlatformAdmin } = require('../middleware/auth')
const { requireRestaurantAccess } = require('../middleware/restaurantAccess')
const { validate, restaurantCreate, restaurantUpdate } = require('../middleware/validators')

// GET /api/restaurants — SuperAdmin only
router.get(
  '/',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  async (req, res) => {
    try {
      const restaurants = await listRestaurants()
      res.json({ success: true, restaurants })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

// GET /api/restaurants/:restaurantId — public (customer app ke liye)
router.get('/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params
    const restaurant = await getRestaurant(restaurantId)
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' })
    const { ownerEmail, subscription, ...publicData } = restaurant
    res.json({ success: true, restaurant: publicData })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Something went wrong' })
  }
})

// POST /api/restaurants — SuperAdmin only
router.post(
  '/',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  validate(restaurantCreate),
  async (req, res) => {
    try {
      const restaurant = await createRestaurant(req.body)
      res.json({ success: true, restaurant })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

// DELETE /api/restaurants/:restaurantId — SuperAdmin only
router.delete(
  '/:restaurantId',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  async (req, res) => {
    try {
      const { restaurantId } = req.params
      await deleteRestaurant(restaurantId)
      res.json({ success: true, message: 'Restaurant deleted' })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

// PATCH /api/restaurants/:restaurantId/subscription — SuperAdmin only
router.patch(
  '/:restaurantId/subscription',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  async (req, res) => {
    try {
      const { restaurantId } = req.params
      const { action, days } = req.body
      if (!action) return res.status(400).json({ success: false, error: 'action is required' })
      const restaurant = await updateRestaurantSubscription(restaurantId, action, { days })
      res.json({ success: true, restaurant })
    } catch (error) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// PUT /api/restaurants/:restaurantId — Restaurant admin only
router.put(
  '/:restaurantId',
  verifyToken, requireRole('admin'), requireRestaurantAccess,
  validate(restaurantUpdate),
  async (req, res) => {
    try {
      const { restaurantId } = req.params
      const restaurant = await updateRestaurant(restaurantId, req.body)
      res.json({ success: true, restaurant })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
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
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

// POST /api/restaurants/:restaurantId/staff — SuperAdmin only
router.post(
  '/:restaurantId/staff',
  verifyToken, requireRole('admin', 'superadmin'), requirePlatformAdmin,
  async (req, res) => {
    try {
      const { restaurantId } = req.params
      const { email, password, role } = req.body

      if (!email || !password || !role) {
        return res.status(400).json({ success: false, error: 'email, password, role required' })
      }
      if (!['chef', 'receptionist'].includes(role)) {
        return res.status(400).json({ success: false, error: 'role must be chef or receptionist' })
      }

      // Restaurant name fetch karo displayName ke liye
      const restaurant = await getRestaurant(restaurantId)
      if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' })

      const staff = await createStaffAccount(restaurantId, restaurant.name, { email, password, role })
      res.json({ success: true, staff })
    } catch (error) {
      // Firebase duplicate email error
      if (error.code === 'auth/email-already-exists') {
        return res.status(400).json({ success: false, error: 'Email already in use' })
      }
      res.status(500).json({ success: false, error: error.message })
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
      res.json({ success: true, message: 'Staff deleted' })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

module.exports = router