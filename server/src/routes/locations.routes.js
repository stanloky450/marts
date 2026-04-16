import express from "express"
import {
  createLocation,
  getLocations,
  getNigeriaCatalog,
  updateLocation,
  deleteLocation,
} from "../controllers/location.controller.js"
import { authenticate } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { USER_ROLES } from "../utils/constants.js"

const router = express.Router()

// Public endpoint for registration form fetching locations
router.get("/", getLocations)
router.get("/catalog/nigeria", getNigeriaCatalog)

// Admin endpoints
router.use(authenticate)
router.use(authorize(USER_ROLES.SUPER_ADMIN))
router.post("/", createLocation)
router.patch("/:id", updateLocation)
router.delete("/:id", deleteLocation)

export default router
