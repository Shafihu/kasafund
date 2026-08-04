import mongoose from "mongoose";

const savingsPotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    targetAmount: { type: Number, required: true, min: 100, validate: Number.isInteger },
    currentAmount: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    contributionAmount: { type: Number, required: true, min: 100, validate: Number.isInteger },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    nextContributionAt: { type: Date, required: true },
    targetDate: { type: Date, required: true },
    mode: { type: String, enum: ["flexible", "locked"], default: "flexible" },
    status: { type: String, enum: ["active", "paused", "completed", "closed"], default: "active" },
    autoSaveEnabled: { type: Boolean, default: false },
    lastAutoSaveAt: { type: Date, default: null },
    lastAutoSaveScheduleAt: { type: Date, default: null },
    lastAutoSaveAttemptScheduleAt: { type: Date, default: null },
    lastAutoSaveStatus: {
      type: String,
      enum: ["never", "paid", "insufficient_balance", "failed"],
      default: "never",
    },
    failureReason: { type: String, default: "", trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

savingsPotSchema.index({ userId: 1, status: 1, updatedAt: -1 });
savingsPotSchema.index({ autoSaveEnabled: 1, status: 1, nextContributionAt: 1 });

export const SavingsPot = mongoose.model("SavingsPot", savingsPotSchema);
