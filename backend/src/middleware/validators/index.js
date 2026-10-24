const { z } = require('zod')
const { HttpError, PAYMENT_MODES, IDEMPOTENCY_KEY_PATTERN } = require('../../services/billing')
const { isAllowedImageUrl } = require('../../utils/imageUrl')
const { isValidTimezone } = require('../../services/dayKey')

/**
 * Express middleware factory: validates req.body against a Zod schema.
 * Usage: router.post('/path', validate(mySchema), handler)
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Zod v4 exposes the list as `issues` (v3 used `errors`).
        const issues = err.issues || err.errors || []
        const messages = issues.length
          ? issues.map((e) => `${e.path.join('.')}: ${e.message}`)
          : ['Validation failed']
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: messages,
        })
      }
      next(err)
    }
  }
}

// Shared bounds. Keep these in step with the frontend inputs.
const MAX_PRICE_RUPEES = 100000
const MAX_QUANTITY = 50
const MAX_SORT_ORDER = 100000

// ───────────────────────────── Primitives ─────────────────────────────

const coerceNumber = z
  .union([z.number(), z.string().transform(Number)])
  .refine((n) => Number.isFinite(n), 'Must be a finite number')
const coercePositive = coerceNumber.refine((n) => n > 0, 'Must be positive')
const coerceNonNeg = coerceNumber.refine((n) => n >= 0, 'Must be >= 0')

// Bug #19: "Infinity" and absurdly large amounts used to pass coerceNumber.
const coercePrice = coercePositive.refine(
  (n) => n <= MAX_PRICE_RUPEES,
  `Price must be at most ${MAX_PRICE_RUPEES}`
)

// Bug #61: only https links to our image host.
const httpsImageUrl = z
  .string()
  .max(500)
  .refine(isAllowedImageUrl, 'imageUrl must be an https link to an allowed image host')

const docId = z.string().min(1).max(128).regex(/^[^/]+$/, 'Invalid id')

// ───────────────────────────── Menu Schemas ─────────────────────────────

const variantSchema = z.object({
  name: z.string().min(1).max(60),
  nameHindi: z.string().max(60).optional().default(''),
  price: coercePrice,
})

const menuItemCreate = z.object({
  name: z.string().trim().min(1, 'name is required').max(120),
  nameHindi: z.string().max(120).optional().default(''),
  description: z.string().max(1000).optional().default(''),
  descriptionHindi: z.string().max(1000).optional().default(''),
  price: coercePrice,
  category: z.string().min(1).max(60).default('Mains'),
  categoryHindi: z.string().max(60).optional().default(''),
  subcategory: z.string().max(60).optional().default(''),
  subcategoryHindi: z.string().max(60).optional().default(''),
  imageUrl: httpsImageUrl.optional().default(''),
  isVeg: z.boolean().optional().default(true),
  isAvailable: z.boolean().optional().default(true),
  isBestseller: z.boolean().optional().default(false),
  hasVariants: z.boolean().optional().default(false),
  variants: z.array(variantSchema).max(20).optional().default([]),
  sortOrder: coerceNonNeg.refine((n) => n <= MAX_SORT_ORDER, 'sortOrder is too large').optional().default(0),
  restaurantId: z.string().max(128).optional(),
})

// Bug #13: an update must not invent values for fields the client didn't send.
// The create schema has defaults (and would overwrite subcategory, isBestseller,
// sortOrder on every edit). The update schema has none, and unknown keys are stripped.
const menuItemUpdate = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  nameHindi: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  descriptionHindi: z.string().max(1000).optional(),
  price: coercePrice.optional(),
  category: z.string().min(1).max(60).optional(),
  categoryHindi: z.string().max(60).optional(),
  subcategory: z.string().max(60).optional(),
  subcategoryHindi: z.string().max(60).optional(),
  imageUrl: httpsImageUrl.optional(),
  isVeg: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  hasVariants: z.boolean().optional(),
  variants: z.array(variantSchema).max(20).optional(),
  sortOrder: coerceNonNeg.refine((n) => n <= MAX_SORT_ORDER, 'sortOrder is too large').optional(),
})

const menuReorder = z.object({
  items: z.array(
    z.object({
      id: docId,
      sortOrder: z.number().finite(),
    })
  ).min(1).max(500),
})

// ───────────────────────────── Order Schemas ─────────────────────────────

// Bug #1: the client only says WHAT it wants (menu id, variant, quantity,
// note). Name, price and availability are read from the menu on the server,
// so the schema deliberately has no price, name or tableNumber fields. Zod
// strips anything extra.
const orderItemSchema = z.object({
  id: docId,
  quantity: z
    .union([z.number(), z.string().transform(Number)])
    .refine(
      (n) => Number.isInteger(n) && n > 0 && n <= MAX_QUANTITY,
      `Quantity must be a whole number from 1 to ${MAX_QUANTITY}`
    ),
  variant: z.string().max(100).nullable().optional().default(null),
  specialInstructions: z.string().max(160).optional().default(''),
})

const orderCreate = z.object({
  restaurantId: z.string().min(1, 'restaurantId is required').max(128),
  tableId: docId,
  items: z.array(orderItemSchema).min(1, 'At least one item is required').max(50),
  specialInstructions: z.string().max(240).optional().default(''),
  // Bug #51 / #38: one key per submission attempt. A retry with the same key
  // returns the order that already exists instead of creating a second one.
  idempotencyKey: z.string().regex(IDEMPOTENCY_KEY_PATTERN, 'idempotencyKey must be 8-64 letters, digits, - or _'),
})

// Socket payloads go through the same schemas, so a bad payload gets a clear
// `<event>_error` back instead of being trusted.
const socketId = z.string().min(1).max(128)

const billSettlementInput = z.object({
  paymentMode: z.enum(PAYMENT_MODES).optional().default('cash'),
  discountAmount: coerceNonNeg.optional().default(0),
  paymentReference: z.string().max(100).optional().default(''),
  notes: z.string().max(240).optional().default(''),
  expectedPayableAmount: coerceNonNeg,
})

const closeBillEvent = z.object({
  restaurantId: socketId,
  orderIds: z.array(docId).min(1, 'orderIds is required').max(100),
  settlement: billSettlementInput,
})

const cancelOrderEvent = z.object({
  restaurantId: socketId,
  orderId: docId,
  reason: z.string().max(200).optional().default(''),
})

// order_preparing / order_ready: the payload carries the whole order for the
// screen's convenience; only these two fields are used.
const orderIdEvent = z.object({
  restaurantId: socketId,
  id: docId,
})

// Bug #20: kitchen item status used to accept any string.
const itemStatusEvent = z.object({
  restaurantId: socketId,
  orderId: docId,
  itemKey: z.string().min(1).max(128),
  status: z.enum(['preparing', 'ready', 'served']),
})

const chefMessageEvent = z.object({
  restaurantId: socketId,
  orderId: docId.optional(),
  tableId: z.string().max(128).optional(),
  tableNumber: z.union([z.string().max(20), z.number()]).transform(String).optional(),
  message: z.string().trim().min(1, 'message is required').max(240),
})

const subscriptionUpdate = z.object({
  action: z.enum(['markPaid', 'extendTrial', 'suspend', 'reactivate']),
  days: z.union([z.number(), z.string()]).optional(),
  payment: z.object({
    amount: z.union([z.number(), z.string()]),
    method: z.enum(PAYMENT_MODES),
    reference: z.string().max(100).optional().default(''),
  }).optional(),
})

/** Parses a socket payload or throws an HttpError the socket layer reports back. */
function parseOrThrow(schema, data) {
  const result = schema.safeParse(data ?? {})
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    throw new HttpError(400, `Validation failed: ${details.join('; ')}`, { code: 'VALIDATION_FAILED', details })
  }
  return result.data
}

// ───────────────────────────── Staff Schemas ─────────────────────────────

const STAFF_ROLES = ['admin', 'chef', 'receptionist']

// Restaurant admin adds staff. No password field exists: the account gets a
// setup link instead (Bug #25). Zod strips any password a client still sends.
const staffCreate = z.object({
  email: z.string().trim().email('Valid email is required').max(254),
  name: z.string().trim().min(1, 'name is required').max(100),
  role: z.enum(STAFF_ROLES, {
    errorMap: () => ({ message: 'role must be admin, chef, or receptionist' }),
  }),
})

// Platform admin adds the first owner or staff member for a restaurant.
// `name` is optional and defaults on the server.
const platformStaffCreate = z.object({
  email: z.string().trim().email('Valid email is required').max(254),
  name: z.string().trim().max(100).optional().default(''),
  role: z.enum(STAFF_ROLES, {
    errorMap: () => ({ message: 'role must be admin, chef, or receptionist' }),
  }),
})

// ───────────────────────────── Restaurant Schemas ─────────────────────────────

const restaurantCreate = z.object({
  name: z.string().trim().min(1, 'Restaurant name is required').max(120),
  ownerEmail: z.string().trim().email().max(254).optional(),
  address: z.string().max(300).optional().default(''),
  phone: z.string().max(30).optional().default(''),
  brandColor: z.string().max(20).optional().default('#B88746'),
})

// Bug #3: this used to be .passthrough(), so any client could send
// subscriptionStatus / currentPeriodEnd / planAmount / etc. alongside a
// normal settings update and self-grant a paid subscription. Subscription
// fields are server-owned (see subscriptionService) and must never be
// settable through this endpoint — the schema below is a closed whitelist.
const restaurantUpdate = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(30).optional(),
  brandColor: z.string().max(20).optional(),
  timezone: z.string().refine(isValidTimezone, 'timezone must be a valid IANA zone, e.g. Asia/Kolkata').optional(),
  logoUrl: httpsImageUrl.optional(),
  defaultGstPercent: z.number().min(0).max(100).optional(),
  defaultServiceCharge: z.number().min(0).max(MAX_PRICE_RUPEES).optional(),
  onboardingCompleted: z.boolean().optional(),
  onboardingCompletedAt: z.string().max(40).optional(),
}).strict()

// Bug #10: PUT /api/orders/:restaurantId/:orderId used to pass req.body
// straight through to updateOrder with no validation, so a caller could set
// totalAmount, settledAmount, items, closedAt — anything — directly. This
// endpoint is now restricted to the one thing it legitimately does: moving
// an order through the kitchen status lifecycle. Settlement, cancellation
// and item edits all go through their own dedicated, server-authoritative
// paths (closeBill, cancelOrder, upsertOrder).
const orderStatusUpdate = z.object({
  status: z.enum(['preparing', 'ready', 'served']),
}).strict()

module.exports = {
  validate,
  parseOrThrow,
  menuItemCreate,
  menuItemUpdate,
  menuReorder,
  orderCreate,
  orderStatusUpdate,
  closeBillEvent,
  cancelOrderEvent,
  orderIdEvent,
  itemStatusEvent,
  chefMessageEvent,
  subscriptionUpdate,
  staffCreate,
  platformStaffCreate,
  restaurantCreate,
  restaurantUpdate,
  httpsImageUrl,
}
