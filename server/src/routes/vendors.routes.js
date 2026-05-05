import express from "express";
import { z } from "zod";
import {
	register,
	initiateRegistration,
	getVendorProfile,
	updateVendorProfile,
	listVendors,
	updateVendorStatus,
	getVendorDashboardStats,
	getVendorProducts,
} from "../controllers/vendor.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { USER_ROLES, VENDOR_STATUS } from "../utils/constants.js";
import { upload, uploadErrorHandler } from "../middleware/upload.js";
import { uploadToCloud } from "../config/cloudinary.js";

const router = express.Router();
const STOREFRONT_THEME_VALUES = [
	"black",
	"deep_blue",
	"green",
	"purple_blue",
	"hot_coral",
	"electric_violet",
	"fuchsia_pop",
	"terracotta_glam",
	"midnight_berry",
	"blush_rose",
	"lavender_mist",
	"sage_and_cream",
	"hot_flamingo",
	"cherry_red",
	"candy_gradient",
	"papaya_punch",
];

// Validation schemas
const registerSchema = z.object({
	body: z.object({
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		email: z.string().email("Invalid email address"),
		password: z.string().min(8, "Password must be at least 8 characters"),
		phone: z.string().optional(),
		businessName: z.string().min(2, "Business name is required"),
		description: z.string().optional(),

		whatsapp: z.string().optional(),
		socials: z
			.object({
				facebook: z.string().optional(),
				instagram: z.string().optional(),
				x: z.string().optional(),
			})
			.optional(),
		referralCode: z.string().optional(),
	}),
});

const updateProfileSchema = z.object({
	body: z.object({
		businessName: z.string().min(2).optional(),
		description: z.string().optional(),
		phone: z.string().min(10).optional(),
		whatsapp: z.string().optional(),
		socials: z
			.object({
				facebook: z.string().optional(),
				instagram: z.string().optional(),
				x: z.string().optional(),
			})
			.optional(),
		address: z
			.object({
				street: z.string().optional(),
				city: z.string().optional(),
				state: z.string().optional(),
				country: z.string().optional(),
				postalCode: z.string().optional(),
			})
			.optional(),
		logoUrl: z.string().url().optional(),
		profilePhotoUrl: z.string().url().optional(),
		bannerImage: z.string().url().optional(),
		themeColor: z.enum(STOREFRONT_THEME_VALUES).optional(),
	}),
});

const updateStatusSchema = z.object({
	body: z.object({
		status: z.enum(Object.values(VENDOR_STATUS)),
	}),
});

// Public routes
// router.post(
// 	"/register",
// 	// validate(registerSchema),
// 	upload.fields([
// 		{ name: "logo", maxCount: 1 },
// 		{ name: "profilePhoto", maxCount: 1 },
// 	]),
// 	register
// );

// Initialize registration: payment first, no files here (JSON only)

router.post(
	"/register/init",
	// upload.fields([
	// 	{ name: "logoUrl", maxCount: 1 },
	// 	{ name: "profilePhotoUrl", maxCount: 1 },
	// ]),
	// uploadErrorHandler,
	initiateRegistration
);

// Vendor routes
router.get("/me", authenticate, authorize(USER_ROLES.VENDOR), getVendorProfile);

router.patch(
	"/me",
	authenticate,
	authorize(USER_ROLES.VENDOR),
	validate(updateProfileSchema),
	updateVendorProfile
);

// Admin routes
router.get(
	"/",
	authenticate,
	authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
	listVendors
);

router.patch(
	"/:id/status",
	authenticate,
	authorize(USER_ROLES.SUPER_ADMIN),
	validate(updateStatusSchema),
	updateVendorStatus
);

router.get(
	"/me/products",
	authenticate,
	authorize(USER_ROLES.VENDOR),
	getVendorProducts
);

router.get(
	"/me/stats",
	authenticate,
	authorize(USER_ROLES.VENDOR),
	getVendorDashboardStats
);

export default router;
