import mongoose from "mongoose"

const subdomainSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
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
// subdomainSchema.index({ name: 1 })
subdomainSchema.index({ vendor: 1 })

export const Subdomain = mongoose.model("Subdomain", subdomainSchema)
