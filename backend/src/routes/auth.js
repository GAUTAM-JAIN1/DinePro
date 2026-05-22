const express = require('express')
const router = express.Router()
const { verifyToken } = require('../middleware/auth')

// POST /api/auth/me — Get current user's role and info
// Frontend calls this after login to confirm role
router.get('/me', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role || null,
      restaurantId: req.user.restaurantId || null,
    }
  })
})

module.exports = router
