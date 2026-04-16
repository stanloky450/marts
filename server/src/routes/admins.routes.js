import express from "express"
import { z } from "zod"
import {
  createAdmin,
  listAdmins,
  updateAdmin,
  deleteAdmin,
  assignVendor,
  unassignVendor,
  getAssignedVendors,
  getPendingProducts,
  listAllAssignments,
  getDashboardStats,
} from "../controllers/admin.controller.js"
import { getAdminProductAnalytics } from "../controllers/vendor.controller.js"
import { authenticate } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { validate } from "../middleware/validate.js"
import { USER_ROLES } from "../utils/constants.js"

const router = express.Router()

// Validation schemas
const createAdminSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
    region: z.string().optional(),
    notes: z.string().optional(),
    // Assignment mode fields (at most one should be provided)
    locationRegion: z.string().optional(),
    vendorIds: z.array(z.string()).optional(),
    referralCode: z.string().optional(),
  }),
})

const updateAdminSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    phone: z.string().optional(),
    region: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["active", "suspended"]).optional(),
  }),
})

const assignVendorSchema = z.object({
  body: z.object({
    adminId: z.string().min(1, "Admin ID is required"),
    vendorId: z.string().min(1, "Vendor ID is required"),
    region: z.string().optional(),
    notes: z.string().optional(),
  }),
})

// Super Admin routes - Admin CRUD
router.post("/", authenticate, authorize(USER_ROLES.SUPER_ADMIN), validate(createAdminSchema), createAdmin)
router.get("/list", authenticate, authorize(USER_ROLES.SUPER_ADMIN),  listAdmins)
router.patch("/:id", authenticate, authorize(USER_ROLES.SUPER_ADMIN),  updateAdmin)
router.delete("/:id", authenticate, authorize(USER_ROLES.SUPER_ADMIN), deleteAdmin)

// Assignment management
router.post("/assign", authenticate, authorize(USER_ROLES.SUPER_ADMIN), validate(assignVendorSchema), assignVendor)
router.delete("/assignments/:id", authenticate, authorize(USER_ROLES.SUPER_ADMIN), unassignVendor)
router.get("/assignments", authenticate, authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN), listAllAssignments)

// Admin routes - View assigned vendors and pending products
router.get("/vendors", authenticate, authorize(USER_ROLES.ADMIN), getAssignedVendors)
router.get("/pending-products", authenticate, authorize(USER_ROLES.ADMIN), getPendingProducts)

// Dashboard stats
router.get("/stats", authenticate, authorize(USER_ROLES.SUPER_ADMIN), getDashboardStats)

// Marketplace product analytics
router.get("/products/analytics", authenticate, authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN), getAdminProductAnalytics)

export default router
