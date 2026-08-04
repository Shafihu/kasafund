import mongoose from "mongoose";
import { Contribution } from "../models/Contribution.js";
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
import { calculateAcceleratedRoundDebts } from "./debtLiabilityService.js";

export const FINAL_RESOLUTION_ATTEMPT = 2;

function money(amount) {
  return `GHS ${(amount / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function shouldCloseResolutionDeadlock(resolution) {
  return (
    resolution?.status === "expired" &&
    Number(resolution?.attemptNumber || 1) >= FINAL_RESOLUTION_ATTEMPT
  );
}

export async function closeResolutionDeadlock(resolutionId, now = new Date()) {
  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      const resolution = await GroupResolution.findOne({
        _id: resolutionId,
        status: "expired",
        attemptNumber: { $gte: FINAL_RESOLUTION_ATTEMPT },
      }).session(session);
      if (!shouldCloseResolutionDeadlock(resolution)) return;

      const payout = await Payout.findOne({
        _id: resolution.payoutId,
        groupId: resolution.groupId,
        status: "scheduled",
        closureReason: "",
      }).session(session);
      if (!payout) return;

      const [group, contributions] = await Promise.all([
        Group.findOne({ _id: resolution.groupId, status: "active" }).session(session),
        Contribution.find({
          groupId: resolution.groupId,
          cycleNumber: payout.cycleNumber,
          status: "paid",
        }).session(session),
      ]);
      if (!group) throw new Error("Active group unavailable for deadlock closure");

      const paidUserIds = new Set(
        contributions.map((contribution) => String(contribution.userId))
      );
      const currentDefaultingIds = (payout.expectedContributorIds || []).filter(
        (userId) => !paidUserIds.has(String(userId))
      );
      if (!currentDefaultingIds.length) {
        resolution.failureReason =
          "Voting ended, but all expected contributions were completed before closure";
        await resolution.save({ session });
        return;
      }
      const activeDefaultingMembers = await GroupMember.find({
          groupId: resolution.groupId,
          userId: { $in: currentDefaultingIds },
          status: "active",
        })
          .select("userId")
          .session(session);

      const totalRefund = contributions.reduce(
        (sum, contribution) => sum + contribution.amount,
        0
      );
      if (totalRefund > 0) {
        const debitedGroup = await Group.findOneAndUpdate(
          { _id: group._id, totalPot: { $gte: totalRefund } },
          { $inc: { totalPot: -totalRefund } },
          { new: true, session }
        );
        if (!debitedGroup) {
          throw new Error("Group funds are insufficient to safely refund this cycle");
        }

        await User.bulkWrite(
          contributions.map((contribution) => ({
            updateOne: {
              filter: { _id: contribution.userId },
              update: { $inc: { walletBalance: contribution.amount } },
            },
          })),
          { session }
        );
        await WalletTransaction.insertMany(
          contributions.map((contribution) => ({
            userId: contribution.userId,
            type: "contribution_refund",
            amount: contribution.amount,
            status: "completed",
            reference: `ksf_cycle_refund_${contribution._id}`,
            relatedGroupId: group._id,
            channel: "group_cycle_deadlock",
            completedAt: now,
          })),
          { session }
        );
        await Contribution.updateMany(
          { _id: { $in: contributions.map((contribution) => contribution._id) } },
          {
            $set: {
              status: "refunded",
              refundedAt: now,
            },
          },
          { session }
        );
        await Promise.all(
          contributions.map((contribution) =>
            Contribution.updateOne(
              { _id: contribution._id },
              { $set: { refundReference: `ksf_cycle_refund_${contribution._id}` } },
              { session }
            )
          )
        );
        await GroupMember.bulkWrite(
          contributions.map((contribution) => ({
            updateOne: {
              filter: { groupId: group._id, userId: contribution.userId },
              update: [{
                $set: {
                  totalContributed: {
                    $max: [
                      0,
                      { $subtract: ["$totalContributed", contribution.amount] },
                    ],
                  },
                  lastContributionStatus: "pending",
                },
              }],
            },
          })),
          { session }
        );
      }

      const defaultingIds = activeDefaultingMembers.map((member) => member.userId);
      if (defaultingIds.length) {
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
        const defaultSet = new Set(defaultingIds.map(String));
        group.rotation.order = (group.rotation.order || []).filter(
          (userId) => !defaultSet.has(String(userId))
        );
        group.rotation.pendingOrder = (group.rotation.pendingOrder || []).filter(
          (userId) => !defaultSet.has(String(userId))
        );

        const acceleratedDebts = await calculateAcceleratedRoundDebts({
          groupId: group._id,
          payout,
          userIds: defaultingIds,
          session,
        });
        const debtIds = defaultingIds.filter((userId) =>
          acceleratedDebts.has(String(userId))
        );
        const waivableIds = defaultingIds.filter(
          (userId) => !acceleratedDebts.has(String(userId))
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
      }

      payout.status = "failed";
      payout.closedAt = now;
      payout.closureReason = "resolution_deadlock";
      await payout.save({ session });

      resolution.failureReason =
        "Final voting period ended without a decision; paid contributions were refunded";
      await resolution.save({ session });
      await group.save({ session });

      const notifications = [
        ...contributions.map((contribution) => ({
          userId: contribution.userId,
          type: "contribution_refunded",
          title: "Contribution returned",
          body: `${money(contribution.amount)} from ${group.name} cycle ${payout.cycleNumber} was returned to your wallet because the final vote ended without a decision.`,
          relatedGroupId: group._id,
        })),
        ...defaultingIds.map((userId) => ({
          userId,
          type: "penalty_applied",
          title: "Group membership suspended",
          body: `You were suspended from ${group.name} after the unresolved cycle closed. Any debt from a payout you previously received remains payable.`,
          relatedGroupId: group._id,
        })),
      ];
      const activeMembers = await GroupMember.find({
        groupId: group._id,
        status: "active",
      })
        .select("userId")
        .session(session);
      notifications.push(
        ...activeMembers
          .filter(
            (member) =>
              !contributions.some(
                (contribution) =>
                  String(contribution.userId) === String(member.userId)
              )
          )
          .map((member) => ({
            userId: member.userId,
            type: "resolution_completed",
            title: "Unresolved cycle closed",
            body: `${group.name} closed cycle ${payout.cycleNumber} after the final vote expired. Confirmed contributions were refunded and a new cycle will begin.`,
            relatedGroupId: group._id,
          }))
      );
      if (notifications.length) {
        await Notification.insertMany(notifications, { session });
      }

      await audit({
        actorId: group.ownerId,
        action: "group.resolution_deadlock_closed",
        targetType: "group",
        targetId: group._id,
        metadata: {
          resolutionId: resolution._id,
          payoutId: payout._id,
          cycleNumber: payout.cycleNumber,
          refundedAmount: totalRefund,
          refundedContributionCount: contributions.length,
          suspendedUserIds: defaultingIds,
          automated: true,
        },
        session,
      });
      await ensureNextPayout(group._id, { session });
      result = {
        closed: true,
        payoutId: payout._id,
        refundedAmount: totalRefund,
        refundedCount: contributions.length,
        suspendedCount: defaultingIds.length,
      };
    });
  } finally {
    await session.endSession();
  }
  return result;
}

export async function closePendingResolutionDeadlocks({
  limit = 25,
  now = new Date(),
} = {}) {
  const scheduledPayoutIds = await Payout.find({
    status: "scheduled",
    closureReason: "",
  }).distinct("_id");
  if (!scheduledPayoutIds.length) {
    return { checked: 0, closed: 0, errors: 0 };
  }
  const resolutions = await GroupResolution.find({
    status: "expired",
    attemptNumber: { $gte: FINAL_RESOLUTION_ATTEMPT },
    payoutId: { $in: scheduledPayoutIds },
  })
    .sort({ decidedAt: 1 })
    .select("_id payoutId")
    .limit(limit);
  let closed = 0;
  let errors = 0;
  for (const resolution of resolutions) {
    try {
      if (await closeResolutionDeadlock(resolution._id, now)) closed += 1;
    } catch (error) {
      errors += 1;
      console.error(`Resolution deadlock ${resolution._id} failed:`, error.message);
    }
  }
  return { checked: resolutions.length, closed, errors };
}
