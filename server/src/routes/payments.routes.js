import express from "express"
import { verifyPaymentStatus, listPayments } from "../controllers/payment.controller.js"
import { authenticate } from "../middleware/auth.js"

const router = express.Router()

// Payment verification (public for callback)
router.get("/verify/:reference", verifyPaymentStatus)

// List payments
router.get("/", authenticate, listPayments)

export default router
