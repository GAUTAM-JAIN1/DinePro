const { z } = require('zod')

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
        const messages = err.errors
          ? err.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
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

// ───────────────────────────── Menu Schemas ─────────────────────────────

const coerceNumber = z.union([z.number(), z.string().transform(Number)]).refine(n => !isNaN(n), 'Must be a number')
const coercePositive = coerceNumber.refine(n => n > 0, 'Must be positive')
const coerceNonNeg = coerceNumber.refine(n => n >= 0, 'Must be >= 0')

const variantSchema = z.object({
  name: z.string().min(1),
  nameHindi: z.string().optional().default(''),
  price: coercePositive,
})

const menuItemCreate = z.object({
  name: z.string().min(1, 'name is required'),
  nameHindi: z.string().optional().default(''),
  description: z.string().optional().default(''),
  descriptionHindi: z.string().optional().default(''),
  price: coercePositive,
  category: z.string().min(1).default('Mains'),
  categoryHindi: z.string().optional().default(''),
  subcategory: z.string().optional().default(''),
  subcategoryHindi: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
  isVeg: z.boolean().optional().default(true),
  isAvailable: z.boolean().optional().default(true),
  isBestseller: z.boolean().optional().default(false),
  hasVariants: z.boolean().optional().default(false),
  variants: z.array(variantSchema).optional().default([]),
  sortOrder: coerceNonNeg.optional().default(0),
  restaurantId: z.string().optional(),
})

const menuItemUpdate = menuItemCreate.partial()

const menuReorder = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number(),
    })
  ).min(1),
})

// ───────────────────────────── Order Schemas ─────────────────────────────

const orderItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameHindi: z.string().optional().default(''),
  price: coerceNonNeg,
  quantity: z.union([z.number(), z.string().transform(Number)]).refine(n => Number.isInteger(n) && n > 0, 'Must be positive integer'),
  variant: z.string().nullable().optional().default(null),
  specialInstructions: z.string().optional().default(''),
  isVeg: z.boolean().optional().default(true),
})

const orderCreate = z.object({
  restaurantId: z.string().min(1, 'restaurantId is required'),
  tableId: z.string().min(1),
  tableNumber: z.union([z.string(), z.number()]).transform(String),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  specialInstructions: z.string().optional().default(''),
})

// ───────────────────────────── Staff Schemas ─────────────────────────────

const staffCreate = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'name is required'),
  role: z.enum(['admin', 'chef', 'receptionist'], {
    errorMap: () => ({ message: 'role must be admin, chef, or receptionist' }),
  }),
})

// ───────────────────────────── Restaurant Schemas ─────────────────────────────

const restaurantCreate = z.object({
  name: z.string().min(1, 'Restaurant name is required'),
  ownerEmail: z.string().email().optional(),
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  brandColor: z.string().optional().default('#f39c12'),
})

const restaurantUpdate = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  brandColor: z.string().optional(),
  logoUrl: z.string().optional(),
  defaultGstPercent: z.number().min(0).max(100).optional(),
  defaultServiceCharge: z.number().min(0).optional(),
  onboardingCompleted: z.boolean().optional(),
  onboardingCompletedAt: z.string().optional(),
}).passthrough()

module.exports = {
  validate,
  menuItemCreate,
  menuItemUpdate,
  menuReorder,
  orderCreate,
  staffCreate,
  restaurantCreate,
  restaurantUpdate,
}