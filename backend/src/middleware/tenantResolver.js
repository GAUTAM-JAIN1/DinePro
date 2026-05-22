// This middleware extracts restaurantId from every request
// So we always know which restaurant the request belongs to

function tenantResolver(req, res, next) {
  const restaurantId =
    req.headers["x-restaurant-id"] || req.query.restaurantId;

  if (!restaurantId) {
    return res.status(400).json({
      error: "Restaurant ID is required",
    });
  }

  req.restaurantId = restaurantId;
  next();
}

module.exports = { tenantResolver };