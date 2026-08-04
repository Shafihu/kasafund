import mongoose from "mongoose";

const whatsAppLinkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    waId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      select: false,
    },
    phoneLast4: { type: String, default: "", trim: true, maxlength: 4 },
    linkedAt: { type: Date, default: null },
    lastInteractionAt: { type: Date, default: null },
    linkCodeHash: { type: String, default: "", select: false },
    linkCodeExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

whatsAppLinkSchema.index({ linkCodeHash: 1 });

export const WhatsAppLink = mongoose.model("WhatsAppLink", whatsAppLinkSchema);
