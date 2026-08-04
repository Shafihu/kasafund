import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "deposit",
        "withdrawal",
        "payout",
        "contribution",
        "contribution_refund",
        "savings_deposit",
        "savings_withdrawal",
        "debt_repayment",
        "debt_recovery",
      ],
      required: true,
    },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    currency: { type: String, enum: ["GHS"], default: "GHS" },
    status: {
      type: String,
      enum: ["initialized", "pending", "completed", "failed", "reversed"],
      default: "initialized",
    },
    reference: { type: String, required: true, unique: true, trim: true },
    relatedGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    relatedSavingsPotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavingsPot",
      default: null,
    },
    returnUrl: { type: String, default: "", select: false },
    paystackAccessCode: { type: String, default: "", select: false },
    paystackTransferCode: { type: String, default: "", trim: true },
    paystackRecipientCode: { type: String, default: "", trim: true },
    transferMode: {
      type: String,
      enum: ["live", "mock"],
      default: "live",
    },
    transferMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    channel: { type: String, default: "", trim: true },
    destination: {
      providerCode: { type: String, default: "", trim: true },
      providerName: { type: String, default: "", trim: true },
      accountLast4: { type: String, default: "", trim: true, maxlength: 4 },
    },
    failureReason: { type: String, default: "", trim: true, maxlength: 500 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model(
  "WalletTransaction",
  walletTransactionSchema
);
