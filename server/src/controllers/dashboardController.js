import { Contribution } from "../models/Contribution.js";
import { GroupMember } from "../models/GroupMember.js";
import { Notification } from "../models/Notification.js";
import { Payout } from "../models/Payout.js";

function scheduledCycle(contribution, now = new Date()) {
  const start = new Date(contribution.startDate);
  if (start > now) return { cycleNumber: 1, dueDate: start };

  if (contribution.frequency === "daily") {
    const elapsedDays = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + elapsedDays);
    return { cycleNumber: elapsedDays + 1, dueDate };
  }

  if (contribution.frequency === "weekly") {
    const elapsedWeeks = Math.floor((now.getTime() - start.getTime()) / (7 * 86_400_000));
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + elapsedWeeks * 7);
    return { cycleNumber: elapsedWeeks + 1, dueDate };
  }

  const elapsedMonths = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      now.getMonth() -
      start.getMonth() -
      (now.getDate() < start.getDate() ? 1 : 0)
  );
  const dueDate = new Date(start);
  dueDate.setMonth(start.getMonth() + elapsedMonths);
  return { cycleNumber: elapsedMonths + 1, dueDate };
}

export async function getDashboard(req, res) {
  const memberships = await GroupMember.find({
    userId: req.user._id,
    status: "active",
  }).populate({
    path: "groupId",
    match: { status: { $ne: "archived" } },
  });
  const activeMemberships = memberships.filter((item) => item.groupId);
  const groupIds = activeMemberships.map((item) => item.groupId._id);

  const [groupMembers, userContributions, payouts, scheduledPayouts, unreadCount] =
    await Promise.all([
      GroupMember.find({ groupId: { $in: groupIds }, status: "active" })
        .populate("userId", "fullName")
        .sort({ joinedAt: 1 }),
      Contribution.find({ userId: req.user._id })
        .populate("groupId", "name")
        .sort({ createdAt: -1 })
        .limit(30),
      Payout.find({ recipientId: req.user._id })
        .populate("groupId", "name")
        .sort({ createdAt: -1 })
        .limit(20),
      Payout.find({
        groupId: { $in: groupIds },
        status: "scheduled",
      }).sort({ scheduledDate: 1 }),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);

  const nextPayoutByGroup = new Map();
  for (const payout of scheduledPayouts) {
    const key = String(payout.groupId);
    if (!nextPayoutByGroup.has(key)) {
      nextPayoutByGroup.set(key, payout);
    }
  }

  const membersByGroup = new Map();
  for (const member of groupMembers) {
    const key = String(member.groupId);
    const names = membersByGroup.get(key) || [];
    if (member.userId?.fullName) names.push(member.userId.fullName);
    membersByGroup.set(key, names);
  }

  const groups = activeMemberships.map((membership) => {
    const group = membership.groupId;
    const target = group.contribution.amount * Math.max(group.memberCount, 1);
    return {
      id: group.id,
      name: group.name,
      type: group.type,
      status: group.status,
      coverImageUrl: group.coverImageUrl,
      progress: target > 0 ? Math.min(group.totalPot / target, 1) : 0,
      memberNames: membersByGroup.get(group.id) || [],
      memberCount: group.memberCount,
      totalPot: group.totalPot,
      contributionAmount: group.contribution.amount,
      frequency: group.contribution.frequency,
      nextPayoutDate: nextPayoutByGroup.get(group.id)?.scheduledDate || null,
    };
  });

  const contributionByGroupAndCycle = new Map(
    userContributions.map((item) => [
      `${item.groupId?._id || item.groupId}:${item.cycleNumber}`,
      item,
    ])
  );
  const dueSoon = activeMemberships
    .filter((membership) => membership.groupId.status === "active")
    .map((membership) => {
      const group = membership.groupId;
      const scheduledPayout = nextPayoutByGroup.get(group.id);
      const schedule = scheduledPayout
        ? {
            cycleNumber: scheduledPayout.cycleNumber,
            dueDate: scheduledPayout.scheduledDate,
          }
        : scheduledCycle(group.contribution);
      const current = contributionByGroupAndCycle.get(
        `${group.id}:${schedule.cycleNumber}`
      );
      if (current?.status === "paid") return null;
      return {
        id: `${group.id}-${schedule.cycleNumber}`,
        groupId: group.id,
        groupName: group.name,
        amount: group.contribution.amount,
        frequency: group.contribution.frequency,
        cycleNumber: schedule.cycleNumber,
        dueDate: schedule.dueDate,
        status: current?.status || "pending",
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  const contributionActivity = userContributions.map((item) => ({
    id: item.id,
    type: "contribution",
    groupId: item.groupId?._id,
    description: `Contribution to ${item.groupId?.name || "group"}`,
    amount: item.amount,
    occurredAt: item.paidAt || item.createdAt,
    status: item.status,
  }));
  const payoutActivity = payouts.map((item) => ({
    id: item.id,
    type: "payout",
    groupId: item.groupId?._id,
    description: `Payout from ${item.groupId?.name || "group"}`,
    amount: item.amount,
    occurredAt: item.paidAt || item.createdAt,
    status: item.status,
  }));
  const recentActivity = [...contributionActivity, ...payoutActivity]
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
    .slice(0, 8);

  return res.json({
    success: true,
    data: {
      walletBalance: req.user.walletBalance,
      unreadNotificationCount: unreadCount,
      dueSoon,
      groups: groups.slice(0, 5),
      recentActivity,
    },
  });
}
