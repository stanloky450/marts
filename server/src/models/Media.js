import mongoose from "mongoose"

const mediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      enum: ["cloudinary", "s3"],
      default: "cloudinary",
    },
    folder: String,
    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    width: Number,
    height: Number,
    mime: String,
    size: Number,
  },
  {
    timestamps: true,
  },
)

// Indexes
mediaSchema.index({ ownerUser: 1 })
mediaSchema.index({ vendor: 1 })

export const Media = mongoose.model("Media", mediaSchema)
