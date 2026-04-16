import mongoose from "mongoose"
import { PAYMENT_TYPE, PAYMENT_STATUS, PAYMENT_PROVIDER } from "../utils/constants.js"

const paymentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(PAYMENT_TYPE),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    provider: {
      type: String,
      enum: Object.values(PAYMENT_PROVIDER),
      default: PAYMENT_PROVIDER.PAYSTACK,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    metadata: mongoose.Schema.Types.Mixed,
    paidAt: Date,
  },
  {
    timestamps: true,
  },
)

// Indexes
// paymentSchema.index({ reference: 1 })
paymentSchema.index({ type: 1 })
paymentSchema.index({ status: 1 })
paymentSchema.index({ user: 1 })

export const Payment = mongoose.model("Payment", paymentSchema)
