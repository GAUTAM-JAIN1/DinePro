// Every place a restaurantId can arrive. The route param, body and query must
// all agree when present.
function restaurantIdsFromRequest(req) {
  return [req.params?.restaurantId, req.body?.restaurantId, req.query?.restaurantId].filter(
    (value) => value !== undefined && value !== null && value !== ''
  )
}

function isPlatformAdmin(user) {
  return user?.role === 'superadmin' || user?.platformAdmin === true || user?.superAdmin === true
}

/**
 * Bug #18: this used to call next() when no restaurantId was present at all,
 * so a route that forgot to scope itself was open to any signed-in staff member.
 *
 * Now: a request must name exactly one restaurant (params, body and query agree),
 * and that restaurant must be the caller's own. Platform admins may act on any
 * restaurant, but they still have to name one.
 */
function requireRestaurantAccess(req, res, next) {
  const ids = restaurantIdsFromRequest(req).map(String)

  if (ids.length === 0) {
    return res.status(403).json({ success: false, error: 'restaurantId is required' })
  }

  if (ids.some((id) => id !== ids[0])) {
    return res.status(403).json({ success: false, error: 'restaurantId does not match across the request' })
  }

  const restaurantId = ids[0]

  if (isPlatformAdmin(req.user)) {
    return next()
  }

  if (!req.user?.restaurantId) {
    return res.status(403).json({ success: false, error: 'Restaurant access is not assigned to this user' })
  }

  if (String(req.user.restaurantId) !== restaurantId) {
    return res.status(403).json({ success: false, error: 'You do not have access to this restaurant' })
  }

  next()
}

module.exports = { requireRestaurantAccess, restaurantIdsFromRequest }
