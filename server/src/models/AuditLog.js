import mongoose from "mongoose"

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    resource: {
      type: String,
      required: true,
    },
    resourceId: mongoose.Schema.Types.ObjectId,
    changes: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  },
)

// Indexes
auditLogSchema.index({ user: 1 })
auditLogSchema.index({ resource: 1, resourceId: 1 })
auditLogSchema.index({ createdAt: -1 })

export const AuditLog = mongoose.model("AuditLog", auditLogSchema)
