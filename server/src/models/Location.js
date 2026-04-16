import mongoose from "mongoose"

const locationSchema = new mongoose.Schema(
  {
    region: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    areas: [
      {
        type: String,
        trim: true,
      },
    ],
    registrationFee: {
      type: Number,
      required: true,
      default: 10000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
)

export const Location = mongoose.model("Location", locationSchema)
