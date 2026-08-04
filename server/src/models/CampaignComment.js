import mongoose from "mongoose";

const campaignCommentSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "campaign_comments" }
);

campaignCommentSchema.index({ campaignId: 1, createdAt: -1 });

export const CampaignComment = mongoose.model("CampaignComment", campaignCommentSchema);
