import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "payment_due",
        "payment_confirmed",
        "payout_scheduled",
        "payout_completed",
        "campaign_update",
        "campaign_moderation",
        "report_update",
        "donation_received",
        "invitation",
        "role_changed",
        "penalty_applied",
        "identity_verification",
        "savings_update",
        "resolution_created",
        "resolution_completed",
        "join_request",
        "debt_repayment",
        "contribution_refunded",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    relatedGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null },
    relatedCampaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", default: null },
    relatedSavingsPotId: { type: mongoose.Schema.Types.ObjectId, ref: "SavingsPot", default: null },
    relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
