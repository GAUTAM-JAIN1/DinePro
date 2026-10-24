const { getRestaurant } = require('../services/restaurantService')
const { sendError } = require('../utils/httpErrors')
const { restaurantIdsFromRequest } = require('./restaurantAccess')

/**
 * Bug #37: attach to every mutation, not just some. Reads the restaurant id the
 * same way requireRestaurantAccess does, so the two always refer to the same restaurant.
 */
async function requireActiveSubscription(req, res, next) {
  try {
    const restaurantId = restaurantIdsFromRequest(req)[0]

    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'restaurantId is required' })
    }

    const restaurant = await getRestaurant(String(restaurantId))

    if (!restaurant) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' })
    }

    req.restaurant = restaurant

    if (!restaurant.subscription.isServiceEnabled) {
      return res.status(402).json({
        success: false,
        error: 'Subscription expired',
        subscription: restaurant.subscription,
      })
    }

    next()
  } catch (error) {
    sendError(res, error, { label: 'subscription check' })
  }
}

module.exports = { requireActiveSubscription }
