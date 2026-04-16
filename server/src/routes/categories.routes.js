import express from "express"
import { z } from "zod"
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js"
import { authenticate } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { validate } from "../middleware/validate.js"
import { USER_ROLES } from "../utils/constants.js"

const router = express.Router()

// Validation schemas
const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, "Category name is required"),
    slug: z.string().min(2, "Slug is required"),
    parent: z.string().optional(),
    icon: z.string().optional(),
  }),
})

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    slug: z.string().min(2).optional(),
    parent: z.string().optional(),
    icon: z.string().optional(),
  }),
})

// Public routes
router.get("/", listCategories)
router.get("/:id", getCategory)

// Admin routes
router.post("/", authenticate, authorize(USER_ROLES.SUPER_ADMIN), validate(createCategorySchema), createCategory)
router.patch("/:id", authenticate, authorize(USER_ROLES.SUPER_ADMIN), validate(updateCategorySchema), updateCategory)
router.delete("/:id", authenticate, authorize(USER_ROLES.SUPER_ADMIN), deleteCategory)

export default router
