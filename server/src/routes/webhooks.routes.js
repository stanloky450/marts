import express from "express";
import { handlePaystackWebhook } from "../controllers/webhook.controller.js";
import { webhookLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// Paystack webhook (no auth, verified by signature)
router.post(
	"/paystack",
	webhookLimiter,
	express.raw({ type: "*/*" }),
	handlePaystackWebhook
);

export default router;
