import express from "express"
import authRoutes from "./auth.routes.js"
import userRoutes from "./users.routes.js"
import adminRoutes from "./admins.routes.js"
import vendorRoutes from "./vendors.routes.js"
import paymentRoutes from "./payments.routes.js"
import webhookRoutes from "./webhooks.routes.js"
import productRoutes from "./products.routes.js"
import categoryRoutes from "./categories.routes.js"
import mediaRoutes from "./media.routes.js"
import referralRoutes from "./referrals.routes.js"
import storefrontRoutes from "./storefront.routes.js"
import adsplaceRoutes from "./adsplace.routes.js"
import aiRoutes from "./ai.routes.js"
import locationRoutes from "./locations.routes.js"
import settingsRoutes from "./settings.routes.js"
import chatRoutes from "./chat.routes.js"
import reviewRoutes from "./reviews.routes.js"

const router = express.Router()

// Mount routes
router.use("/auth", authRoutes)
router.use("/users", userRoutes)
router.use("/admins", adminRoutes)
router.use("/vendors", vendorRoutes)
router.use("/payments", paymentRoutes)
router.use("/webhooks", webhookRoutes)
router.use("/products", productRoutes)
router.use("/categories", categoryRoutes)
router.use("/media", mediaRoutes)
router.use("/referrals", referralRoutes)
router.use("/storefront", storefrontRoutes)
router.use("/adsplace", adsplaceRoutes)
router.use("/ai", aiRoutes)
router.use("/locations", locationRoutes)
router.use("/settings", settingsRoutes)
router.use("/chat", chatRoutes)
router.use("/reviews", reviewRoutes)

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  })
})

export default router
