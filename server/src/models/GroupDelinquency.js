import mongoose from "mongoose";

const groupDelinquencySchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    payoutId: { type: mongoose.Schema.Types.ObjectId, ref: "Payout", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cycleNumber: { type: Number, required: true, min: 1 },
    amountDue: { type: Number, required: true, min: 1, validate: Number.isInteger },
    liabilityType: {
      type: String,
      enum: ["cycle_default", "post_payout_debt"],
      default: "cycle_default",
    },
    creditorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    creditorAllocations: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    }],
    dueDate: { type: Date, required: true },
    graceEndsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "paid", "waived", "extended"],
      default: "open",
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

groupDelinquencySchema.index(
  { groupId: 1, userId: 1, cycleNumber: 1 },
  { unique: true }
);
groupDelinquencySchema.index({ userId: 1, status: 1, createdAt: -1 });
groupDelinquencySchema.index({ userId: 1, liabilityType: 1, status: 1 });
groupDelinquencySchema.index({ payoutId: 1, status: 1 });

export const GroupDelinquency = mongoose.model(
  "GroupDelinquency",
  groupDelinquencySchema
);
