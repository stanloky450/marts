import express from "express"
import { z } from "zod"
import { listUsers, getUser, updateUser, deleteUser } from "../controllers/user.controller.js"
import { authenticate } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { validate } from "../middleware/validate.js"
import { USER_ROLES } from "../utils/constants.js"

const router = express.Router()

// Validation schemas
const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    phone: z.string().optional(),
    status: z.enum(["active", "suspended"]).optional(),
  }),
})

// User management (Super Admin only)
router.get("/", authenticate, authorize(USER_ROLES.SUPER_ADMIN), listUsers)
router.get("/:id", authenticate, authorize(USER_ROLES.SUPER_ADMIN), getUser)
router.patch("/:id", authenticate, authorize(USER_ROLES.SUPER_ADMIN), validate(updateUserSchema), updateUser)
router.delete("/:id", authenticate, authorize(USER_ROLES.SUPER_ADMIN), deleteUser)

export default router
