const express = require("express");
const router = express.Router();
const {
  createRestaurant,
  getRestaurant,
  listRestaurants,
  updateRestaurant,
  updateRestaurantSubscription,
} = require("../services/restaurantService");
const { verifyToken, requireRole, requirePlatformAdmin } = require("../middleware/auth");
const { requireRestaurantAccess } = require("../middleware/restaurantAccess");

// GET /api/restaurants/:restaurantId — PUBLIC (customer app needs branding)
router.get("/", verifyToken, requireRole("admin", "superadmin"), requirePlatformAdmin, async (req, res) => {
  try {
    const restaurants = await listRestaurants();
    res.json({ success: true, restaurants });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const restaurant = await getRestaurant(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ success: false, error: "Restaurant not found" });
    }

    res.json({ success: true, restaurant });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/restaurants — ADMIN ONLY
router.post("/", verifyToken, requireRole("admin", "superadmin"), requirePlatformAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: "name is required" });
    }

    const restaurant = await createRestaurant(req.body);

    res.json({ success: true, restaurant });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/restaurants/:restaurantId — ADMIN ONLY
router.patch("/:restaurantId/subscription", verifyToken, requireRole("admin", "superadmin"), requirePlatformAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { action, days } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, error: "action is required" });
    }

    const restaurant = await updateRestaurantSubscription(restaurantId, action, { days });
    res.json({ success: true, restaurant });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put("/:restaurantId", verifyToken, requireRole("admin"), requireRestaurantAccess, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const restaurant = await updateRestaurant(restaurantId, req.body);

    res.json({ success: true, restaurant });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
