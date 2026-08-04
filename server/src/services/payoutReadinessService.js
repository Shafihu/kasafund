import { Contribution } from "../models/Contribution.js";
import { GroupDelinquency } from "../models/GroupDelinquency.js";
import { GroupMember } from "../models/GroupMember.js";
import { Payout } from "../models/Payout.js";

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function id(value) {
  return String(value?._id || value);
}

export function endOfScheduledDayUtc(scheduledDate, gracePeriodDays = 0) {
  const date = new Date(scheduledDate);
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + Math.max(0, Number(gracePeriodDays) || 0) + 1
  ));
}

export function calculatePayoutReadiness({
  expectedContributorIds,
  paidContributorIds,
  graceEndsAt,
  now = new Date(),
}) {
  const paid = new Set((paidContributorIds || []).map(id));
  const expected = [...new Map(
    (expectedContributorIds || []).map((userId) => [id(userId), userId])
  ).values()];
  const missingContributorIds = expected.filter((userId) => !paid.has(id(userId)));
  const isReady = expected.length > 0 && missingContributorIds.length === 0;
  const isOverdue = !isReady && graceEndsAt && now >= new Date(graceEndsAt);

  return {
    status: isReady ? "ready" : isOverdue ? "overdue" : "awaiting",
    expectedCount: expected.length,
    paidCount: expected.length - missingContributorIds.length,
    missingCount: missingContributorIds.length,
    missingContributorIds,
    graceEndsAt: graceEndsAt ? new Date(graceEndsAt) : null,
  };
}

/**
 * Evaluates only payments for the payout's own cycle. Legacy scheduled payouts
 * are safely backfilled from the currently active membership.
 */
export async function evaluatePayoutReadiness(
  payoutOrId,
  { session = null, now = new Date(), persist = true } = {}
) {
  const payout = typeof payoutOrId === "object" && payoutOrId?._id
    ? payoutOrId
    : await withSession(Payout.findById(payoutOrId), session);
  if (!payout) return null;

  if (!payout.expectedContributorIds?.length) {
    const activeMembers = await withSession(
      GroupMember.find({ groupId: payout.groupId, status: "active" }).select("userId"),
      session
    );
    payout.expectedContributorIds = activeMembers.map((member) => member.userId);
  }

  const paidContributorIds = await withSession(
    Contribution.distinct("userId", {
      groupId: payout.groupId,
      cycleNumber: payout.cycleNumber,
      status: "paid",
      userId: { $in: payout.expectedContributorIds },
    }),
    session
  );
  const readiness = calculatePayoutReadiness({
    expectedContributorIds: payout.expectedContributorIds,
    paidContributorIds,
    graceEndsAt: payout.graceEndsAt,
    now,
  });

  if (persist) {
    const changed =
      payout.fundingStatus !== readiness.status ||
      !payout.fundingStatusUpdatedAt ||
      !payout.expectedContributorIds?.length;
    payout.fundingStatus = readiness.status;
    if (changed) payout.fundingStatusUpdatedAt = now;
    await payout.save(session ? { session } : undefined);
  }

  return { payout, ...readiness };
}

export async function recordPayoutDelinquencies(
  payout,
  readiness,
  { session = null } = {}
) {
  if (!payout || readiness?.status !== "overdue" || !readiness.missingCount) return;
  const amountDue = payout.contributionAmount || Math.floor(
    payout.amount / Math.max(readiness.expectedCount, 1)
  );
  const operations = readiness.missingContributorIds.map((userId) => ({
    updateOne: {
      filter: {
        groupId: payout.groupId,
        userId,
        cycleNumber: payout.cycleNumber,
      },
      update: {
        $set: {
          payoutId: payout._id,
          amountDue,
          dueDate: payout.scheduledDate,
          graceEndsAt: readiness.graceEndsAt,
          status: "open",
          resolvedAt: null,
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      upsert: true,
    },
  }));
  await GroupDelinquency.bulkWrite(
    operations,
    session ? { session } : undefined
  );
}
