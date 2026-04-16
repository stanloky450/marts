import mongoose from "mongoose"
import { REFERRAL_STATUS } from "../utils/constants.js"

const referralSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
    maxUses: {
      type: Number,
      default: null, // null means unlimited
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: String,
      default: 0,
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true,
    },
    status: {
      type: String,
      enum: Object.values(REFERRAL_STATUS),
      default: REFERRAL_STATUS.ACTIVE,
    },
    lastUsedAt: Date,
  },
  {
    timestamps: true,
  },
)

// Indexes
// referralSchema.index({ code: 1 })
// referralSchema.index({ status: 1 })

export const Referral = mongoose.model("Referral", referralSchema)
