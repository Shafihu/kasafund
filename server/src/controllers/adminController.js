import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { Campaign } from "../models/Campaign.js";
import { CampaignComment } from "../models/CampaignComment.js";
import { CampaignUpdate } from "../models/CampaignUpdate.js";
import { Contribution } from "../models/Contribution.js";
import { Donation } from "../models/Donation.js";
import { Group } from "../models/Group.js";
import { GroupDelinquency } from "../models/GroupDelinquency.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupResolution } from "../models/GroupResolution.js";
import { Notification } from "../models/Notification.js";
import { Payout } from "../models/Payout.js";
import { SavingsPot } from "../models/SavingsPot.js";
import { User } from "../models/User.js";
import { UserReport } from "../models/UserReport.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { applyVerificationDecision } from "./kycController.js";
import { retrieveVerificationDecision } from "../services/diditService.js";
import { audit } from "../utils/api.js";

const KYC_STATUSES = [
  "not_started",
  "in_progress",
  "in_review",
  "verified",
  "declined",
  "expired",
  "resubmission_required",
];
const REVIEW_QUEUE_STATUSES = ["in_progress", "in_review", "resubmission_required"];
const AUDIT_TARGET_TYPES = ["group", "campaign", "user", "user_report", "wallet_transaction", "savings_pot"];
const REPORT_STATUSES = ["pending", "reviewing", "resolved", "dismissed"];
const REPORT_REASONS = ["scam", "harassment", "impersonation", "misleading", "inappropriate", "prohibited", "other"];
const REPORT_TARGET_TYPES = ["member", "campaign"];
const ADMIN_USER_FIELDS = [
  "fullName",
  "email",
  "phone",
  "avatarUrl",
  "bio",
  "role",
  "isActive",
  "isEmailVerified",
  "isPhoneVerified",
  "walletBalance",
  "identityVerification.provider",
  "identityVerification.status",
  "identityVerification.documentType",
  "identityVerification.issuingCountry",
  "identityVerification.failureReason",
  "identityVerification.verifiedAt",
  "identityVerification.submittedAt",
  "identityVerification.lastCheckedAt",
  "createdAt",
  "lastLoginAt",
].join(" ");

function escapedRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function campaignModerationTransition(currentStatus, action) {
  if (action === "flag" && currentStatus === "active") return "flagged";
  if (action === "restore" && currentStatus === "flagged") return "active";
  if (action === "flag") throw httpError(409, "Only an active campaign can be flagged");
  if (action === "restore") throw httpError(409, "Only a flagged campaign can be restored");
  throw httpError(400, "Moderation action must be flag or restore");
}

export function reportCaseTransition(currentStatus, action) {
  if (action === "start_review" && ["pending", "reviewing"].includes(currentStatus)) return "reviewing";
  if (action === "resolve" && currentStatus === "reviewing") return "resolved";
  if (action === "dismiss" && currentStatus === "reviewing") return "dismissed";
  if (action === "reopen" && ["resolved", "dismissed"].includes(currentStatus)) return "reviewing";
  if (!["start_review", "resolve", "dismiss", "reopen"].includes(action)) {
    throw httpError(400, "Unsupported report action");
  }
  throw httpError(409, `This report cannot be ${action.replaceAll("_", " ")} while it is ${currentStatus}`);
}

function safeAuditMetadata(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeAuditMetadata(item, depth + 1));
  if (typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(password|token|secret|session|access.?code|authorization|paystack.?reference)/i.test(key))
      .map(([key, item]) => [key, safeAuditMetadata(item, depth + 1)])
  );
}

async function auditTargetLabels(logs) {
  const idsByType = new Map(AUDIT_TARGET_TYPES.map((type) => [type, []]));
  for (const log of logs) idsByType.get(log.targetType)?.push(log.targetId);
  const [groups, campaigns, users, reports, pots] = await Promise.all([
    Group.find({ _id: { $in: idsByType.get("group") } }).select("name").lean(),
    Campaign.find({ _id: { $in: idsByType.get("campaign") } }).select("title").lean(),
    User.find({ _id: { $in: idsByType.get("user") } }).select("fullName").lean(),
    UserReport.find({ _id: { $in: idsByType.get("user_report") } }).select("reason").lean(),
    SavingsPot.find({ _id: { $in: idsByType.get("savings_pot") } }).select("name").lean(),
  ]);
  return new Map([
    ...groups.map((item) => [`group:${item._id}`, item.name]),
    ...campaigns.map((item) => [`campaign:${item._id}`, item.title]),
    ...users.map((item) => [`user:${item._id}`, item.fullName]),
    ...reports.map((item) => [`user_report:${item._id}`, `${item.reason.replaceAll("_", " ")} report`]),
    ...pots.map((item) => [`savings_pot:${item._id}`, item.name]),
  ]);
}

export async function getAdminOverview(_req, res, next) {
  try {
    const [
      users,
      activeGroups,
      activeCampaigns,
      flaggedCampaigns,
      openReports,
      overduePayouts,
      contributionVolume,
      donationVolume,
      kycRows,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Group.countDocuments({ status: "active" }),
      Campaign.countDocuments({ status: "active" }),
      Campaign.countDocuments({ status: "flagged" }),
      UserReport.countDocuments({ status: { $in: ["pending", "reviewing"] } }),
      Payout.countDocuments({ status: "scheduled", fundingStatus: "overdue" }),
      Contribution.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Donation.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      User.aggregate([
        { $match: { role: "user" } },
        {
          $group: {
            _id: { $ifNull: ["$identityVerification.status", "not_started"] },
            count: { $sum: 1 },
          },
        },
      ]),
      User.find({ role: "user" })
        .select(ADMIN_USER_FIELDS)
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ]);

    const kyc = Object.fromEntries(kycRows.map((row) => [row._id, row.count]));
    return res.json({
      success: true,
      data: {
        metrics: {
          users,
          activeGroups,
          activeCampaigns,
          moneyMoved: (contributionVolume[0]?.total || 0) + (donationVolume[0]?.total || 0),
        },
        attention: {
          kycInReview: kyc.in_review || 0,
          kycNotStarted: kyc.not_started || 0,
          overduePayouts,
          flaggedCampaigns,
          openReports,
        },
        kyc,
        recentUsers,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function listAdminUsers(req, res, next) {
  try {
    const search = String(req.query.search || "").trim().slice(0, 100);
    const kycStatus = String(req.query.kycStatus || "").trim();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const query = { role: "user" };

    if (search) {
      const pattern = new RegExp(escapedRegex(search), "i");
      query.$or = [{ fullName: pattern }, { email: pattern }, { phone: pattern }];
    }
    if (KYC_STATUSES.includes(kycStatus)) {
      query["identityVerification.status"] = kycStatus;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select(ADMIN_USER_FIELDS)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    return res.json({ success: true, data: { users, total, page, limit } });
  } catch (error) {
    return next(error);
  }
}

export async function listKycReviewQueue(_req, res, next) {
  try {
    const users = await User.find({
      role: "user",
      "identityVerification.status": { $in: REVIEW_QUEUE_STATUSES },
    })
      .select(ADMIN_USER_FIELDS)
      .sort({ "identityVerification.submittedAt": 1, createdAt: 1 })
      .limit(100)
      .lean();
    return res.json({ success: true, data: { users, total: users.length } });
  } catch (error) {
    return next(error);
  }
}

export async function getAdminUser(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid member identifier" });
    }
    const userId = new mongoose.Types.ObjectId(req.params.id);
    const user = await User.findOne({ _id: userId, role: "user" })
      .select(ADMIN_USER_FIELDS)
      .lean();
    if (!user) return res.status(404).json({ success: false, message: "Member not found" });

    const [
      memberships,
      campaigns,
      contributionStats,
      donationStats,
      activeSavingsPots,
      openDelinquencies,
      openReports,
      recentTransactions,
      hasKycSession,
    ] = await Promise.all([
      GroupMember.find({ userId, status: "active" })
        .select("role joinedAt lastContributionStatus totalContributed")
        .populate("groupId", "name type status contribution")
        .sort({ joinedAt: -1 })
        .lean(),
      Campaign.find({ creatorId: userId })
        .select("title status raisedAmount goalAmount deadline createdAt")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Contribution.aggregate([
        { $match: { userId, status: "paid" } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
      ]),
      Donation.aggregate([
        { $match: { donorId: userId, status: "completed" } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
      ]),
      SavingsPot.countDocuments({ userId, status: "active" }),
      GroupDelinquency.countDocuments({ userId, status: { $in: ["open", "extended"] } }),
      UserReport.countDocuments({ reportedUserId: userId, status: { $in: ["pending", "reviewing"] } }),
      WalletTransaction.find({ userId })
        .select("type amount currency status channel completedAt createdAt")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      User.exists({ _id: userId, "identityVerification.sessionId": { $nin: ["", null] } }),
    ]);

    return res.json({
      success: true,
      data: {
        user,
        metrics: {
          groups: memberships.length,
          contributions: contributionStats[0]?.count || 0,
          contributedAmount: contributionStats[0]?.total || 0,
          donations: donationStats[0]?.count || 0,
          donatedAmount: donationStats[0]?.total || 0,
          activeSavingsPots,
          openDelinquencies,
          openReports,
        },
        memberships,
        campaigns,
        recentTransactions,
        canReconcileKyc: Boolean(
          hasKycSession && REVIEW_QUEUE_STATUSES.includes(user.identityVerification?.status)
        ),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function reconcileAdminUserKyc(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid member identifier" });
    }
    const user = await User.findOne({ _id: req.params.id, role: "user" });
    if (!user) return res.status(404).json({ success: false, message: "Member not found" });
    const sessionId = user.identityVerification?.sessionId;
    if (!sessionId) {
      return res.status(409).json({
        success: false,
        message: "This member has no provider session to refresh",
      });
    }

    const previousStatus = user.identityVerification.status;
    const decision = await retrieveVerificationDecision(sessionId);
    const status = await applyVerificationDecision(user, decision);
    await audit({
      actorId: req.user._id,
      action: "admin.identity_verification_reconciled",
      targetType: "user",
      targetId: user._id,
      metadata: { provider: "didit", previousStatus, status },
    });
    return res.json({
      success: true,
      message: status === previousStatus
        ? "Verification status is already current"
        : `Verification status updated to ${status}`,
      data: { status, previousStatus },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
}

export async function listAdminGroups(req, res, next) {
  try {
    const search = String(req.query.search || "").trim().slice(0, 100);
    const status = String(req.query.status || "").trim();
    const query = {};
    if (search) query.name = new RegExp(escapedRegex(search), "i");
    if (["setup", "active", "paused", "completed", "archived"].includes(status)) {
      query.status = status;
    }
    const groups = await Group.find(query)
      .select("name type coverImageUrl status memberCount expectedMemberCount totalPot contribution isPublic ownerId createdAt updatedAt")
      .populate("ownerId", "fullName avatarUrl")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    const groupIds = groups.map((group) => group._id);
    const payoutRows = groupIds.length ? await Payout.aggregate([
      { $match: { groupId: { $in: groupIds }, status: { $in: ["scheduled", "processing", "failed"] } } },
      {
        $group: {
          _id: "$groupId",
          attentionCount: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ["$fundingStatus", "overdue"] }, { $eq: ["$status", "failed"] }] },
                1,
                0,
              ],
            },
          },
          nextPayoutDate: { $min: "$scheduledDate" },
        },
      },
    ]) : [];
    const payoutByGroup = new Map(payoutRows.map((row) => [String(row._id), row]));
    const items = groups.map((group) => ({
      ...group,
      attentionCount: payoutByGroup.get(String(group._id))?.attentionCount || 0,
      nextPayoutDate: payoutByGroup.get(String(group._id))?.nextPayoutDate || null,
    }));
    return res.json({ success: true, data: { groups: items, total: items.length } });
  } catch (error) {
    return next(error);
  }
}

export async function getAdminGroup(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid group identifier" });
    }
    const groupId = new mongoose.Types.ObjectId(req.params.id);
    const group = await Group.findById(groupId)
      .select("name description type coverImageUrl status memberCount expectedMemberCount totalPot contribution isPublic ownerId createdAt updatedAt")
      .populate("ownerId", "fullName avatarUrl identityVerification.status")
      .lean();
    if (!group) return res.status(404).json({ success: false, message: "Group not found" });

    const [members, payouts, delinquencies, resolutions, contributionRows] = await Promise.all([
      GroupMember.find({ groupId })
        .select("role status joinedAt lastContributionStatus totalContributed payoutPosition")
        .populate("userId", "fullName avatarUrl isActive identityVerification.status")
        .sort({ payoutPosition: 1, joinedAt: 1 })
        .lean(),
      Payout.find({ groupId })
        .select("cycleNumber rotationRound amount scheduledDate fundingStatus graceEndsAt status paidAt closureReason createdAt")
        .populate("recipientId", "fullName avatarUrl")
        .sort({ cycleNumber: -1 })
        .limit(12)
        .lean(),
      GroupDelinquency.find({ groupId, status: { $in: ["open", "extended"] } })
        .select("cycleNumber amountDue liabilityType dueDate graceEndsAt status createdAt")
        .populate("userId", "fullName avatarUrl")
        .sort({ createdAt: -1 })
        .lean(),
      GroupResolution.find({ groupId })
        .select("type status requiredYesVotes proposedPayoutAmount originalPayoutAmount attemptNumber votes expiresAt decidedAt createdAt")
        .populate("createdBy", "fullName")
        .populate("recipientId", "fullName")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Contribution.aggregate([
        { $match: { groupId } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
          },
        },
      ]),
    ]);
    const contributions = Object.fromEntries(contributionRows.map((row) => [row._id, { count: row.count, amount: row.amount }]));
    return res.json({
      success: true,
      data: {
        group,
        members,
        payouts,
        delinquencies,
        resolutions,
        contributions,
        metrics: {
          activeMembers: members.filter((member) => member.status === "active").length,
          completedPayouts: payouts.filter((payout) => payout.status === "completed").length,
          openDelinquencies: delinquencies.length,
          activeVotes: resolutions.filter((resolution) => resolution.status === "voting").length,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function listAdminCampaigns(req, res, next) {
  try {
    const search = String(req.query.search || "").trim().slice(0, 100);
    const status = String(req.query.status || "").trim();
    const query = {};
    if (search) query.title = new RegExp(escapedRegex(search), "i");
    if (["active", "completed", "closed", "flagged"].includes(status)) query.status = status;
    const campaigns = await Campaign.find(query)
      .select("title category coverImageUrl goalAmount raisedAmount donorCount deadline isPublic status creatorId createdAt updatedAt")
      .populate("creatorId", "fullName avatarUrl identityVerification.status")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, data: { campaigns, total: campaigns.length } });
  } catch (error) {
    return next(error);
  }
}

export async function getAdminCampaign(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid campaign identifier" });
    }
    const campaignId = new mongoose.Types.ObjectId(req.params.id);
    const campaign = await Campaign.findById(campaignId)
      .select("title description category coverImageUrl goalAmount raisedAmount donorCount deadline isPublic allowAnonymousDonations status moderation shareSlug creatorId createdAt updatedAt")
      .populate("creatorId", "fullName avatarUrl isActive identityVerification.status createdAt")
      .populate("moderation.flaggedBy", "fullName")
      .populate("moderation.restoredBy", "fullName")
      .lean();
    if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" });

    const [donations, donationRows, updates, commentCount] = await Promise.all([
      Donation.find({ campaignId })
        .select("donorId isAnonymous displayName amount message paymentMethod paidAt status createdAt")
        .populate("donorId", "fullName avatarUrl")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Donation.aggregate([
        { $match: { campaignId } },
        { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
      CampaignUpdate.find({ campaignId })
        .select("content createdAt")
        .populate("authorId", "fullName avatarUrl")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      CampaignComment.countDocuments({ campaignId }),
    ]);
    const donationStats = Object.fromEntries(donationRows.map((row) => [row._id, { count: row.count, amount: row.amount }]));
    return res.json({
      success: true,
      data: {
        campaign,
        donations,
        updates,
        donationStats,
        metrics: {
          progress: campaign.goalAmount > 0 ? Math.min(campaign.raisedAmount / campaign.goalAmount, 1) : 0,
          comments: commentCount,
          completedDonations: donationStats.completed?.count || 0,
          failedDonations: donationStats.failed?.count || 0,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function moderateAdminCampaign(req, res, next) {
  let session;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid campaign identifier" });
    }
    const action = String(req.body.action || "").trim().toLowerCase();
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 10 || reason.length > 300) {
      return res.status(400).json({ success: false, message: "Give a reason between 10 and 300 characters" });
    }

    session = await mongoose.startSession();
    let updatedCampaign;
    await session.withTransaction(async () => {
      const campaign = await Campaign.findById(req.params.id).session(session);
      if (!campaign) throw httpError(404, "Campaign not found");
      const previousStatus = campaign.status;
      const status = campaignModerationTransition(previousStatus, action);
      const now = new Date();

      campaign.status = status;
      if (action === "flag") {
        campaign.moderation = {
          previousStatus,
          flagReason: reason,
          flaggedAt: now,
          flaggedBy: req.user._id,
          restoreReason: "",
          restoredAt: null,
          restoredBy: null,
        };
      } else {
        campaign.moderation.restoreReason = reason;
        campaign.moderation.restoredAt = now;
        campaign.moderation.restoredBy = req.user._id;
      }
      await campaign.save({ session });

      await Notification.create([{
        userId: campaign.creatorId,
        type: "campaign_moderation",
        title: action === "flag" ? "Campaign temporarily unavailable" : "Campaign restored",
        body: action === "flag"
          ? `Your campaign \"${campaign.title}\" has been flagged for review. Reason: ${reason}`
          : `Your campaign \"${campaign.title}\" is active again. Note: ${reason}`,
        relatedCampaignId: campaign._id,
      }], { session });
      await audit({
        actorId: req.user._id,
        action: action === "flag" ? "admin.campaign_flagged" : "admin.campaign_restored",
        targetType: "campaign",
        targetId: campaign._id,
        metadata: { reason, previousStatus, status },
        session,
      });
      updatedCampaign = campaign;
    });

    await updatedCampaign.populate([
      { path: "creatorId", select: "fullName avatarUrl isActive identityVerification.status createdAt" },
      { path: "moderation.flaggedBy", select: "fullName" },
      { path: "moderation.restoredBy", select: "fullName" },
    ]);
    return res.json({
      success: true,
      message: action === "flag" ? "Campaign flagged and creator notified" : "Campaign restored and creator notified",
      data: { campaign: updatedCampaign },
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

export async function listAdminReports(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 40));
    const status = String(req.query.status || "open").trim();
    const reason = String(req.query.reason || "").trim();
    const targetType = String(req.query.targetType || "").trim();
    const query = {};
    if (status === "open") query.status = { $in: ["pending", "reviewing"] };
    else if (REPORT_STATUSES.includes(status)) query.status = status;
    if (REPORT_REASONS.includes(reason)) query.reason = reason;
    if (targetType === "member") query.$or = [{ targetType: "member" }, { targetType: { $exists: false } }];
    else if (REPORT_TARGET_TYPES.includes(targetType)) query.targetType = targetType;

    const [reports, total, statusRows] = await Promise.all([
      UserReport.find(query)
        .select("-internalNotes -decisions")
        .populate("reporterId", "fullName email avatarUrl isActive")
        .populate("reportedUserId", "fullName email avatarUrl isActive identityVerification.status")
        .populate({ path: "reportedCampaignId", select: "title category coverImageUrl status creatorId", populate: { path: "creatorId", select: "fullName avatarUrl" } })
        .populate("assignedTo", "fullName avatarUrl")
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserReport.countDocuments(query),
      UserReport.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
    return res.json({
      success: true,
      data: {
        reports: reports.map((report) => ({
          ...report,
          targetType: report.targetType || (report.reportedCampaignId ? "campaign" : "member"),
        })),
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        counts: {
          pending: counts.pending || 0,
          reviewing: counts.reviewing || 0,
          resolved: counts.resolved || 0,
          dismissed: counts.dismissed || 0,
          open: (counts.pending || 0) + (counts.reviewing || 0),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getAdminReport(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid report identifier" });
    }
    const report = await UserReport.findById(req.params.id)
      .populate("reporterId", "fullName email avatarUrl isActive createdAt")
      .populate("reportedUserId", "fullName email avatarUrl isActive identityVerification.status createdAt")
      .populate({ path: "reportedCampaignId", select: "title category coverImageUrl status creatorId createdAt", populate: { path: "creatorId", select: "fullName avatarUrl" } })
      .populate("assignedTo", "fullName avatarUrl")
      .populate("resolvedBy", "fullName avatarUrl")
      .populate("internalNotes.authorId", "fullName avatarUrl")
      .populate("decisions.authorId", "fullName avatarUrl")
      .lean();
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    return res.json({
      success: true,
      data: { report: { ...report, targetType: report.targetType || (report.reportedCampaignId ? "campaign" : "member") } },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateAdminReport(req, res, next) {
  let session;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid report identifier" });
    }
    const action = String(req.body.action || "").trim().toLowerCase();
    const summary = String(req.body.summary || "").trim();
    if (["resolve", "dismiss", "reopen"].includes(action) && (summary.length < 10 || summary.length > 1000)) {
      return res.status(400).json({ success: false, message: "Give an explanation between 10 and 1,000 characters" });
    }

    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const report = await UserReport.findById(req.params.id).session(session);
      if (!report) throw httpError(404, "Report not found");
      const previousStatus = report.status;
      const status = reportCaseTransition(previousStatus, action);
      if (
        previousStatus === "reviewing"
        && report.assignedTo
        && String(report.assignedTo) !== String(req.user._id)
        && action !== "reopen"
      ) {
        throw httpError(409, "This report is assigned to another administrator");
      }
      const now = new Date();
      report.status = status;
      if (action === "start_review" || action === "reopen") {
        report.assignedTo = req.user._id;
        report.reviewStartedAt = now;
      }
      if (action === "reopen") {
        report.decisions.push({ action: "reopened", summary, authorId: req.user._id, createdAt: now });
        report.resolutionSummary = "";
        report.resolvedAt = null;
        report.resolvedBy = null;
      }
      if (action === "resolve" || action === "dismiss") {
        report.resolutionSummary = summary;
        report.resolvedAt = now;
        report.resolvedBy = req.user._id;
        report.decisions.push({ action: action === "resolve" ? "resolved" : "dismissed", summary, authorId: req.user._id, createdAt: now });
        await Notification.create([{
          userId: report.reporterId,
          type: "report_update",
          title: "Your report has been reviewed",
          body: summary,
        }], { session });
      }
      await report.save({ session });
      await audit({
        actorId: req.user._id,
        action: `admin.user_report_${action}`,
        targetType: "user_report",
        targetId: report._id,
        metadata: { previousStatus, status, reportReason: report.reason },
        session,
      });
    });
    return getAdminReport(req, res, next);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

export async function addAdminReportNote(req, res, next) {
  let session;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid report identifier" });
    }
    const body = String(req.body.body || "").trim();
    if (body.length < 3 || body.length > 1000) {
      return res.status(400).json({ success: false, message: "Internal notes must be between 3 and 1,000 characters" });
    }
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const report = await UserReport.findById(req.params.id).session(session);
      if (!report) throw httpError(404, "Report not found");
      report.internalNotes.push({ authorId: req.user._id, body, createdAt: new Date() });
      await report.save({ session });
      await audit({
        actorId: req.user._id,
        action: "admin.user_report_note_added",
        targetType: "user_report",
        targetId: report._id,
        metadata: { noteLength: body.length, status: report.status },
        session,
      });
    });
    return getAdminReport(req, res, next);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

export async function listAdminAuditLogs(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 40));
    const targetType = String(req.query.targetType || "").trim();
    const query = AUDIT_TARGET_TYPES.includes(targetType) ? { targetType } : {};
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("actorId", "fullName email avatarUrl role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);
    const labels = await auditTargetLabels(logs);
    const items = logs.map((log) => ({
      ...log,
      metadata: safeAuditMetadata(log.metadata),
      target: {
        _id: log.targetId,
        type: log.targetType,
        label: labels.get(`${log.targetType}:${log.targetId}`) || (log.targetType === "wallet_transaction" ? "Wallet transaction" : "Deleted or unavailable record"),
      },
    }));
    return res.json({ success: true, data: { logs: items, total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    return next(error);
  }
}
