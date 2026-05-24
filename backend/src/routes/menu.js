const express = require("express");
const router = express.Router();
const {
  addMenuItem,
  deleteMenuItem,
  getRestaurantMenu,
  updateMenuItem,
  toggleItemAvailability,
  reorderMenuItems,
} = require("../services/menuService");
const { verifyToken, requireRole } = require("../middleware/auth");
const { requireActiveSubscription } = require("../middleware/subscription");
const { requireRestaurantAccess } = require("../middleware/restaurantAccess");
const { validate, menuItemCreate, menuItemUpdate, menuReorder } = require("../middleware/validators");

// GET /api/menu/:restaurantId — PUBLIC
router.get("/:restaurantId", requireActiveSubscription, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const menu = await getRestaurantMenu(restaurantId, {
      availableOnly: req.query.availableOnly === "true",
    });
    res.json({ success: true, restaurantId, menu });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/menu — ADMIN ONLY
router.post(
  "/",
  verifyToken, requireRole("admin"), requireRestaurantAccess, requireActiveSubscription,
  validate(menuItemCreate),
  async (req, res) => {
    try {
      const { restaurantId, ...itemData } = req.body;
      if (!restaurantId) {
        return res.status(400).json({ error: "restaurantId is required" });
      }
      const item = await addMenuItem(restaurantId, itemData);
      res.json({ success: true, item });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/menu/:restaurantId — ADMIN ONLY
router.post(
  "/:restaurantId",
  verifyToken, requireRole("admin"), requireRestaurantAccess, requireActiveSubscription,
  validate(menuItemCreate),
  async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const item = await addMenuItem(restaurantId, req.body);
      res.json({ success: true, item });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// PUT /api/menu/:restaurantId/:itemId — ADMIN ONLY
router.put(
  "/:restaurantId/:itemId",
  verifyToken, requireRole("admin"), requireRestaurantAccess, requireActiveSubscription,
  validate(menuItemUpdate),
  async (req, res) => {
    try {
      const { restaurantId, itemId } = req.params;
      const item = await updateMenuItem(restaurantId, itemId, req.body);
      res.json({ success: true, item });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/menu/:restaurantId/:itemId/toggle — quick sold-out toggle
router.patch(
  "/:restaurantId/:itemId/toggle",
  verifyToken, requireRole("admin"), requireRestaurantAccess,
  async (req, res) => {
    try {
      const { restaurantId, itemId } = req.params;
      const item = await toggleItemAvailability(restaurantId, itemId);
      res.json({ success: true, item });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/menu/:restaurantId/reorder — drag reorder
router.post(
  "/:restaurantId/reorder",
  verifyToken, requireRole("admin"), requireRestaurantAccess,
  validate(menuReorder),
  async (req, res) => {
    try {
      const { restaurantId } = req.params;
      await reorderMenuItems(restaurantId, req.body.items);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/menu/:restaurantId/:itemId — ADMIN ONLY
router.delete(
  "/:restaurantId/:itemId",
  verifyToken, requireRole("admin"), requireRestaurantAccess, requireActiveSubscription,
  async (req, res) => {
    try {
      const { restaurantId, itemId } = req.params;
      await deleteMenuItem(restaurantId, itemId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;