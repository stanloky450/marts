import express from "express"
import {
  createAd,
  getAds,
  updateAd,
  deleteAd,
} from "../controllers/adsplace.controller.js"
import { authenticate } from "../middleware/auth.js"
import { authorize } from "../middleware/rbac.js"
import { upload } from "../middleware/upload.js"
import { USER_ROLES } from "../utils/constants.js"

const router = express.Router()

// Public read access for ads
// The user request said "The superadmin can carry out some action, but i want the superadmin to be able to able to create ads..."
// It implies management is superadmin. Fetching ads for display might be public, but fetching for management (with filtering) might be admin.
// However, usually ads are fetched by frontend for display without auth.
// But the controller `getAds` supports filtering by `active`.
// Let's make `getAds` public or at least accessible to authenticated users, but for now I will follow the pattern of "superadmin operations".
// If the user wants to fetch ads for the storefront, that might be a different route or this one with less restriction.
// Given the prompt "superadmin to be able to ... create, delete, edit and fetch", I will restrict all to SUPER_ADMIN for now as per the "management" context.
// If I need a public route for the storefront, I can add it later or make `getAds` public.
// Actually, for a marketplace, fetching ads to display is definitely public.
// But the prompt focuses on "superadmin... create ads... fetch the ads".
// I will make `getAds` public (or at least not restricted to superadmin) but `create`, `update`, `delete` restricted.
// Wait, `getAds` in the controller allows filtering by `active`.
// I'll make `get` public (or just authenticated if the whole app is behind auth, but likely not for ads).
// But `create`, `update`, `delete` are definitely SUPER_ADMIN.

// Let's look at `admins.routes.js` again. It has `router.get("/list", ... authorize(SUPER_ADMIN) ...)`
// So I will stick to the prompt's context of superadmin operations.
// I will add a comment about public access.

router.post("/", authenticate, authorize(USER_ROLES.SUPER_ADMIN), upload.single("file"), createAd)
router.get("/", getAds) 

router.patch("/:id", authenticate, authorize(USER_ROLES.SUPER_ADMIN), upload.single("file"), updateAd)
router.delete("/:id", authenticate, authorize(USER_ROLES.SUPER_ADMIN), deleteAd)

export default router
