const express = require('express')
const router = express.Router()
const multer = require('multer')
const { admin } = require('../services/firebaseAdmin')
const { verifyToken, requireRole } = require('../middleware/auth')
const { requireRestaurantAccess } = require('../middleware/restaurantAccess')

// Multer: memory storage, max 5MB, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'), false)
    }
  },
})

// POST /api/images/upload — Upload image to Firebase Storage
router.post(
  '/upload',
  verifyToken,
  requireRole('admin'),
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file provided' })
      }

      const restaurantId = req.body.restaurantId || req.user.restaurantId
      if (!restaurantId) {
        return res.status(400).json({ success: false, error: 'restaurantId is required' })
      }

      const bucket = admin.storage().bucket()
      const timestamp = Date.now()
      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `restaurants/${restaurantId}/images/${timestamp}_${safeName}`
      const file = bucket.file(filePath)

      await file.save(req.file.buffer, {
        metadata: {
          contentType: req.file.mimetype,
          metadata: {
            uploadedBy: req.user.uid,
            restaurantId,
          },
        },
      })

      // Make the file publicly accessible
      await file.makePublic()

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`

      res.json({
        success: true,
        url: publicUrl,
        filePath,
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

module.exports = router
