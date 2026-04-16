import mongoose from "mongoose"

const adminAssignmentSchema = new mongoose.Schema(
  {
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    region: String,
    notes: String,
  },
  {
    timestamps: true,
  },
)

// Indexes
adminAssignmentSchema.index({ adminUser: 1 })
adminAssignmentSchema.index({ vendor: 1 })

// Ensure unique admin-vendor pairs
adminAssignmentSchema.index({ adminUser: 1, vendor: 1 }, { unique: true })

export const AdminAssignment = mongoose.model("AdminAssignment", adminAssignmentSchema)
