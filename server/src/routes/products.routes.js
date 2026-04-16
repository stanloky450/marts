import express from "express"
import { z } from "zod"
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  approveProduct,
  rejectProduct,
  trackView,
  getProductAnalytics,
} from "../controllers/product.controller.js"
import { authenticate } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { validate } from "../middleware/validate.js"
import { USER_ROLES } from "../utils/constants.js"
import { upload } from "../middleware/upload.js"

const router = express.Router()

// Validation schemas
const createProductSchema = z.object({
  body: z.object({
    productType: z.enum(["product", "service"]).optional(),
    name: z.string().min(2, "Product name is required"),
    description: z.string().optional(),
    category: z.string().min(1, "Category is required"),
    price: z.number().min(0, "Price must be positive").optional(),
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
    duration: z.string().min(1).optional(),
    videoUrl: z.string().url().optional(),
    discountPrice: z.number().min(0).optional(),
    promo: z
      .object({
        start: z.string().datetime().optional(),
        end: z.string().datetime().optional(),
      })
      .optional(),
    stock: z.number().int().min(0, "Stock must be non-negative").optional(),
    images: z.array(z.string()).max(5, "Maximum 5 images allowed").optional(),
    tags: z.array(z.string()).optional(),
    variants: z
      .array(
        z.object({
          size: z.string().optional(),
          color: z.string().optional(),
          sku: z.string().optional(),
          stock: z.number().optional(),
          price: z.number().optional(),
        }),
      )
      .optional(),
  }),
})

const updateProductSchema = z.object({
  body: z.object({
    productType: z.enum(["product", "service"]).optional(),
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    price: z.number().min(0).optional(),
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
    duration: z.string().min(1).optional(),
    videoUrl: z.string().url().optional(),
    discountPrice: z.number().min(0).optional(),
    promo: z
      .object({
        start: z.string().datetime().optional(),
        end: z.string().datetime().optional(),
      })
      .optional(),
    stock: z.number().int().min(0).optional(),
    images: z.array(z.string()).max(5).optional(),
    tags: z.array(z.string()).optional(),
    variants: z
      .array(
        z.object({
          size: z.string().optional(),
          color: z.string().optional(),
          sku: z.string().optional(),
          stock: z.number().optional(),
          price: z.number().optional(),
        }),
      )
      .optional(),
  }),
})

const rejectProductSchema = z.object({
  body: z.object({
    rejectionNote: z.string().min(10, "Rejection note must be at least 10 characters"),
  }),
})

// Product CRUD
router.post("/", authenticate, authorize(USER_ROLES.VENDOR),
upload.fields([
  { name: "images", maxCount: 1 },
]), 
validate(createProductSchema), createProduct)

router.get("/", authenticate, listProducts)
router.get("/:id", authenticate, getProduct)

router.patch("/:id", authenticate, 
  upload.fields([
    { name: "images", maxCount: 1 },
  ]),
  validate(updateProductSchema), updateProduct)

router.delete("/:id", authenticate, deleteProduct)

// Approval routes
router.patch("/:id/approve", authenticate, authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), approveProduct)
router.patch(
  "/:id/reject",
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(rejectProductSchema),
  rejectProduct,
)

// Public view tracker — no auth required (storefront customers)
router.post("/:id/view", trackView)

// Vendor product analytics
router.get("/analytics/mine", authenticate, authorize(USER_ROLES.VENDOR), getProductAnalytics)

export default router
