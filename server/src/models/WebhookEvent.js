import mongoose from "mongoose"

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
    },
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    eventType: String,
    payload: mongoose.Schema.Types.Mixed,
    processed: {
      type: Boolean,
      default: false,
    },
    processedAt: Date,
    error: String,
  },
  {
    timestamps: true,
  },
)

// Indexes
// webhookEventSchema.index({ eventId: 1 })
webhookEventSchema.index({ processed: 1 })

export const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema)
