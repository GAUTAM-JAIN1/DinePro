const express = require("express");
const router = express.Router();
const {
  addMenuItemsIfMissing,
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
const { sendError } = require("../utils/httpErrors");
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
    sendError(res, error, { label: 'menu' });
  }
});

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
      sendError(res, error, { label: 'menu' });
    }
  }
);

// POST /api/menu/:restaurantId/bulk — ADMIN ONLY. Setup wizard: adds dishes that aren't on the menu yet (Bug #55).
// Returns per-row feedback instead of failing the whole batch (Bug #56): created, skipped (already there), errors (invalid rows).
router.post(
  "/:restaurantId/bulk",
  verifyToken, requireRole("admin"), requireRestaurantAccess, requireActiveSubscription,
  async (req, res) => {
    const rows = Array.isArray(req.body?.items) ? req.body.items : null
    if (!rows || rows.length === 0 || rows.length > 50) {
      return res.status(400).json({ success: false, error: "items must be a list of 1 to 50 dishes" })
    }
    try {
      const valid = []
      const errors = []
      rows.forEach((raw, index) => {
        const result = menuItemCreate.safeParse(raw)
        if (result.success) {
          valid.push({ index, data: result.data })
        } else {
          errors.push({
            index,
            name: raw?.name ?? null,
            reason: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
          })
        }
      })
      const { created, skipped } = await addMenuItemsIfMissing(req.params.restaurantId, valid)
      res.json({ success: true, created, skipped, errors })
    } catch (err) {
      sendError(res, err, { label: "menu.bulk" })
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
      sendError(res, error, { label: 'menu' });
    }
  }
);

// PATCH /api/menu/:restaurantId/:itemId/toggle — quick sold-out toggle
router.patch(
  "/:restaurantId/:itemId/toggle",
  verifyToken, requireRole("admin"), requireRestaurantAccess, requireActiveSubscription,
  async (req, res) => {
    try {
      const { restaurantId, itemId } = req.params;
      const item = await toggleItemAvailability(restaurantId, itemId);
      res.json({ success: true, item });
    } catch (error) {
      sendError(res, error, { label: 'menu' });
    }
  }
);

// POST /api/menu/:restaurantId/reorder — drag reorder
router.post(
  "/:restaurantId/reorder",
  verifyToken, requireRole("admin"), requireRestaurantAccess, requireActiveSubscription,
  validate(menuReorder),
  async (req, res) => {
    try {
      const { restaurantId } = req.params;
      await reorderMenuItems(restaurantId, req.body.items);
      res.json({ success: true });
    } catch (error) {
      sendError(res, error, { label: 'menu' });
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
      sendError(res, error, { label: 'menu' });
    }
  }
);

module.exports = router;