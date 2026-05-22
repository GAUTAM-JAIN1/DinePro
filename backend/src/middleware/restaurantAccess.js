function restaurantIdFromRequest(req) {
  return req.params.restaurantId || req.body.restaurantId || req.query.restaurantId
}

function isPlatformAdmin(user) {
  return user?.role === 'superadmin' || user?.platformAdmin === true || user?.superAdmin === true
}

function requireRestaurantAccess(req, res, next) {
  const restaurantId = restaurantIdFromRequest(req)

  if (!restaurantId || isPlatformAdmin(req.user)) {
    return next()
  }

  if (!req.user?.restaurantId) {
    return res.status(403).json({
      success: false,
      error: 'Restaurant access is not assigned to this user',
    })
  }

  if (String(req.user.restaurantId) !== String(restaurantId)) {
    return res.status(403).json({
      success: false,
      error: 'You do not have access to this restaurant',
    })
  }

  next()
}

module.exports = { requireRestaurantAccess }
