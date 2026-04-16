import { validateWebhookSignature } from "../utils/paystack.js"
import { config as appConfig } from "../config/env.js"
import { PAYMENT_TYPE } from "../utils/constants.js"
import { processSuccessfulRegistration } from "./vendor.controller.js"
import prisma from "../lib/prisma.js"

export const handlePaystackWebhook = async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString())
    const signature = req.headers["x-paystack-signature"]

    // Verify webhook signature
    if (!validateWebhookSignature(req.body, signature, appConfig.paystack.webhookSecret)) {
      console.error("❌ Invalid webhook signature")
      return res.status(400).send("Invalid signature")
    }

    const { event, data } = payload

    console.log("🔔 Webhook received:", {
      event,
      reference: data.reference,
      status: data.status,
    })

    // Handle charge.success event
    if (event === "charge.success") {
      // Find payment record
      const payment = await prisma.payment.findUnique({
        where: { reference: data.reference }
      })

      if (!payment) {
        console.error("❌ Payment not found for reference:", data.reference)
        return res.status(404).send("Payment not found")
      }

      // Check if already processed (prevent duplicate registration)
      if (payment.status === "success") {
        console.log("⚠️ Payment already processed:", data.reference)
        return res.status(200).send("Already processed")
      }

      // Extract registration data from metadata
      const registrationData = payment.metadata?.registrationData

      if (!registrationData) {
        console.error("❌ No registrationData found in payment metadata")
        return res.status(400).send("Missing registration metadata")
      }

      // Check if payment type is registration
      if (payment.type !== PAYMENT_TYPE.REGISTRATION) {
        console.log("⚠️ Not a registration payment:", payment.type)
        return res.status(200).send("Not a registration payment")
      }

      // Process the registration
      try {
        await processSuccessfulRegistration(payment, registrationData)
        console.log("✅ Registration processed successfully")
      } catch (error) {
        console.error("❌ Registration processing failed:", error)
        // Returning 200 here prevents Paystack from retrying the webhook
        return res.status(200).send("Processing failed - logged")
      }
    }

    // Always return 200 to acknowledge receipt
    res.status(200).send("OK")
  } catch (error) {
    console.error("❌ Webhook processing error:", error)
    res.status(200).send("Error logged")
  }
}
