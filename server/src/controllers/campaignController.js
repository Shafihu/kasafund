import mongoose from "mongoose";
import { Campaign } from "../models/Campaign.js";
import { CampaignComment } from "../models/CampaignComment.js";
import { CampaignUpdate } from "../models/CampaignUpdate.js";
import { Donation } from "../models/Donation.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { UserReport } from "../models/UserReport.js";
import { audit, createShortCode, isHostedImageUrl, pagination, sendPage } from "../utils/api.js";

const categoryAliases = {
  education: "school_fees",
  emergency: "disaster_relief",
  celebration: "wedding",
};

function normalizeCategory(category) {
  return categoryAliases[category] || category;
}

export async function createCampaign(req, res) {
  const { title, description, category, coverImageUrl, goalAmount, deadline, isPublic, allowAnonymousDonations } = req.body;
  if (!title?.trim() || !description?.trim() || !Number.isInteger(goalAmount) || goalAmount < 1 || !deadline) {
    return res.status(400).json({ success: false, message: "Title, description, goal in pesewas, and deadline are required" });
  }
  if (!isHostedImageUrl(coverImageUrl)) {
    return res.status(400).json({ success: false, message: "Campaign cover must be uploaded first" });
  }
  const campaign = await Campaign.create({
    creatorId: req.user._id,
    title: title.trim(),
    description: description.trim(),
    category: normalizeCategory(category),
    coverImageUrl,
    goalAmount,
    deadline,
    isPublic: isPublic ?? true,
    allowAnonymousDonations: allowAnonymousDonations ?? true,
    shareSlug: createShortCode(10).toLowerCase(),
  });
  await audit({ actorId: req.user._id, action: "campaign.created", targetType: "campaign", targetId: campaign._id });
  return res.status(201).json({ success: true, data: campaign });
}

export async function listCampaigns(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const filter = req.query.mine === "true"
    ? { creatorId: req.user._id }
    : { isPublic: true, status: "active" };
  const [campaigns, total] = await Promise.all([
    Campaign.find(filter).populate("creatorId", "fullName avatarUrl").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Campaign.countDocuments(filter),
  ]);
  return sendPage(res, campaigns, page, limit, total);
}

export async function listDonatedCampaigns(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const filter = { donorId: req.user._id, status: "completed" };
  const [donations, total] = await Promise.all([
    Donation.find(filter).populate("campaignId").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Donation.countDocuments(filter),
  ]);
  return sendPage(res, donations, page, limit, total);
}

export async function getCampaign(req, res) {
  const lookup = mongoose.isValidObjectId(req.params.id)
    ? { $or: [{ _id: req.params.id }, { shareSlug: req.params.id }] }
    : { shareSlug: req.params.id };
  const campaign = await Campaign.findOne(lookup).populate("creatorId", "fullName avatarUrl");
  if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" });
  if (campaign.status === "flagged" && String(campaign.creatorId._id) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: "This campaign is temporarily under review" });
  }
  if (!campaign.isPublic && String(campaign.creatorId._id) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: "Campaign access denied" });
  }
  const [updates, comments, donations] = await Promise.all([
    CampaignUpdate.find({ campaignId: campaign._id }).populate("authorId", "fullName avatarUrl").sort({ createdAt: -1 }).limit(20),
    CampaignComment.find({ campaignId: campaign._id }).populate("authorId", "fullName avatarUrl").sort({ createdAt: -1 }).limit(50),
    Donation.find({ campaignId: campaign._id, status: "completed" }).select("isAnonymous displayName amount message createdAt").sort({ createdAt: -1 }).limit(20),
  ]);
  return res.json({ success: true, data: { campaign, updates, comments, donations } });
}

export async function updateCampaign(req, res) {
  const campaign = await Campaign.findOne({ _id: req.params.id, creatorId: req.user._id });
  if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" });
  if (req.body.title !== undefined && !String(req.body.title).trim()) {
    return res.status(400).json({ success: false, message: "Campaign title is required" });
  }
  if (req.body.description !== undefined && !String(req.body.description).trim()) {
    return res.status(400).json({ success: false, message: "Campaign story is required" });
  }
  if (req.body.coverImageUrl !== undefined && !isHostedImageUrl(req.body.coverImageUrl)) {
    return res.status(400).json({ success: false, message: "Campaign cover must be uploaded first" });
  }
  const allowed = ["title", "description", "category", "coverImageUrl", "deadline", "isPublic", "allowAnonymousDonations", "status"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === "category") campaign[key] = normalizeCategory(req.body[key]);
      else if (key === "title" || key === "description") campaign[key] = String(req.body[key]).trim();
      else campaign[key] = req.body[key];
    }
  }
  await campaign.save();
  await campaign.populate("creatorId", "fullName avatarUrl");
  await audit({ actorId: req.user._id, action: "campaign.updated", targetType: "campaign", targetId: campaign._id });
  return res.json({ success: true, data: campaign });
}

export async function addCampaignUpdate(req, res) {
  const campaign = await Campaign.findOne({ _id: req.params.id, creatorId: req.user._id });
  if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" });
  if (!req.body.content?.trim()) return res.status(400).json({ success: false, message: "Update content is required" });
  if (req.body.content.trim().length > 5000) {
    return res.status(400).json({ success: false, message: "Campaign updates cannot exceed 5,000 characters" });
  }
  const update = await CampaignUpdate.create({ campaignId: campaign._id, authorId: req.user._id, content: req.body.content.trim() });
  const donorIds = await Donation.distinct("donorId", { campaignId: campaign._id, status: "completed", donorId: { $ne: null } });
  if (donorIds.length) {
    const recipients = await User.find({
      _id: { $in: donorIds },
      "preferences.campaignNotifications": { $ne: false },
    }).select("_id");
    await Notification.insertMany(recipients.map((user) => ({ userId: user._id, type: "campaign_update", title: campaign.title, body: "A campaign you supported posted an update", relatedCampaignId: campaign._id })));
  }
  await update.populate("authorId", "fullName avatarUrl");
  await audit({ actorId: req.user._id, action: "campaign.update_posted", targetType: "campaign", targetId: campaign._id, metadata: { updateId: update._id } });
  return res.status(201).json({ success: true, data: update });
}

export async function addCampaignComment(req, res) {
  if (!req.body.content?.trim()) return res.status(400).json({ success: false, message: "Comment is required" });
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign || (!campaign.isPublic && String(campaign.creatorId) !== String(req.user._id))) {
    return res.status(404).json({ success: false, message: "Campaign not found" });
  }
  const comment = await CampaignComment.create({ campaignId: campaign._id, authorId: req.user._id, content: req.body.content.trim() });
  return res.status(201).json({ success: true, data: comment });
}

export async function reportCampaign(req, res) {
  const campaignId = String(req.params.id || "");
  const reason = String(req.body.reason || "").trim();
  const details = String(req.body.details || "").trim();
  const allowedReasons = ["scam", "misleading", "inappropriate", "prohibited", "other"];
  if (!mongoose.isValidObjectId(campaignId)) {
    return res.status(400).json({ success: false, message: "Invalid campaign" });
  }
  if (!allowedReasons.includes(reason)) {
    return res.status(400).json({ success: false, message: "Choose a valid report reason" });
  }
  if (details.length < 10 || details.length > 1000) {
    return res.status(400).json({ success: false, message: "Explain the concern in 10 to 1,000 characters" });
  }
  const campaign = await Campaign.findById(campaignId).select("creatorId title status");
  if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" });
  if (String(campaign.creatorId) === String(req.user._id)) {
    return res.status(400).json({ success: false, message: "You cannot report your own campaign" });
  }
  const existing = await UserReport.exists({
    reporterId: req.user._id,
    targetType: "campaign",
    reportedCampaignId: campaign._id,
    status: { $in: ["pending", "reviewing"] },
  });
  if (existing) {
    return res.status(409).json({ success: false, message: "You already have a report under review for this campaign" });
  }
  const report = await UserReport.create({
    reporterId: req.user._id,
    targetType: "campaign",
    reportedCampaignId: campaign._id,
    reason,
    details,
  });
  await audit({
    actorId: req.user._id,
    action: "campaign.report_submitted",
    targetType: "user_report",
    targetId: report._id,
    metadata: { reason, campaignId: campaign._id },
  });
  return res.status(201).json({
    success: true,
    message: "Campaign report submitted for review",
    data: { _id: report._id, status: report.status },
  });
}
