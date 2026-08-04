import mongoose from "mongoose";

const userReportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["member", "campaign"], default: "member", required: true },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      required() { return this.targetType === "member"; },
    },
    reportedCampaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
      required() { return this.targetType === "campaign"; },
    },
    reason: {
      type: String,
      enum: ["scam", "harassment", "impersonation", "misleading", "inappropriate", "prohibited", "other"],
      required: true,
    },
    details: { type: String, default: "", trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pending", "reviewing", "resolved", "dismissed"],
      default: "pending",
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewStartedAt: { type: Date, default: null },
    resolutionSummary: { type: String, default: "", trim: true, maxlength: 1000 },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    internalNotes: [{
      authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      body: { type: String, required: true, trim: true, maxlength: 1000 },
      createdAt: { type: Date, default: Date.now },
    }],
    decisions: [{
      action: { type: String, enum: ["resolved", "dismissed", "reopened"], required: true },
      summary: { type: String, required: true, trim: true, maxlength: 1000 },
      authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

userReportSchema.index({ reporterId: 1, reportedUserId: 1, status: 1 });
userReportSchema.index({ reporterId: 1, reportedCampaignId: 1, status: 1 });
userReportSchema.index({ targetType: 1, status: 1, createdAt: -1 });
userReportSchema.index({ status: 1, createdAt: -1 });
userReportSchema.index({ assignedTo: 1, status: 1, updatedAt: -1 });

export const UserReport = mongoose.model("UserReport", userReportSchema);
