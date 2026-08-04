import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Group } from "../models/Group.js";
import { GroupDelinquency } from "../models/GroupDelinquency.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupResolution } from "../models/GroupResolution.js";
import { Notification } from "../models/Notification.js";
import { Payout } from "../models/Payout.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { audit } from "../utils/api.js";
import { ensureNextPayout } from "./payoutScheduleService.js";
import {
  evaluatePayoutReadiness,
  recordPayoutDelinquencies,
} from "./payoutReadinessService.js";
import { syncUserAchievements } from "./trustMetricsService.js";
import { expireDueResolutions } from "./resolutionExpiryService.js";
import { calculateAcceleratedRoundDebts } from "./debtLiabilityService.js";

function startOfTodayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function money(amount) {
  return `GHS ${(amount / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function notifyOverduePayout(payout, readiness, group, session, now) {
  const notificationClaim = await Payout.findOneAndUpdate(
    { _id: payout._id, overdueNotifiedAt: null },
    { $set: { overdueNotifiedAt: now } },
    { new: true, session }
  );
  if (!notificationClaim) return;

  const missingIds = readiness.missingContributorIds.map(String);
  const management = await GroupMember.find({
    groupId: group._id,
    status: "active",
    role: { $in: ["owner", "treasurer"] },
  }).select("userId").session(session);
  const notificationMap = new Map();

  for (const userId of missingIds) {
    notificationMap.set(userId, {
      userId,
      type: "payment_due",
      title: "Contribution overdue",
      body: `Your contribution to ${group.name} is overdue and the group payout is delayed.`,
      relatedGroupId: group._id,
    });
  }
  for (const member of management) {
    const userId = String(member.userId);
    if (notificationMap.has(userId)) continue;
    notificationMap.set(userId, {
      userId,
      type: "payment_due",
      title: "Group payout delayed",
      body: `${readiness.missingCount} ${
        readiness.missingCount === 1 ? "contribution is" : "contributions are"
      } overdue for ${group.name}.`,
      relatedGroupId: group._id,
    });
  }
  const recipientId = String(payout.recipientId);
  if (!notificationMap.has(recipientId)) {
    notificationMap.set(recipientId, {
      userId: recipientId,
      type: "payout_scheduled",
      title: "Your payout is delayed",
      body: `${group.name} is waiting for ${readiness.missingCount} ${
        readiness.missingCount === 1 ? "contribution" : "contributions"
      }.`,
      relatedGroupId: group._id,
    });
  }
  if (notificationMap.size) {
    await Notification.insertMany([...notificationMap.values()], { session });
  }
}

export async function processPayout(
  payoutId,
  {
    requireDayEnded = true,
    actorId = null,
    now = new Date(),
    resolutionId = null,
  } = {}
) {
  const session = await mongoose.startSession();
  let result = { processed: false, reason: "not_available", payout: null };

  try {
    await session.withTransaction(async () => {
      const payoutToPrepare = await Payout.findById(payoutId)
        .select("groupId status")
        .session(session);
      if (!payoutToPrepare || payoutToPrepare.status !== "scheduled") return;
      const scheduledPayout = await ensureNextPayout(payoutToPrepare.groupId, { session });
      if (scheduledPayout && !scheduledPayout.snapshotLockedAt) {
        scheduledPayout.snapshotLockedAt = now;
        await scheduledPayout.save({ session });
      }
      const readiness = await evaluatePayoutReadiness(scheduledPayout || payoutId, {
        session,
        now,
      });
      const approvedResolution = resolutionId
        ? await GroupResolution.findOne({
            _id: resolutionId,
            payoutId,
            status: "approved",
          }).session(session)
        : null;
      if (resolutionId && !approvedResolution) {
        result = { processed: false, reason: "resolution_unavailable", payout: null };
        return;
      }
      if ((!readiness || readiness.status !== "ready") && !approvedResolution) {
        const group = await Group.findById(payoutToPrepare.groupId).session(session);
        if (group && readiness?.status === "overdue") {
          await recordPayoutDelinquencies(readiness.payout, readiness, { session });
          await notifyOverduePayout(readiness.payout, readiness, group, session, now);
        }
        result = {
          processed: false,
          reason: readiness?.status === "overdue"
            ? "missing_contributions"
            : "within_grace_period",
          payout: readiness?.payout || null,
          readiness,
        };
        return;
      }

      const payoutFilter = { _id: payoutId, status: "scheduled" };
      if (requireDayEnded) payoutFilter.scheduledDate = { $lt: startOfTodayUtc(now) };

      const payout = await Payout.findOneAndUpdate(
        payoutFilter,
        { $set: { status: "processing" } },
        { new: true, session }
      );
      if (!payout) return;
      if (approvedResolution) {
        payout.originalAmount = payout.originalAmount || payout.amount;
        payout.amount = approvedResolution.proposedPayoutAmount;
        payout.resolutionId = approvedResolution._id;
        await payout.save({ session });
      }

      const group = await Group.findOneAndUpdate(
        {
          _id: payout.groupId,
          status: "active",
          totalPot: { $gte: payout.amount },
          "rotation.completedRecipientIds": { $ne: payout.recipientId },
        },
        { $inc: { totalPot: -payout.amount } },
        { new: true, session }
      );
      if (!group) {
        payout.status = "scheduled";
        if (approvedResolution) {
          payout.amount = payout.originalAmount || approvedResolution.originalPayoutAmount;
          payout.originalAmount = null;
          payout.resolutionId = null;
        }
        await payout.save({ session });
        const currentGroup = await Group.findById(payout.groupId).session(session);
        const recipientAlreadyPaid = currentGroup?.rotation?.completedRecipientIds?.some(
          (userId) => String(userId) === String(payout.recipientId)
        );
        result = {
          processed: false,
          reason: recipientAlreadyPaid ? "recipient_already_paid" : "insufficient_group_pot",
          payout,
        };
        return;
      }

      const recipient = await User.findOneAndUpdate(
        { _id: payout.recipientId, isActive: true },
        { $inc: { walletBalance: payout.amount } },
        { new: true, session }
      );
      const members = await GroupMember.find({ groupId: group._id, status: "active" })
        .select("userId")
        .session(session);
      if (!recipient) throw new Error("Payout recipient is unavailable");

      const reference = `ksf_payout_${payout._id}`;
      await WalletTransaction.create(
        [{
          userId: recipient._id,
          type: "payout",
          amount: payout.amount,
          status: "completed",
          reference,
          relatedGroupId: group._id,
          channel: "group_wallet",
          completedAt: now,
        }],
        { session }
      );

      payout.status = "completed";
      payout.fundingStatus = "ready";
      payout.paidAt = now;
      await payout.save({ session });

      await GroupMember.updateMany(
        { groupId: group._id, status: "active" },
        { $set: { lastContributionStatus: "pending" } },
        { session }
      );

      if (approvedResolution) {
        const defaultingIds = approvedResolution.defaultingUserIds || [];
        const acceleratedDebts = await calculateAcceleratedRoundDebts({
          groupId: group._id,
          payout,
          userIds: defaultingIds,
          session,
        });
        await GroupMember.updateMany(
          {
            groupId: group._id,
            userId: { $in: defaultingIds },
            status: "active",
          },
          {
            $set: {
              status: "suspended",
              suspendedAt: now,
              suspensionReason: "contribution_default",
              rejoinBlocked: true,
              lastContributionStatus: "late",
            },
          },
          { session }
        );
        group.memberCount = Math.max(0, group.memberCount - defaultingIds.length);
        group.rotation.order = (group.rotation.order || []).filter(
          (userId) => !defaultingIds.some((defaultId) => String(defaultId) === String(userId))
        );
        group.rotation.pendingOrder = (group.rotation.pendingOrder || []).filter(
          (userId) => !defaultingIds.some((defaultId) => String(defaultId) === String(userId))
        );
        const waivableIds = defaultingIds.filter(
          (userId) => !acceleratedDebts.has(String(userId))
        );
        const debtIds = defaultingIds.filter(
          (userId) => acceleratedDebts.has(String(userId))
        );
        if (waivableIds.length) {
          await GroupDelinquency.updateMany(
            {
              payoutId: payout._id,
              userId: { $in: waivableIds },
              status: "open",
            },
            { $set: { status: "waived", resolvedAt: now } },
            { session }
          );
        }
        if (debtIds.length) {
          await GroupDelinquency.bulkWrite(
            debtIds.map((userId) => ({
              updateOne: {
                filter: {
                  payoutId: payout._id,
                  userId,
                  status: "open",
                },
                update: {
                  $set: {
                    amountDue: acceleratedDebts.get(String(userId)).amountDue,
                    liabilityType: "post_payout_debt",
                    creditorUserId:
                      acceleratedDebts.get(String(userId)).allocations[0]?.userId ||
                      payout.recipientId,
                    creditorAllocations:
                      acceleratedDebts.get(String(userId)).allocations,
                  },
                },
              },
            })),
            { session }
          );
        }
        const debtSet = new Set(debtIds.map(String));
        await Notification.insertMany(
          defaultingIds.map((userId) => ({
            userId,
            type: "penalty_applied",
            title: debtSet.has(String(userId))
              ? "Membership suspended and debt recorded"
              : "Group membership suspended",
            body: debtSet.has(String(userId))
              ? `You were suspended from ${group.name}. Your unpaid ${money(
                  acceleratedDebts.get(String(userId))
                    .amountDue
                )} remaining commitment is now due because you already received your payout in this round.`
              : `You were suspended from ${group.name} for contribution default and cannot rejoin this group.`,
            relatedGroupId: group._id,
          })),
          { session }
        );
        approvedResolution.status = "executed";
        approvedResolution.executedAt = now;
        await approvedResolution.save({ session });
      }

      if (!(group.rotation.completedRecipientIds || []).some(
        (userId) => String(userId) === String(recipient._id)
      )) {
        group.rotation.completedRecipientIds.push(recipient._id);
      }
      await group.save({ session });

      const amountLabel = money(payout.amount);
      const memberIds = new Set(members.map((member) => String(member.userId)));
      memberIds.add(String(recipient._id));
      const notificationUsers = await User.find({
        _id: { $in: [...memberIds] },
        "preferences.payoutNotifications": { $ne: false },
      }).select("_id").session(session);
      const notifications = notificationUsers.map((notificationUser) => {
        const userId = String(notificationUser._id);
        const isRecipient = userId === String(recipient._id);
        return {
          userId,
          type: "payout_completed",
          title: isRecipient ? "Payout received" : "Group payout completed",
          body: isRecipient
            ? `${amountLabel} from ${group.name} was added to your wallet.`
            : `${recipient.fullName} received ${amountLabel} from ${group.name}.`,
          relatedGroupId: group._id,
        };
      });
      if (notifications.length) {
        await Notification.insertMany(notifications, { session });
      }

      await audit({
        actorId: actorId || group.ownerId,
        action: requireDayEnded
          ? "group.payout_completed_automatically"
          : "group.payout_completed_manually",
        targetType: "group",
        targetId: group._id,
        metadata: {
          payoutId: payout._id,
          walletTransactionReference: reference,
          resolutionId: approvedResolution?._id || null,
          originalAmount: approvedResolution?.originalPayoutAmount || payout.amount,
          paidAmount: payout.amount,
        },
        session,
      });
      await ensureNextPayout(group._id, { session });
      result = { processed: true, reason: null, payout };
    });
  } finally {
    await session.endSession();
  }

  if (result.processed && result.payout?.recipientId) {
    try {
      await syncUserAchievements(result.payout.recipientId);
    } catch (error) {
      console.error("Payout achievement sync failed:", error.message);
    }
  }

  return result;
}

export async function processDuePayouts({ limit = 25, now = new Date() } = {}) {
  const resolutionExpiry = await expireDueResolutions({ now });
  const duePayouts = await Payout.find({
    status: "scheduled",
    scheduledDate: { $lt: startOfTodayUtc(now) },
  })
    .sort({ scheduledDate: 1 })
    .select("_id")
    .limit(limit);

  const summary = {
    checked: duePayouts.length,
    processed: 0,
    delayed: 0,
    errors: 0,
    expiredResolutions: resolutionExpiry.expired,
    resolutionExpiryErrors: resolutionExpiry.errors,
    deadlocksClosed: resolutionExpiry.deadlocksClosed,
    deadlockErrors: resolutionExpiry.deadlockErrors,
  };
  for (const payout of duePayouts) {
    try {
      const result = await processPayout(payout._id, { now });
      if (result.processed) summary.processed += 1;
      else if ([
        "insufficient_group_pot",
        "missing_contributions",
        "within_grace_period",
      ].includes(result.reason)) summary.delayed += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(`Automatic payout ${payout._id} failed:`, error.message);
    }
  }
  return summary;
}

export function startPayoutProcessor() {
  if (!env.automaticPayoutsEnabled) {
    console.log("Automatic payout processor is disabled");
    return null;
  }

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await processDuePayouts();
      if (summary.processed || summary.errors || summary.expiredResolutions) {
        console.log("Automatic payout run:", summary);
      }
    } catch (error) {
      console.error("Automatic payout processor failed:", error.message);
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(run, env.payoutProcessorIntervalMs);
  timer.unref();
  console.log(`Automatic payout processor runs every ${env.payoutProcessorIntervalMs}ms`);
  return timer;
}
