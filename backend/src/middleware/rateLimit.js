const rateLimit = require('express-rate-limit')

// Order placement: 10 per minute per IP
const orderRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many orders. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Image upload: 20 per hour per IP
const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Upload limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// General API: 100 per minute per IP
const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = { orderRateLimit, uploadRateLimit, generalRateLimit }
