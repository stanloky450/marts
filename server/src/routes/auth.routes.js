import express from "express";
import { z } from "zod";
import { login, refresh, logout, me } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// Validation schemas
const loginSchema = z.object({
	body: z.object({
		email: z.string().email("Invalid email address"),
		password: z.string().min(1, "Password is required"),
	}),
});

const refreshSchema = z.object({
	body: z.object({
		refreshToken: z.string().min(1, "Refresh token is required"),
	}),
});

// Routes
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh", validate(refreshSchema), refresh);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);

export default router;
