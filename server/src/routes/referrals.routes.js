import express from "express";
import { z } from "zod";
import {
	createReferral,
	generateReferralCode,
	listReferrals,
	getReferral,
	validateReferralCode,
	updateReferral,
	deleteReferral,
	getReferralStats,
    getReferralByCodeWithVendors,
    updateReferralStatusByCode,
} from "../controllers/referral.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { USER_ROLES } from "../utils/constants.js";

const router = express.Router();

// Validation schemas
const createReferralSchema = z.object({
	body: z.object({
		code: z
			.string()
			.min(4, "Code must be at least 4 characters")
			.max(20, "Code must be at most 20 characters"),
		discountPercent: z.number().min(0).max(100),
		maxUses: z.number().int().positive().optional(),
		expiresAt: z.string(),
		// description: z.string().optional(),
	}),
});

const generateReferralSchema = z.object({
	body: z.object({
		code: z.string().trim().min(4).max(20).optional(),
		discountPercent: z
			.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v), z.number().min(0).max(100)),
		maxUses: z
			.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v), z.number().int().positive().optional()),
		expiresAt: z.preprocess((v) => {
			if (typeof v !== "string") return v;
			const trimmed = v.trim();
			if (!trimmed) return undefined;
			if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
				return new Date(`${trimmed}T00:00:00.000Z`).toISOString();
			}
			return trimmed;
		}, z.string().datetime().optional()),
		description: z.string().trim().optional(),
	}),
});

const updateReferralSchema = z.object({
	body: z.object({
		discountPercent: z.number().min(0).max(100).optional(),
		maxUses: z.number().int().positive().optional(),
		expiresAt: z.string().datetime().optional(),
		description: z.string().optional(),
		status: z.enum(["active", "inactive"]).optional(),
	}),
});

// Public route - validate referral code
router.get("/validate/:code", validateReferralCode);
router.get("/public/:code", getReferralByCodeWithVendors);

// Admin routes
router.post(
	"/",
	authenticate,
	authorize(USER_ROLES.SUPER_ADMIN),
	validate(createReferralSchema),
	createReferral
);
router.post(
	"/generate",
	authenticate,
	authorize(USER_ROLES.SUPER_ADMIN),
	validate(generateReferralSchema),
	generateReferralCode
);
router.get(
	"/",
	// authenticate,
	// authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
	listReferrals
);
router.get(
	"/:id",
	authenticate,
	authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
	getReferral
);
router.get(
	"/:id/stats",
	authenticate,
	authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
	getReferralStats
);
router.patch(
	"/:id",
	authenticate,
	authorize(USER_ROLES.SUPER_ADMIN),
	validate(updateReferralSchema),
	updateReferral
);
router.patch(
	"/:code/status",
	authenticate,
	authorize(USER_ROLES.SUPER_ADMIN),
	updateReferralStatusByCode
);
router.delete(
	"/:id",
	authenticate,
	authorize(USER_ROLES.SUPER_ADMIN),
	deleteReferral
);

export default router;
