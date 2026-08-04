import mongoose from "mongoose";
import { DebtPayment } from "../models/DebtPayment.js";
import { GroupDelinquency } from "../models/GroupDelinquency.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupJoinRequest } from "../models/GroupJoinRequest.js";
import { User } from "../models/User.js";
import { UserBlock } from "../models/UserBlock.js";
import { UserAchievement } from "../models/UserAchievement.js";
import { UserReport } from "../models/UserReport.js";
import { rewardSummary, syncUserAchievements } from "../services/trustMetricsService.js";
import { audit } from "../utils/api.js";

function validUserId(value) {
  return mongoose.isValidObjectId(String(value || ""));
}

function leaderboardStart(period, now = new Date()) {
  if (period === "weekly") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "monthly") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

export async function getKasaPointsLeaderboard(req, res) {
  const period = ["weekly", "monthly", "all"].includes(req.query.period)
    ? req.query.period
    : "weekly";
  const start = leaderboardStart(period);
  await syncUserAchievements(req.user);

  const scoreMatch = start ? { earnedAt: { $gte: start } } : {};
  const scores = await UserAchievement.aggregate([
    { $match: scoreMatch },
    { $group: { _id: "$userId", points: { $sum: "$points" } } },
    { $sort: { points: -1, _id: 1 } },
    { $limit: 250 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $match: {
        "user.isActive": true,
        "user.preferences.publicProfile": { $ne: false },
        "user.preferences.showOnLeaderboard": { $ne: false },
      },
    },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        fullName: "$user.fullName",
        avatarUrl: "$user.avatarUrl",
        identityVerified: {
          $eq: ["$user.identityVerification.status", "verified"],
        },
        points: 1,
      },
    },
    { $limit: 100 },
  ]);

  const lifetimeScores = scores.length
    ? await UserAchievement.aggregate([
        { $match: { userId: { $in: scores.map((entry) => entry.userId) } } },
        { $group: { _id: "$userId", points: { $sum: "$points" } } },
      ])
    : [];
  const lifetimeByUser = new Map(
    lifetimeScores.map((entry) => [String(entry._id), entry.points])
  );
  const entries = scores.map((entry, index) => ({
    rank: index + 1,
    userId: String(entry.userId),
    fullName: entry.fullName,
    avatarUrl: entry.avatarUrl || "",
    identityVerified: entry.identityVerified,
    points: entry.points,
    tier: rewardSummary(lifetimeByUser.get(String(entry.userId)) || 0).tier,
  }));

  const currentUserEntry = entries.find(
    (entry) => entry.userId === String(req.user._id)
  );
  const currentUserLifetimePoints = await UserAchievement.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: "$userId", points: { $sum: "$points" } } },
  ]);
  const participating =
    req.user.preferences?.publicProfile !== false &&
    req.user.preferences?.showOnLeaderboard !== false;

  return res.json({
    success: true,
    data: {
      period,
      entries,
      viewer: {
        participating,
        rank: participating ? currentUserEntry?.rank || null : null,
        points: currentUserEntry?.points || 0,
        tier: rewardSummary(currentUserLifetimePoints[0]?.points || 0).tier,
      },
    },
  });
}

export async function listUserDirectory(req, res) {
  const search = String(req.query.search || "").trim();
  const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocks = await UserBlock.find({
    $or: [{ blockerId: req.user._id }, { blockedUserId: req.user._id }],
  }).select("blockerId blockedUserId").lean();
  const excludedUserIds = blocks.map((block) =>
    String(block.blockerId) === String(req.user._id) ? block.blockedUserId : block.blockerId
  );
  const filter = {
    _id: { $nin: [req.user._id, ...excludedUserIds] },
    isActive: true,
    ...(search
      ? {
          $or: [
            { fullName: { $regex: safeSearch, $options: "i" } },
            { email: { $regex: safeSearch, $options: "i" } },
          ],
        }
      : {}),
  };
  const users = await User.find(filter)
    .select("fullName avatarUrl")
    .sort({ fullName: 1 })
    .limit(30);
  return res.json({ success: true, data: users });
}

export async function getAccountStanding(req, res) {
  const [openObligations, suspendedMemberships, repaymentHistory] = await Promise.all([
    GroupDelinquency.find({
      userId: req.user._id,
      status: "open",
    })
      .populate("groupId", "name coverImageUrl")
      .populate("creditorUserId", "fullName avatarUrl")
      .sort({ createdAt: 1 }),
    GroupMember.find({
      userId: req.user._id,
      $or: [{ status: "suspended" }, { rejoinBlocked: true }],
    })
      .populate("groupId", "name coverImageUrl status")
      .sort({ suspendedAt: -1 }),
    DebtPayment.find({
      userId: req.user._id,
      status: "paid",
    })
      .populate("groupId", "name")
      .populate("creditorUserId", "fullName")
      .sort({ paidAt: -1 })
      .limit(20),
  ]);
  const outstandingAmount = openObligations.reduce(
    (sum, obligation) => sum + obligation.amountDue,
    0
  );
  return res.json({
    success: true,
    data: {
      level: openObligations.length
        ? "restricted"
        : suspendedMemberships.length
          ? "caution"
          : "good",
      canCreateOrJoinGroups: openObligations.length === 0,
      outstandingAmount,
      openObligations: openObligations.map((obligation) => ({
        _id: obligation._id,
        group: obligation.groupId,
        creditor: obligation.creditorUserId,
        cycleNumber: obligation.cycleNumber,
        amountDue: obligation.amountDue,
        dueDate: obligation.dueDate,
        liabilityType: obligation.liabilityType,
      })),
      suspendedGroups: suspendedMemberships
        .filter((membership) => membership.groupId)
        .map((membership) => ({
          _id: membership._id,
          group: membership.groupId,
          suspendedAt: membership.suspendedAt,
          reason: membership.suspensionReason,
          rejoinBlocked: membership.rejoinBlocked,
        })),
      repaymentHistory: repaymentHistory.map((payment) => ({
        _id: payment._id,
        group: payment.groupId,
        creditor: payment.creditorUserId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt,
      })),
    },
  });
}

export async function getPublicUserProfile(req, res) {
  const userId = String(req.params.id || "");
  if (!validUserId(userId)) {
    return res.status(400).json({ success: false, message: "Invalid user ID" });
  }

  const user = await User.findOne({ _id: userId, isActive: true })
    .select("fullName avatarUrl profileImage bio createdAt identityVerification.status identityVerification.verifiedAt preferences.publicProfile preferences.showProfileBio preferences.showSharedGroups")
    .lean();

  if (!user) {
    return res.status(404).json({ success: false, message: "Member not found" });
  }

  const [viewerHasBlocked, targetHasBlockedViewer, reviewableJoinRequest] = await Promise.all([
    UserBlock.exists({ blockerId: req.user._id, blockedUserId: userId }),
    UserBlock.exists({ blockerId: userId, blockedUserId: req.user._id }),
    GroupJoinRequest.exists({
      userId,
      status: "pending",
      groupId: {
        $in: await GroupMember.find({
          userId: req.user._id,
          role: "owner",
          status: "active",
        }).distinct("groupId"),
      },
    }),
  ]);
  const isOwnProfile = String(user._id) === String(req.user._id);
  if (!isOwnProfile && targetHasBlockedViewer) {
    return res.status(403).json({ success: false, message: "This profile is unavailable" });
  }

  const viewerMemberships = await GroupMember.find({
    userId: req.user._id,
    status: "active",
  }).select("groupId").lean();
  const viewerGroupIds = viewerMemberships.map((membership) => membership.groupId);

  const sharedMemberships = viewerGroupIds.length
    ? await GroupMember.find({
        userId,
        groupId: { $in: viewerGroupIds },
        status: "active",
      })
        .populate("groupId", "name type coverImageUrl status")
        .lean()
    : [];

  if (
    !isOwnProfile &&
    user.preferences?.publicProfile === false &&
    !sharedMemberships.length &&
    !reviewableJoinRequest
  ) {
    return res.status(403).json({
      success: false,
      message: "This profile is only visible to members of their groups",
    });
  }

  const canShowSharedGroups = isOwnProfile || user.preferences?.showSharedGroups !== false;
  const sharedGroups = (canShowSharedGroups ? sharedMemberships : [])
    .map((membership) => membership.groupId)
    .filter((group) => group && group.status !== "archived")
    .map((group) => ({
      _id: group._id,
      name: group.name,
      type: group.type,
      coverImageUrl: group.coverImageUrl || "",
    }));
  const { trustMetrics, achievements } = await syncUserAchievements(user);
  const publicTrustMetrics = {
    ...trustMetrics,
    activeGroupCount: canShowSharedGroups ? trustMetrics.activeGroupCount : null,
  };

  return res.json({
    success: true,
    data: {
      user: {
        _id: user._id,
        fullName: user.fullName,
        profileImage: user.avatarUrl || user.profileImage || "",
        bio: isOwnProfile || user.preferences?.showProfileBio !== false ? user.bio || "" : "",
        joinedAt: user.createdAt,
        isIdentityVerified: user.identityVerification?.status === "verified",
      },
      sharedGroups,
      sharedGroupCount: sharedGroups.length,
      isOwnProfile,
      viewerHasBlocked: Boolean(viewerHasBlocked),
      visibility: {
        bio: isOwnProfile || user.preferences?.showProfileBio !== false,
        sharedGroups: canShowSharedGroups,
      },
      trustMetrics: publicTrustMetrics,
      achievements,
    },
  });
}

export async function getPendingAchievement(req, res) {
  await syncUserAchievements(req.user);
  const achievement = await UserAchievement.findOne({
    userId: req.user._id,
    presentedAt: null,
  }).sort({ earnedAt: 1 });

  return res.json({
    success: true,
    data: achievement
      ? {
          achievementId: achievement._id,
          id: achievement.badgeId,
          title: achievement.title,
          description: achievement.description,
          points: achievement.points,
          earnedAt: achievement.earnedAt,
        }
      : null,
  });
}

export async function markAchievementPresented(req, res) {
  if (!mongoose.isValidObjectId(req.params.achievementId)) {
    return res.status(400).json({ success: false, message: "Invalid achievement" });
  }
  const achievement = await UserAchievement.findOneAndUpdate(
    { _id: req.params.achievementId, userId: req.user._id },
    { $set: { presentedAt: new Date() } },
    { new: true }
  );
  if (!achievement) {
    return res.status(404).json({ success: false, message: "Achievement not found" });
  }
  return res.json({ success: true, message: "Achievement marked as presented" });
}

export async function reportUser(req, res) {
  const userId = String(req.params.id || "");
  const reason = String(req.body.reason || "");
  const details = String(req.body.details || "").trim();
  const allowedReasons = ["scam", "harassment", "impersonation", "inappropriate", "other"];

  if (!validUserId(userId) || String(req.user._id) === userId) {
    return res.status(400).json({ success: false, message: "Invalid member" });
  }
  if (!allowedReasons.includes(reason)) {
    return res.status(400).json({ success: false, message: "Choose a valid report reason" });
  }
  if (details.length > 1000) {
    return res.status(400).json({ success: false, message: "Report details are too long" });
  }
  if (!await User.exists({ _id: userId, isActive: true })) {
    return res.status(404).json({ success: false, message: "Member not found" });
  }
  const existing = await UserReport.exists({
    reporterId: req.user._id,
    reportedUserId: userId,
    status: { $in: ["pending", "reviewing"] },
  });
  if (existing) {
    return res.status(409).json({ success: false, message: "You already have a report under review for this member" });
  }

  const report = await UserReport.create({
    reporterId: req.user._id,
    targetType: "member",
    reportedUserId: userId,
    reason,
    details,
  });
  await audit({
    actorId: req.user._id,
    action: "user.report_submitted",
    targetType: "user_report",
    targetId: report._id,
    metadata: { reason, reportedUserId: userId },
  });
  return res.status(201).json({
    success: true,
    message: "Report submitted for review",
    data: { _id: report._id, status: report.status },
  });
}

export async function blockUser(req, res) {
  const userId = String(req.params.id || "");
  if (!validUserId(userId) || String(req.user._id) === userId) {
    return res.status(400).json({ success: false, message: "Invalid member" });
  }
  if (!await User.exists({ _id: userId, isActive: true })) {
    return res.status(404).json({ success: false, message: "Member not found" });
  }
  await UserBlock.updateOne(
    { blockerId: req.user._id, blockedUserId: userId },
    { $setOnInsert: { blockerId: req.user._id, blockedUserId: userId } },
    { upsert: true }
  );
  return res.json({ success: true, message: "Member blocked" });
}

export async function unblockUser(req, res) {
  const userId = String(req.params.id || "");
  if (!validUserId(userId)) {
    return res.status(400).json({ success: false, message: "Invalid member" });
  }
  await UserBlock.deleteOne({ blockerId: req.user._id, blockedUserId: userId });
  return res.json({ success: true, message: "Member unblocked" });
}
