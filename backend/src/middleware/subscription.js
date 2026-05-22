const { getRestaurant } = require('../services/restaurantService')

function restaurantIdFromRequest(req) {
  return req.params.restaurantId || req.body.restaurantId || req.query.restaurantId
}

async function requireActiveSubscription(req, res, next) {
  try {
    const restaurantId = restaurantIdFromRequest(req)

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'restaurantId is required',
      })
    }

    const restaurant = await getRestaurant(restaurantId)

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found',
      })
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
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

module.exports = { requireActiveSubscription }
