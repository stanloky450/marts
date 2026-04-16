import mongoose from "mongoose"
import { AD_SLOTS } from "../utils/constants.js"

const adPlacementSchema = new mongoose.Schema(
  {
    slot: {
      type: String,
      enum: Object.values(AD_SLOTS),
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    targetUrl: String,
    active: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
adPlacementSchema.index({ slot: 1, active: 1 })
adPlacementSchema.index({ priority: -1 })

export const AdPlacement = mongoose.model("AdPlacement", adPlacementSchema)
