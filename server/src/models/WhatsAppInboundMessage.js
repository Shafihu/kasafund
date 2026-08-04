import mongoose from "mongoose";

const whatsAppInboundMessageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true, trim: true },
    waId: { type: String, required: true, trim: true },
    messageType: { type: String, default: "text", trim: true },
    receivedAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  { versionKey: false }
);

whatsAppInboundMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const WhatsAppInboundMessage = mongoose.model(
  "WhatsAppInboundMessage",
  whatsAppInboundMessageSchema
);
