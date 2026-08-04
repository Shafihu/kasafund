import mongoose from "mongoose";

const voteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    choice: { type: String, enum: ["approve", "reject"], required: true },
    votedAt: { type: Date, required: true },
  },
  { _id: false }
);

const groupResolutionSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    payoutId: { type: mongoose.Schema.Types.ObjectId, ref: "Payout", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["close_short_and_suspend"],
      default: "close_short_and_suspend",
    },
    status: {
      type: String,
      enum: ["voting", "approved", "rejected", "executed", "failed", "expired"],
      default: "voting",
    },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    defaultingUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    eligibleVoterIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    requiredYesVotes: { type: Number, required: true, min: 1 },
    originalPayoutAmount: { type: Number, required: true, min: 1 },
    proposedPayoutAmount: { type: Number, required: true, min: 1 },
    attemptNumber: { type: Number, default: 1, min: 1 },
    votes: { type: [voteSchema], default: [] },
    expiresAt: { type: Date, required: true },
    decidedAt: { type: Date, default: null },
    executedAt: { type: Date, default: null },
    failureReason: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

groupResolutionSchema.index({ groupId: 1, status: 1, createdAt: -1 });
groupResolutionSchema.index({ payoutId: 1 }, { unique: true });
groupResolutionSchema.index({ eligibleVoterIds: 1, status: 1 });

export const GroupResolution = mongoose.model(
  "GroupResolution",
  groupResolutionSchema
);
