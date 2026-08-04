import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isAnonymous: { type: Boolean, default: false },
    displayName: { type: String, default: "Anonymous", trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    message: { type: String, default: "", trim: true, maxlength: 500 },
    paymentMethod: {
      type: String,
      enum: ["mobile_money", "card", "bank_transfer", "wallet"],
      required: true,
    },
    paystackReference: { type: String, trim: true },
    returnUrl: { type: String, default: "", select: false },
    authorizationUrl: { type: String, default: "", select: false },
    paystackAccessCode: { type: String, default: "", select: false },
    paidAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

donationSchema.index(
  { paystackReference: 1 },
  { unique: true, sparse: true }
);
donationSchema.index({ campaignId: 1, createdAt: -1 });
donationSchema.index({ donorId: 1, createdAt: -1 });

export const Donation = mongoose.model("Donation", donationSchema);
