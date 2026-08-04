import mongoose from "mongoose";

const debtPaymentSchema = new mongoose.Schema(
  {
    delinquencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupDelinquency",
      required: true,
    },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    creditorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    paymentMethod: {
      type: String,
      enum: ["mobile_money", "card", "wallet"],
      required: true,
    },
    reference: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    returnUrl: { type: String, default: "", select: false },
    authorizationUrl: { type: String, default: "", select: false },
    paystackAccessCode: { type: String, default: "", select: false },
    paidAt: { type: Date, default: null },
    failureReason: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true, collection: "debt_payments" }
);

debtPaymentSchema.index({ userId: 1, status: 1, createdAt: -1 });
debtPaymentSchema.index({ delinquencyId: 1, status: 1 });

export const DebtPayment = mongoose.model("DebtPayment", debtPaymentSchema);
