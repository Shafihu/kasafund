import { Contribution } from "../models/Contribution.js";
import { Group } from "../models/Group.js";
import { Payout } from "../models/Payout.js";

export function remainingRoundCommitment({
  payoutReceived,
  contributionsPaid,
  minimumContribution,
}) {
  return Math.max(
    minimumContribution,
    Math.max(0, payoutReceived - contributionsPaid)
  );
}

export function allocateCommitment(amountDue, contributionAmount, recipientIds) {
  let remaining = amountDue;
  const allocations = [];
  for (const userId of recipientIds) {
    if (remaining < 1) break;
    const amount = Math.min(contributionAmount, remaining);
    allocations.push({ userId, amount });
    remaining -= amount;
  }
  if (remaining > 0 && allocations.length) {
    allocations[0].amount += remaining;
  }
  return allocations;
}

export async function calculateAcceleratedRoundDebts({
  groupId,
  payout,
  userIds,
  session = null,
}) {
  if (!userIds?.length) return new Map();

  const receivedPayoutsQuery = Payout.find({
    groupId,
    rotationRound: payout.rotationRound,
    recipientId: { $in: userIds },
    status: "completed",
  }).select("recipientId amount cycleNumber");
  const roundStartQuery = Payout.findOne({
    groupId,
    rotationRound: payout.rotationRound,
  })
    .sort({ cycleNumber: 1 })
    .select("cycleNumber");
  const groupQuery = Group.findById(groupId).select(
    "rotation.order rotation.completedRecipientIds"
  );
  if (session) {
    receivedPayoutsQuery.session(session);
    roundStartQuery.session(session);
    groupQuery.session(session);
  }
  const [receivedPayouts, roundStart, group] = await Promise.all([
    receivedPayoutsQuery,
    roundStartQuery,
    groupQuery,
  ]);
  if (!receivedPayouts.length || !roundStart || !group) return new Map();

  const recipientIds = receivedPayouts.map((item) => item.recipientId);
  const contributionsQuery = Contribution.find({
    groupId,
    userId: { $in: recipientIds },
    cycleNumber: {
      $gte: roundStart.cycleNumber,
      $lte: payout.cycleNumber,
    },
    status: "paid",
  }).select("userId amount");
  if (session) contributionsQuery.session(session);
  const contributions = await contributionsQuery;
  const paidByUser = new Map();
  for (const contribution of contributions) {
    const userId = String(contribution.userId);
    paidByUser.set(
      userId,
      (paidByUser.get(userId) || 0) + contribution.amount
    );
  }

  const minimumContribution = payout.contributionAmount || 1;
  const completedIds = new Set(
    (group.rotation?.completedRecipientIds || []).map(String)
  );
  const defaultingIds = new Set(userIds.map(String));
  const remainingRecipientIds = (group.rotation?.order || []).filter(
    (userId) =>
      !completedIds.has(String(userId)) && !defaultingIds.has(String(userId))
  );
  return new Map(
    receivedPayouts.map((received) => {
      const userId = String(received.recipientId);
      const amountDue = remainingRoundCommitment({
        payoutReceived: received.amount,
        contributionsPaid: paidByUser.get(userId) || 0,
        minimumContribution,
      });
      return [
        userId,
        {
          amountDue,
          allocations: allocateCommitment(
            amountDue,
            minimumContribution,
            remainingRecipientIds
          ),
        },
      ];
    })
  );
}
