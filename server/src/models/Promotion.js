import mongoose from "mongoose"

const promotionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
promotionSchema.index({ startsAt: 1, endsAt: 1 })
promotionSchema.index({ active: 1 })

export const Promotion = mongoose.model("Promotion", promotionSchema)
