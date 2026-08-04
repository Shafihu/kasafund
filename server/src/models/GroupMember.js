import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
  {
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: {
    type: String,
    enum: ["owner", "treasurer", "moderator", "member"],
    default: "member",
  },
  status: {
    type: String,
    enum: ["active", "suspended", "removed", "left"],
    default: "active",
  },
  suspendedAt: { type: Date, default: null },
  suspensionReason: {
    type: String,
    enum: ["", "contribution_default", "manual"],
    default: "",
  },
  rejoinBlocked: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
  payoutPosition: { type: Number, default: null, min: 0 },
  setupPayoutPosition: { type: Number, default: null, min: 0 },
  lastContributionStatus: {
    type: String,
    enum: ["paid", "pending", "late"],
    default: "pending",
  },
  totalContributed: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  chatLastReadAt: { type: Date, default: Date.now },
  autoContribution: {
    enabled: { type: Boolean, default: false },
    paymentSource: { type: String, enum: ["wallet"], default: "wallet" },
    enabledAt: { type: Date, default: null },
    nextRunAt: { type: Date, default: null },
    reminderCycleNumber: { type: Number, default: null, min: 1 },
    lastAttemptAt: { type: Date, default: null },
    lastAttemptCycleNumber: { type: Number, default: null, min: 1 },
    lastStatus: {
      type: String,
      enum: ["never", "paid", "already_paid", "insufficient_balance", "failed"],
      default: "never",
    },
    failureReason: { type: String, default: "", trim: true, maxlength: 300 },
  },
  agreement: {
    version: { type: String, default: "", trim: true },
    acceptedAt: { type: Date, default: null },
    source: {
      type: String,
      enum: ["", "group_creation", "public_request", "invitation", "invite_code"],
      default: "",
    },
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
  { collection: "group_members" }
);

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
groupMemberSchema.index({ userId: 1, status: 1 });
groupMemberSchema.index({ "autoContribution.enabled": 1, status: 1 });

export const GroupMember = mongoose.model("GroupMember", groupMemberSchema);
