const express = require('express')
const router = express.Router()
const { sendError } = require('../utils/httpErrors')
const multer = require('multer')
const cloudinary = require('cloudinary').v2
const { verifyToken, requireRole, requirePlatformAdmin } = require('../middleware/auth')
const { uploadRateLimit } = require('../middleware/rateLimit')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Bug #16: mimetype alone is a client-supplied header, trivially spoofed
    // (e.g. a .svg or .html file renamed with Content-Type: image/jpeg).
    // SVG is rejected outright even if real — it can carry <script>, and
    // Cloudinary serves uploads back from our own domains. Everything else
    // is re-checked against real magic bytes once the buffer is in hand
    // (see magicBytesOk below) before it ever reaches Cloudinary.
    if (file.mimetype === 'image/svg+xml') {
      return cb(new Error('SVG uploads are not allowed'), false)
    }
    if (file.mimetype.startsWith('image/')) return cb(null, true)
    cb(new Error('Only image files are allowed'), false)
  },
})

// Real file-signature check — the first bytes of the file can't be spoofed
// by a Content-Type header the way mimetype can.
function magicBytesOk(buffer) {
  if (!buffer || buffer.length < 12) return false
  const hex = buffer.subarray(0, 12).toString('hex')
  if (hex.startsWith('ffd8ff')) return true // JPEG
  if (hex.startsWith('89504e470d0a1a0a')) return true // PNG
  if (hex.startsWith('47494638')) return true // GIF87a/GIF89a
  if (hex.startsWith('52494646') && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return true // RIFF....WEBP
  return false
}

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
  uploadRateLimit,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file provided' })
      }

      if (!magicBytesOk(req.file.buffer)) {
        return res.status(400).json({ success: false, error: 'File does not look like a valid image' })
      }

      // Bug #16: this used to trust req.body.restaurantId, so any admin
      // could upload into — and overwrite images in — ANY other
      // restaurant's Cloudinary folder just by changing a form field. A
      // platform admin isn't tied to one restaurant and may legitimately
      // pass restaurantId explicitly; every other caller is locked to their
      // own tenant from the verified token, full stop.
      const isPlatformAdmin =
        req.user?.platformAdmin === true ||
        req.user?.superAdmin === true ||
        req.user?.role === 'superadmin'
      const restaurantId = isPlatformAdmin
        ? (req.body.restaurantId || req.user.restaurantId)
        : req.user.restaurantId
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
      sendError(res, err, { label: 'images.upload' })
    }
  }
)

module.exports = router