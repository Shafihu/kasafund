import crypto from "crypto";
import { env } from "../config/env.js";
import { Contribution } from "../models/Contribution.js";
import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { Notification } from "../models/Notification.js";
import { completeContribution } from "./paymentService.js";
import { ensureNextPayout } from "./payoutScheduleService.js";

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

function referenceFor(groupId, userId, cycleNumber) {
  const key = `${groupId}:${userId}:${cycleNumber}`;
  const digest = crypto.createHash("sha256").update(key).digest("hex").slice(0, 24);
  return `ksf_auto_con_${cycleNumber}_${digest}`;
}

function money(amount) {
  return `GHS ${(amount / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function syncUpcomingReminder(member, group, payout, now) {
  const dueAt = new Date(payout.scheduledDate);
  const timeUntilDue = dueAt.getTime() - now.getTime();
  const updates = { "autoContribution.nextRunAt": dueAt };

  if (
    timeUntilDue > 0 &&
    timeUntilDue <= REMINDER_WINDOW_MS &&
    member.autoContribution.reminderCycleNumber !== payout.cycleNumber
  ) {
    updates["autoContribution.reminderCycleNumber"] = payout.cycleNumber;
    await Notification.create({
      userId: member.userId,
      type: "payment_due",
      title: "Auto-contribution scheduled",
      body: `${money(payout.contributionAmount || group.contribution.amount)} will be paid from your wallet for ${group.name} when it is due.`,
      relatedGroupId: group._id,
    });
  }

  await GroupMember.updateOne({ _id: member._id }, { $set: updates });
  return timeUntilDue;
}

export async function processAutoContribution(memberId, now = new Date()) {
  const member = await GroupMember.findOne({
    _id: memberId,
    status: "active",
    "autoContribution.enabled": true,
  });
  if (!member) return { processed: false, reason: "not_enabled" };

  const group = await Group.findOne({ _id: member.groupId, status: "active" });
  if (!group) return { processed: false, reason: "group_unavailable" };

  const payout = await ensureNextPayout(group._id);
  if (!payout) {
    await GroupMember.updateOne(
      { _id: member._id },
      { $set: { "autoContribution.nextRunAt": null } }
    );
    return { processed: false, reason: "not_scheduled" };
  }
  if (
    payout.expectedContributorIds?.length &&
    !payout.expectedContributorIds.some(
      (userId) => String(userId) === String(member.userId)
    )
  ) {
    return { processed: false, reason: "not_in_current_cycle" };
  }
  if (!payout.snapshotLockedAt) {
    payout.snapshotLockedAt = now;
    await payout.save();
  }

  const timeUntilDue = await syncUpcomingReminder(member, group, payout, now);
  if (timeUntilDue > 0) return { processed: false, reason: "not_due" };
  if (member.autoContribution.lastAttemptCycleNumber === payout.cycleNumber) {
    return { processed: false, reason: "already_attempted" };
  }

  const claim = await GroupMember.findOneAndUpdate(
    {
      _id: member._id,
      status: "active",
      "autoContribution.enabled": true,
      "autoContribution.lastAttemptCycleNumber": { $ne: payout.cycleNumber },
    },
    {
      $set: {
        "autoContribution.lastAttemptAt": now,
        "autoContribution.lastAttemptCycleNumber": payout.cycleNumber,
      },
    },
    { new: true }
  );
  if (!claim) return { processed: false, reason: "already_claimed" };

  const existingPaid = await Contribution.exists({
    groupId: group._id,
    userId: member.userId,
    cycleNumber: payout.cycleNumber,
    status: "paid",
  });
  if (existingPaid) {
    await GroupMember.updateOne(
      { _id: member._id },
      {
        $set: {
          "autoContribution.lastStatus": "already_paid",
          "autoContribution.failureReason": "",
        },
      }
    );
    return { processed: false, reason: "already_paid" };
  }

  const reference = referenceFor(group._id, member.userId, payout.cycleNumber);
  try {
    await completeContribution({
      reference,
      groupId: group._id,
      userId: member.userId,
      amount: payout.contributionAmount || group.contribution.amount,
      cycleNumber: payout.cycleNumber,
      dueDate: payout.scheduledDate,
      paymentMethod: "wallet",
      paidAt: now,
      debitWallet: true,
      source: "auto",
    });
    await GroupMember.updateOne(
      { _id: member._id },
      {
        $set: {
          "autoContribution.lastStatus": "paid",
          "autoContribution.failureReason": "",
        },
      }
    );
    return { processed: true, reason: null };
  } catch (error) {
    if (error?.code === 11000) {
      await GroupMember.updateOne(
        { _id: member._id },
        {
          $set: {
            "autoContribution.lastStatus": "already_paid",
            "autoContribution.failureReason": "",
          },
        }
      );
      return { processed: false, reason: "already_paid" };
    }
    const insufficient = error.message === "Insufficient wallet balance";
    const reason = insufficient ? "insufficient_balance" : "failed";
    await Promise.all([
      GroupMember.updateOne(
        { _id: member._id },
        {
          $set: {
            "autoContribution.lastStatus": reason,
            "autoContribution.failureReason": error.message,
          },
        }
      ),
      Notification.create({
        userId: member.userId,
        type: "payment_due",
        title: insufficient ? "Auto-contribution needs funds" : "Auto-contribution failed",
        body: insufficient
          ? `Add ${money(payout.contributionAmount || group.contribution.amount)} to your wallet to contribute to ${group.name}.`
          : `We could not pay your contribution to ${group.name}. You can pay it manually.`,
        relatedGroupId: group._id,
      }),
    ]);
    return { processed: false, reason };
  }
}

export async function processDueAutoContributions({
  limit = 100,
  now = new Date(),
} = {}) {
  const members = await GroupMember.find({
    status: "active",
    "autoContribution.enabled": true,
  })
    .select("_id")
    .limit(limit);

  const summary = { checked: members.length, processed: 0, insufficient: 0, errors: 0 };
  for (const member of members) {
    try {
      const result = await processAutoContribution(member._id, now);
      if (result.processed) summary.processed += 1;
      else if (result.reason === "insufficient_balance") summary.insufficient += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(`Auto-contribution ${member._id} failed:`, error.message);
    }
  }
  return summary;
}

export function startAutoContributionProcessor() {
  if (!env.automaticContributionsEnabled) {
    console.log("Automatic contribution processor is disabled");
    return null;
  }

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await processDueAutoContributions();
      if (summary.processed || summary.insufficient || summary.errors) {
        console.log("Automatic contribution run:", summary);
      }
    } catch (error) {
      console.error("Automatic contribution processor failed:", error.message);
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(run, env.autoContributionProcessorIntervalMs);
  timer.unref();
  console.log(
    `Automatic contribution processor runs every ${env.autoContributionProcessorIntervalMs}ms`
  );
  return timer;
}
