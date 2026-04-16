import express from "express"
import {
  getAllSettings,
  getPublicSettings,
  updateSettings,
  getRssProxy,
} from "../controllers/setting.controller.js"
import { authenticate } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { USER_ROLES } from "../utils/constants.js"

const router = express.Router()

// Public endpoint for fetching non-sensitive settings (like market banner)
router.get("/public", getPublicSettings)
router.get("/rss-proxy", getRssProxy)

// Admin endpoints
router.use(authenticate)
router.use(authorize(USER_ROLES.SUPER_ADMIN))
router.get("/", getAllSettings)
router.patch("/", updateSettings) // Pass a map of key-value pairs to update

export default router
