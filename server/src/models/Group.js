import mongoose from "mongoose";

const contributionSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      required: true,
    },
    startDate: { type: Date, required: true },
    gracePeriodDays: { type: Number, default: 0, min: 0 },
    penaltyAmount: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  },
  { _id: false }
);

const rotationSchema = new mongoose.Schema(
  {
    isEnabled: { type: Boolean, default: true },
    order: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pendingOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    completedRecipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    currentPositionIndex: { type: Number, default: 0, min: 0 },
    roundNumber: { type: Number, default: 1, min: 1 },
    cycleStartedAt: { type: Date, default: null },
  },
  { _id: false }
);

const collectiveGoalSchema = new mongoose.Schema(
  {
    targetAmount: { type: Number, min: 1, validate: Number.isInteger, default: null },
    totalSaved: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    paidOutAmount: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    targetDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["saving", "target_reached", "completed"],
      default: "saving",
    },
    reachedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    coverImageUrl: { type: String, default: "", trim: true },
    type: {
      type: String,
      enum: ["susu", "family", "church", "cooperative", "other"],
      required: true,
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    savingModel: {
      type: String,
      enum: ["rotational", "collective_goal"],
      default: "rotational",
      required: true,
    },
    contribution: { type: contributionSchema, required: true },
    rotation: { type: rotationSchema, default: () => ({}) },
    collectiveGoal: { type: collectiveGoalSchema, default: null },
    memberCount: { type: Number, default: 1, min: 0 },
    expectedMemberCount: { type: Number, default: 2, min: 2, max: 50 },
    totalPot: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    status: {
      type: String,
      enum: ["setup", "active", "paused", "completed", "archived"],
      default: "active",
    },
    inviteCode: { type: String, required: true, unique: true, uppercase: true },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

groupSchema.index({ ownerId: 1, status: 1 });
groupSchema.index({ isPublic: 1, status: 1, createdAt: -1 });

export const Group = mongoose.model("Group", groupSchema);
