import mongoose from "mongoose";

const campaignUpdateSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "campaign_updates" }
);

campaignUpdateSchema.index({ campaignId: 1, createdAt: -1 });

export const CampaignUpdate = mongoose.model("CampaignUpdate", campaignUpdateSchema);
