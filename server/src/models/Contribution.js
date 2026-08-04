import mongoose from "mongoose";

const contributionSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    cycleNumber: { type: Number, required: true, min: 1, default: 1 },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "paid", "late", "failed", "refunded"],
      default: "pending",
    },
    refundedAt: { type: Date, default: null },
    refundReference: { type: String, default: "", trim: true },
    paymentMethod: {
      type: String,
      enum: ["mobile_money", "card", "bank_transfer", "wallet"],
      required: true,
    },
    paystackReference: { type: String, trim: true },
    returnUrl: { type: String, default: "", select: false },
    authorizationUrl: { type: String, default: "", select: false },
    paystackAccessCode: { type: String, default: "", select: false },
    receiptUrl: { type: String, default: "", trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

contributionSchema.index(
  { paystackReference: 1 },
  { unique: true, sparse: true }
);
contributionSchema.index({ groupId: 1, cycleNumber: 1 });
contributionSchema.index(
  { groupId: 1, userId: 1, cycleNumber: 1 },
  { unique: true, partialFilterExpression: { status: "paid" } }
);
contributionSchema.index({ userId: 1, createdAt: -1 });

export const Contribution = mongoose.model("Contribution", contributionSchema);
