const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = require('express-rate-limit')

/**
 * Bug #22: a customer's order limit used to be counted per IP. Every phone on
 * the same restaurant wifi shares one public IP, so ten orders a minute were
 * shared by the whole dining room.
 *
 * The order limit is now keyed by the table (restaurant + table), which is what
 * a single customer group actually is. The IP is only the fallback when a
 * request has no table. A separate, looser per-IP ceiling below still stops
 * one client from flooding many tables at once.
 */
function tableKey(req) {
  const restaurantId = req.body?.restaurantId
  const tableId = req.body?.tableId
  if (typeof restaurantId === 'string' && typeof tableId === 'string' && restaurantId && tableId) {
    return `table:${restaurantId}:${tableId}`
  }
  return `ip:${ipKeyGenerator(req.ip || '')}`
}

// Order placement: 10 per minute per table
const orderRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: tableKey,
  message: { success: false, error: 'Too many orders. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Order placement ceiling: 60 per minute per IP, across all tables
const orderIpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip || '')}`,
  message: { success: false, error: 'Too many orders from this network. Please wait a moment.' },
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

module.exports = { orderRateLimit, orderIpRateLimit, uploadRateLimit, generalRateLimit, tableKey }
