import crypto from "crypto";
import { env } from "../config/env.js";
import { Notification } from "../models/Notification.js";
import { SavingsPot } from "../models/SavingsPot.js";
import { depositToSavings } from "./savingsService.js";

function scheduledReference(pot, scheduleAt) {
  const digest = crypto
    .createHash("sha256")
    .update(`${pot._id}:${scheduleAt.toISOString()}`)
    .digest("hex")
    .slice(0, 24);
  return `ksf_auto_save_${digest}`;
}

export async function processSavingsPot(potId, now = new Date()) {
  const pot = await SavingsPot.findOne({
    _id: potId,
    status: "active",
    autoSaveEnabled: true,
    nextContributionAt: { $lte: now },
  });
  if (!pot) return { processed: false, reason: "not_due" };

  if (pot.targetDate.getTime() <= now.getTime()) {
    pot.autoSaveEnabled = false;
    await pot.save();
    return { processed: false, reason: "target_date_reached" };
  }

  const scheduleAt = new Date(pot.nextContributionAt);
  const firstAttemptForSchedule =
    !pot.lastAutoSaveAttemptScheduleAt ||
    pot.lastAutoSaveAttemptScheduleAt.getTime() !== scheduleAt.getTime();

  try {
    const result = await depositToSavings({
      potId: pot._id,
      userId: pot.userId,
      amount: pot.contributionAmount,
      source: "automatic",
      reference: scheduledReference(pot, scheduleAt),
      scheduleAt,
    });
    return { processed: !result.alreadyCompleted, reason: null };
  } catch (error) {
    if (error?.code === 11000) return { processed: false, reason: "already_processed" };
    const insufficient = error.message === "Insufficient wallet balance";
    await SavingsPot.updateOne(
      { _id: pot._id },
      {
        $set: {
          lastAutoSaveAttemptScheduleAt: scheduleAt,
          lastAutoSaveStatus: insufficient ? "insufficient_balance" : "failed",
          failureReason: error.message,
        },
      }
    );
    if (firstAttemptForSchedule) {
      await Notification.create({
        userId: pot.userId,
        type: "savings_update",
        title: insufficient ? "Automatic saving needs funds" : "Automatic saving failed",
        body: insufficient
          ? `Add GHS ${(pot.contributionAmount / 100).toFixed(2)} to your wallet for ${pot.name}.`
          : `We could not add money to ${pot.name}. You can try manually.`,
        relatedSavingsPotId: pot._id,
      });
    }
    return { processed: false, reason: insufficient ? "insufficient_balance" : "failed" };
  }
}

export async function processDueSavings({ limit = 100 } = {}) {
  const pots = await SavingsPot.find({
    status: "active",
    autoSaveEnabled: true,
    nextContributionAt: { $lte: new Date() },
  }).select("_id").limit(limit);
  const summary = { checked: pots.length, processed: 0, insufficient: 0, errors: 0 };
  for (const pot of pots) {
    try {
      const result = await processSavingsPot(pot._id);
      if (result.processed) summary.processed += 1;
      else if (result.reason === "insufficient_balance") summary.insufficient += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(`Automatic savings ${pot._id} failed:`, error.message);
    }
  }
  return summary;
}

export function startSavingsProcessor() {
  if (!env.automaticSavingsEnabled) {
    console.log("Automatic savings processor is disabled");
    return null;
  }
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await processDueSavings();
      if (summary.processed || summary.insufficient || summary.errors) {
        console.log("Automatic savings run:", summary);
      }
    } catch (error) {
      console.error("Automatic savings processor failed:", error.message);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, env.savingsProcessorIntervalMs);
  timer.unref();
  console.log(`Automatic savings processor runs every ${env.savingsProcessorIntervalMs}ms`);
  return timer;
}
