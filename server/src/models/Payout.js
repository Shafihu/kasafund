import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cycleNumber: { type: Number, required: true, min: 1 },
    rotationRound: { type: Number, required: true, min: 1, default: 1 },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    scheduledDate: { type: Date, required: true },
    contributionAmount: { type: Number, min: 1, validate: Number.isInteger, default: null },
    expectedContributorIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    snapshotLockedAt: { type: Date, default: null },
    graceEndsAt: { type: Date, default: null },
    graceExtensionCount: { type: Number, default: 0, min: 0, max: 1 },
    lastGraceExtensionAt: { type: Date, default: null },
    fundingStatus: {
      type: String,
      enum: ["awaiting", "ready", "overdue"],
      default: "awaiting",
    },
    fundingStatusUpdatedAt: { type: Date, default: null },
    overdueNotifiedAt: { type: Date, default: null },
    resolutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupResolution",
      default: null,
    },
    originalAmount: {
      type: Number,
      min: 1,
      default: null,
      validate: {
        validator: (value) => value === null || value === undefined || Number.isInteger(value),
        message: "Original payout amount must be an integer",
      },
    },
    paidAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    closureReason: {
      type: String,
      enum: ["", "resolution_deadlock"],
      default: "",
    },
    status: {
      type: String,
      enum: ["scheduled", "processing", "completed", "failed"],
      default: "scheduled",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

payoutSchema.index({ groupId: 1, cycleNumber: 1 }, { unique: true });
payoutSchema.index({ recipientId: 1, status: 1 });
payoutSchema.index({ status: 1, scheduledDate: 1, fundingStatus: 1 });
payoutSchema.index(
  { groupId: 1, rotationRound: 1, recipientId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "completed", rotationRound: { $type: "number" } },
  }
);

export const Payout = mongoose.model("Payout", payoutSchema);
