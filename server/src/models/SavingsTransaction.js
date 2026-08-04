import mongoose from "mongoose";

const savingsTransactionSchema = new mongoose.Schema(
  {
    potId: { type: mongoose.Schema.Types.ObjectId, ref: "SavingsPot", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["deposit", "withdrawal"], required: true },
    source: { type: String, enum: ["wallet", "automatic"], required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    balanceAfter: { type: Number, required: true, min: 0, validate: Number.isInteger },
    reference: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ["completed", "failed"], default: "completed" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

savingsTransactionSchema.index({ potId: 1, createdAt: -1 });

export const SavingsTransaction = mongoose.model("SavingsTransaction", savingsTransactionSchema);
