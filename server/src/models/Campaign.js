import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 10000 },
    category: {
      type: String,
      enum: [
        "medical",
        "funeral",
        "wedding",
        "school_fees",
        "charity",
        "community",
        "disaster_relief",
        "business",
        "other",
      ],
      required: true,
    },
    coverImageUrl: { type: String, default: "", trim: true },
    goalAmount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    raisedAmount: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    donorCount: { type: Number, default: 0, min: 0 },
    deadline: { type: Date, required: true },
    isPublic: { type: Boolean, default: true },
    allowAnonymousDonations: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["active", "completed", "closed", "flagged"],
      default: "active",
    },
    moderation: {
      previousStatus: { type: String, enum: ["active", null], default: null },
      flagReason: { type: String, trim: true, maxlength: 300, default: "" },
      flaggedAt: { type: Date, default: null },
      flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      restoreReason: { type: String, trim: true, maxlength: 300, default: "" },
      restoredAt: { type: Date, default: null },
      restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    shareSlug: { type: String, required: true, unique: true, lowercase: true },
  },
  { timestamps: true }
);

campaignSchema.index({ creatorId: 1, createdAt: -1 });
campaignSchema.index({ isPublic: 1, status: 1, createdAt: -1 });

export const Campaign = mongoose.model("Campaign", campaignSchema);
