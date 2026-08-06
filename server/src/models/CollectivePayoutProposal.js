import mongoose from "mongoose";

const voteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    choice: { type: String, enum: ["approve", "reject"], required: true },
    votedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const collectivePayoutProposalSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    purpose: { type: String, required: true, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: ["voting", "approved", "rejected", "paid", "expired", "cancelled"],
      default: "voting",
    },
    eligibleVoterIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    requiredYesVotes: { type: Number, required: true, min: 1 },
    votes: { type: [voteSchema], default: [] },
    expiresAt: { type: Date, required: true },
    decidedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
    },
  },
  { timestamps: true, collection: "collective_payout_proposals" }
);

collectivePayoutProposalSchema.index({ groupId: 1, createdAt: -1 });
collectivePayoutProposalSchema.index(
  { groupId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "voting" } }
);

export const CollectivePayoutProposal = mongoose.model(
  "CollectivePayoutProposal",
  collectivePayoutProposalSchema
);
