const express = require('express')
const router = express.Router()
const { createStaff, listStaff, toggleStaff } = require('../services/staffService')
const { verifyToken, requireRole } = require('../middleware/auth')
const { requireRestaurantAccess } = require('../middleware/restaurantAccess')

// POST /api/staff/:restaurantId — Add staff member
router.post('/:restaurantId', verifyToken, requireRole('admin'), requireRestaurantAccess, async (req, res) => {
  try {
    const { restaurantId } = req.params
    const { email, name, role } = req.body

    if (!email || !name || !role) {
      return res.status(400).json({ success: false, error: 'email, name, and role are required' })
    }

    const staff = await createStaff(restaurantId, { email, name, role })
    res.status(201).json({ success: true, staff })
  } catch (err) {
    const status = err.code === 'auth/email-already-exists' ? 409 : 500
    res.status(status).json({ success: false, error: err.message })
  }
})

// GET /api/staff/:restaurantId — List all staff
router.get('/:restaurantId', verifyToken, requireRole('admin'), requireRestaurantAccess, async (req, res) => {
  try {
    const staff = await listStaff(req.params.restaurantId)
    res.json({ success: true, staff })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PATCH /api/staff/:restaurantId/:uid/toggle — Activate/deactivate staff
router.patch('/:restaurantId/:uid/toggle', verifyToken, requireRole('admin'), requireRestaurantAccess, async (req, res) => {
  try {
    const { restaurantId, uid } = req.params
    const staff = await toggleStaff(restaurantId, uid)
    res.json({ success: true, staff })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
