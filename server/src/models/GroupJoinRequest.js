import mongoose from "mongoose";

const groupJoinRequestSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    agreement: {
      version: { type: String, default: "" },
      acceptedAt: { type: Date, default: null },
      source: { type: String, enum: ["", "public_request"], default: "" },
      termsSnapshot: {
        contributionAmount: { type: Number, default: null },
        contributionFrequency: {
          type: String,
          enum: ["daily", "weekly", "monthly", null],
          default: null,
        },
        gracePeriodDays: { type: Number, default: 0 },
        penaltyAmount: { type: Number, default: 0 },
        acceleratedDebt: { type: Boolean, default: true },
        resolutionVoting: { type: Boolean, default: true },
      },
    },
  },
  {
    timestamps: true,
    collection: "group_join_requests",
  }
);

groupJoinRequestSchema.index({ groupId: 1, userId: 1 }, { unique: true });
groupJoinRequestSchema.index({ groupId: 1, status: 1, createdAt: -1 });
groupJoinRequestSchema.index({ userId: 1, status: 1 });

export const GroupJoinRequest = mongoose.model(
  "GroupJoinRequest",
  groupJoinRequestSchema
);
