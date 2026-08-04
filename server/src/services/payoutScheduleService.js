import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { Payout } from "../models/Payout.js";
import { Contribution } from "../models/Contribution.js";
import { endOfScheduledDayUtc } from "./payoutReadinessService.js";

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function payoutDate(startDate, frequency, cycleNumber) {
  const date = new Date(startDate);
  const intervals = Math.max(0, cycleNumber - 1);

  if (frequency === "daily") date.setUTCDate(date.getUTCDate() + intervals);
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + intervals * 7);
  if (frequency === "monthly") date.setUTCMonth(date.getUTCMonth() + intervals);

  return date;
}

export function defaultFirstPayoutDate(frequency, from = new Date()) {
  const date = new Date(from);

  if (frequency === "daily") date.setUTCDate(date.getUTCDate() + 1);
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (frequency === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);

  return date;
}

function memberId(value) {
  return String(value?._id || value);
}

function uniqueActiveOrder(order, activeIds) {
  const seen = new Set();
  return (order || []).filter((userId) => {
    const id = memberId(userId);
    if (!activeIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function uniqueIds(values) {
  const seen = new Set();
  return (values || []).filter((value) => {
    const id = memberId(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function appendMissingMembers(order, activeMembers) {
  const seen = new Set(order.map(memberId));
  return [
    ...order,
    ...activeMembers
      .map((member) => member.userId)
      .filter((userId) => !seen.has(memberId(userId))),
  ];
}

function sameOrder(left, right) {
  return left.length === right.length && left.every(
    (userId, index) => memberId(userId) === memberId(right[index])
  );
}

async function syncPayoutPositions(groupId, order, session) {
  if (!order.length) return;
  await GroupMember.bulkWrite(
    order.map((userId, payoutPosition) => ({
      updateOne: {
        filter: { groupId, userId, status: "active" },
        update: { $set: { payoutPosition } },
      },
    })),
    session ? { session } : undefined
  );
}

/**
 * Keeps one upcoming payout aligned with the group's current rotation.
 * This also backfills groups created before automatic payout scheduling existed.
 */
export async function ensureNextPayout(groupId, { session = null } = {}) {
  const group = await withSession(Group.findById(groupId), session);
  if (!group || group.status !== "active" || !group.rotation?.isEnabled) return null;

  const activeMembers = await withSession(
    GroupMember.find({ groupId: group._id, status: "active" }).select("userId"),
    session
  );
  const activeIds = new Set(activeMembers.map((member) => String(member.userId)));
  let order = uniqueActiveOrder(group.rotation.order, activeIds);
  let completedIds = uniqueIds(group.rotation.completedRecipientIds);
  let pendingOrder = uniqueActiveOrder(group.rotation.pendingOrder, activeIds);
  let rotationChanged = false;

  // Backfill rotation progress for groups created before round snapshots existed.
  if (!completedIds.length && (group.rotation.currentPositionIndex || 0) > 0) {
    completedIds = order.slice(0, group.rotation.currentPositionIndex);
    rotationChanged = true;
  }

  if (!completedIds.length) {
    const completeOrder = appendMissingMembers(order, activeMembers);
    if (!sameOrder(order, completeOrder)) rotationChanged = true;
    order = completeOrder;
  }
  if (pendingOrder.length) {
    const completePendingOrder = appendMissingMembers(pendingOrder, activeMembers);
    if (!sameOrder(pendingOrder, completePendingOrder)) rotationChanged = true;
    pendingOrder = completePendingOrder;
  }
  if (!order.length) return null;

  const completedSet = new Set(completedIds.map(memberId));
  let remainingRecipients = order.filter((userId) => !completedSet.has(memberId(userId)));

  if (!remainingRecipients.length) {
    order = appendMissingMembers(pendingOrder.length ? pendingOrder : order, activeMembers);
    pendingOrder = [];
    completedIds = [];
    remainingRecipients = order;
    group.rotation.roundNumber = Math.max(group.rotation.roundNumber || 1, 1) + 1;
    group.rotation.cycleStartedAt = new Date();
    rotationChanged = true;
    await syncPayoutPositions(group._id, order, session);
  }

  const currentIndex = Math.max(
    order.findIndex((userId) => memberId(userId) === memberId(remainingRecipients[0])),
    0
  );
  if (
    !sameOrder(group.rotation.order || [], order) ||
    !sameOrder(group.rotation.pendingOrder || [], pendingOrder) ||
    !sameOrder(group.rotation.completedRecipientIds || [], completedIds) ||
    group.rotation.currentPositionIndex !== currentIndex
  ) {
    rotationChanged = true;
  }

  if (rotationChanged) {
    group.rotation.order = order;
    group.rotation.pendingOrder = pendingOrder;
    group.rotation.completedRecipientIds = completedIds;
    group.rotation.currentPositionIndex = currentIndex;
    group.rotation.roundNumber = Math.max(group.rotation.roundNumber || 1, 1);
    await group.save(session ? { session } : undefined);
  }

  const scheduledQuery = Payout.findOne({ groupId: group._id, status: "scheduled" })
    .sort({ cycleNumber: 1 });
  const latestQuery = Payout.findOne({ groupId: group._id }).sort({ cycleNumber: -1 });
  const scheduled = await withSession(scheduledQuery, session);
  const latest = await withSession(latestQuery, session);

  const cycleNumber = scheduled?.cycleNumber || (latest?.cycleNumber || 0) + 1;
  if (scheduled) {
    let changed = false;
    const contributionStarted = scheduled.snapshotLockedAt
      ? true
      : Boolean(await withSession(
          Contribution.exists({
            groupId: group._id,
            cycleNumber: scheduled.cycleNumber,
            status: { $in: ["pending", "paid"] },
          }),
          session
        ));
    if (contributionStarted && !scheduled.snapshotLockedAt) {
      scheduled.snapshotLockedAt = new Date();
      changed = true;
    }
    if (!scheduled.expectedContributorIds?.length) {
      scheduled.expectedContributorIds = activeMembers.map((member) => member.userId);
      scheduled.contributionAmount = group.contribution.amount;
      scheduled.amount = group.contribution.amount * activeMembers.length;
      changed = true;
    }
    if (!contributionStarted) {
      scheduled.recipientId = remainingRecipients[0];
      scheduled.rotationRound = Math.max(group.rotation.roundNumber || 1, 1);
      scheduled.contributionAmount = group.contribution.amount;
      scheduled.expectedContributorIds = activeMembers.map((member) => member.userId);
      scheduled.amount = group.contribution.amount * activeMembers.length;
      scheduled.scheduledDate = payoutDate(
        group.contribution.startDate,
        group.contribution.frequency,
        scheduled.cycleNumber
      );
      scheduled.graceEndsAt = endOfScheduledDayUtc(
        scheduled.scheduledDate,
        group.contribution.gracePeriodDays
      );
      changed = true;
    }
    if (!scheduled.contributionAmount) {
      scheduled.contributionAmount = group.contribution.amount;
      changed = true;
    }
    if (!scheduled.graceEndsAt) {
      scheduled.graceEndsAt = endOfScheduledDayUtc(
        scheduled.scheduledDate,
        group.contribution.gracePeriodDays
      );
      changed = true;
    }
    if (changed) await scheduled.save(session ? { session } : undefined);
    return scheduled;
  }

  const scheduledDate = payoutDate(
    group.contribution.startDate,
    group.contribution.frequency,
    cycleNumber
  );
  const values = {
    recipientId: remainingRecipients[0],
    rotationRound: Math.max(group.rotation.roundNumber || 1, 1),
    amount: group.contribution.amount * activeMembers.length,
    contributionAmount: group.contribution.amount,
    expectedContributorIds: activeMembers.map((member) => member.userId),
    snapshotLockedAt: null,
    scheduledDate,
    graceEndsAt: endOfScheduledDayUtc(
      scheduledDate,
      group.contribution.gracePeriodDays
    ),
  };

  if (session) {
    const [created] = await Payout.create(
      [{ groupId: group._id, cycleNumber, ...values }],
      { session }
    );
    return created;
  }

  return Payout.create({ groupId: group._id, cycleNumber, ...values });
}
