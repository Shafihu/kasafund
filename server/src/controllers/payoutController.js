import { Group } from "../models/Group.js";
import { GroupDelinquency } from "../models/GroupDelinquency.js";
import { GroupMember } from "../models/GroupMember.js";
import { Notification } from "../models/Notification.js";
import { Payout } from "../models/Payout.js";
import { User } from "../models/User.js";
import { nowForGroup } from "../services/developmentClockService.js";
import { processPayout } from "../services/payoutProcessorService.js";
import { endOfScheduledDayUtc } from "../services/payoutReadinessService.js";
import { audit } from "../utils/api.js";

async function canManage(groupId, userId) {
  return GroupMember.exists({ groupId, userId, status: "active", role: { $in: ["owner", "treasurer"] } });
}

export async function schedulePayout(req, res) {
  if (!(await canManage(req.params.groupId, req.user._id))) return res.status(403).json({ success: false, message: "Owner or treasurer permission required" });
  const group = await Group.findById(req.params.groupId);
  if (!group) return res.status(404).json({ success: false, message: "Group not found" });
  if (group.savingModel === "collective_goal") {
    return res.status(409).json({
      success: false,
      message: "Collective-goal payouts must be proposed and approved by member vote",
    });
  }
  const recipient = await GroupMember.findOne({ groupId: group._id, userId: req.body.recipientId, status: "active" });
  if (!recipient) return res.status(400).json({ success: false, message: "Recipient must be an active member" });
  if ((group.rotation.completedRecipientIds || []).some(
    (userId) => String(userId) === String(recipient.userId)
  )) {
    return res.status(409).json({
      success: false,
      message: "This member has already received a payout in the current rotation round",
    });
  }
  if (await Payout.exists({ groupId: group._id, status: { $in: ["scheduled", "processing"] } })) {
    return res.status(409).json({
      success: false,
      message: "This group already has an active payout schedule",
    });
  }
  const activeMembers = await GroupMember.find({
    groupId: group._id,
    status: "active",
  }).select("userId");
  const scheduledDate = new Date(req.body.scheduledDate);
  if (Number.isNaN(scheduledDate.getTime())) {
    return res.status(400).json({ success: false, message: "A valid payout date is required" });
  }
  const payout = await Payout.create({
    groupId: group._id,
    recipientId: recipient.userId,
    cycleNumber: req.body.cycleNumber,
    rotationRound: Math.max(group.rotation.roundNumber || 1, 1),
    amount: group.contribution.amount * activeMembers.length,
    contributionAmount: group.contribution.amount,
    expectedContributorIds: activeMembers.map((member) => member.userId),
    snapshotLockedAt: new Date(),
    scheduledDate,
    graceEndsAt: endOfScheduledDayUtc(
      scheduledDate,
      group.contribution.gracePeriodDays
    ),
  });
  const recipientUser = await User.findById(recipient.userId).select("preferences.payoutNotifications");
  if (recipientUser?.preferences?.payoutNotifications !== false) {
    await Notification.create({ userId: recipient.userId, type: "payout_scheduled", title: "Payout scheduled", body: "A group payout has been scheduled for you", relatedGroupId: group._id });
  }
  await audit({ actorId: req.user._id, action: "group.payout_scheduled", targetType: "group", targetId: group._id, metadata: { payoutId: payout._id } });
  return res.status(201).json({ success: true, data: payout });
}

export async function updatePayout(req, res) {
  const payout = await Payout.findById(req.params.payoutId);
  if (!payout) return res.status(404).json({ success: false, message: "Payout not found" });
  if (!(await canManage(payout.groupId, req.user._id))) return res.status(403).json({ success: false, message: "Owner or treasurer permission required" });
  if (!["completed", "failed"].includes(req.body.status)) return res.status(400).json({ success: false, message: "Invalid payout status" });
  if (req.body.status === "completed") {
    const result = await processPayout(payout._id, {
      requireDayEnded: false,
      actorId: req.user._id,
    });
    if (!result.processed) {
      return res.status([
        "insufficient_group_pot",
        "recipient_already_paid",
        "missing_contributions",
        "within_grace_period",
      ].includes(result.reason) ? 409 : 400).json({
        success: false,
        message:
          result.reason === "insufficient_group_pot"
            ? "The group pot does not have enough funds for this payout"
            : result.reason === "missing_contributions"
              ? `${result.readiness?.missingCount || "Some"} member contributions are overdue`
              : result.reason === "within_grace_period"
                ? `Waiting for ${result.readiness?.missingCount || "member"} contributions`
            : result.reason === "recipient_already_paid"
              ? "This member has already received a payout in the current rotation round"
              : "This payout is no longer available",
      });
    }
    return res.json({ success: true, data: result.payout });
  }
  payout.status = req.body.status;
  payout.paidAt = null;
  await payout.save();
  await audit({ actorId: req.user._id, action: `group.payout_${payout.status}`, targetType: "group", targetId: payout.groupId, metadata: { payoutId: payout._id } });
  return res.json({ success: true, data: payout });
}

export async function extendPayoutGrace(req, res) {
  const payout = await Payout.findOne({
    _id: req.params.payoutId,
    groupId: req.params.groupId,
    status: "scheduled",
  });
  if (!payout) {
    return res.status(404).json({ success: false, message: "Active payout not found" });
  }
  if (!(await canManage(payout.groupId, req.user._id))) {
    return res.status(403).json({
      success: false,
      message: "Owner or treasurer permission required",
    });
  }
  const days = Number(req.body.days);
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    return res.status(400).json({
      success: false,
      message: "Choose an extension between 1 and 7 days",
    });
  }

  const now = nowForGroup(payout.groupId);
  const graceEndsAt = new Date(now.getTime() + days * 86_400_000);
  const extendedPayout = await Payout.findOneAndUpdate(
    {
      _id: payout._id,
      status: "scheduled",
      $or: [
        { graceExtensionCount: { $exists: false } },
        { graceExtensionCount: { $lt: 1 } },
      ],
    },
    {
      $set: {
        graceEndsAt,
        lastGraceExtensionAt: now,
        fundingStatus: "awaiting",
        fundingStatusUpdatedAt: now,
        overdueNotifiedAt: null,
      },
      $inc: { graceExtensionCount: 1 },
    },
    { new: true }
  );
  if (!extendedPayout) {
    return res.status(409).json({
      success: false,
      message: "The grace period has already been extended for this cycle",
    });
  }

  await GroupDelinquency.updateMany(
    { payoutId: extendedPayout._id, status: "open" },
    { $set: { status: "extended", resolvedAt: now } }
  );
  const group = await Group.findById(payout.groupId).select("name");
  const members = await GroupMember.find({
    groupId: payout.groupId,
    status: "active",
  }).select("userId");
  if (members.length) {
    await Notification.insertMany(members.map((member) => ({
      userId: member.userId,
      type: "payment_due",
      title: "Contribution deadline extended",
      body: `${group?.name || "Your group"} has added ${days} ${
        days === 1 ? "day" : "days"
      } to the current contribution deadline.`,
      relatedGroupId: payout.groupId,
    })));
  }
  await audit({
    actorId: req.user._id,
    action: "group.payout_grace_extended",
    targetType: "group",
    targetId: payout.groupId,
    metadata: { payoutId: extendedPayout._id, days, graceEndsAt },
  });
  return res.json({
    success: true,
    message: `Grace period extended by ${days} ${days === 1 ? "day" : "days"}`,
    data: extendedPayout,
  });
}
