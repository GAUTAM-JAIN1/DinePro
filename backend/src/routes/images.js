const express = require('express')
const router = express.Router()
const multer = require('multer')
const cloudinary = require('cloudinary').v2
const { verifyToken, requireRole, requirePlatformAdmin } = require('../middleware/auth')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'), false)
  },
})

// POST /api/images/upload — admin OR platform admin (superadmin)
router.post(
  '/upload',
  verifyToken,
  (req, res, next) => {
    // admin ya platformAdmin dono allow hain
    const isAdmin = req.user?.role === 'admin'
    const isPlatformAdmin =
      req.user?.platformAdmin === true ||
      req.user?.superAdmin === true ||
      req.user?.role === 'superadmin'
    if (isAdmin || isPlatformAdmin) return next()
    return res.status(403).json({ success: false, error: 'Insufficient permissions' })
  },
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

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `digital-menu/${restaurantId}`,
            resource_type: 'image',
            transformation: [
              { width: 800, height: 600, crop: 'limit' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        )
        stream.end(req.file.buffer)
      })

      res.json({ success: true, url: result.secure_url, publicId: result.public_id })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

module.exports = router