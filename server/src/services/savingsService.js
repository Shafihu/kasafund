import mongoose from "mongoose";
import { Notification } from "../models/Notification.js";
import { SavingsPot } from "../models/SavingsPot.js";
import { SavingsTransaction } from "../models/SavingsTransaction.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { audit } from "../utils/api.js";

export function nextSavingsDate(value, frequency) {
  const next = new Date(value);
  if (frequency === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export async function depositToSavings({
  potId,
  userId,
  amount,
  source,
  reference,
  scheduleAt = null,
}) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const pot = await SavingsPot.findOne({
        _id: potId,
        userId,
        status: "active",
      }).session(session);
      if (!pot) {
        const error = new Error("Active savings pot not found");
        error.statusCode = 404;
        throw error;
      }
      if (
        scheduleAt &&
        pot.lastAutoSaveScheduleAt &&
        pot.lastAutoSaveScheduleAt.getTime() === new Date(scheduleAt).getTime()
      ) {
        result = { pot, alreadyCompleted: true };
        return;
      }

      const user = await User.findOneAndUpdate(
        { _id: userId, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } },
        { new: true, session }
      );
      if (!user) {
        const error = new Error("Insufficient wallet balance");
        error.statusCode = 400;
        throw error;
      }

      pot.currentAmount += amount;
      if (scheduleAt) {
        pot.lastAutoSaveAt = new Date();
        pot.lastAutoSaveScheduleAt = new Date(scheduleAt);
        pot.lastAutoSaveStatus = "paid";
        pot.failureReason = "";
        pot.nextContributionAt = nextSavingsDate(scheduleAt, pot.frequency);
      }
      if (pot.currentAmount >= pot.targetAmount) {
        pot.status = "completed";
        pot.autoSaveEnabled = false;
      }
      await pot.save({ session });

      await Promise.all([
        SavingsTransaction.create([{
          potId: pot._id,
          userId,
          type: "deposit",
          source,
          amount,
          balanceAfter: pot.currentAmount,
          reference,
        }], { session }),
        WalletTransaction.create([{
          userId,
          type: "savings_deposit",
          amount,
          status: "completed",
          reference,
          relatedSavingsPotId: pot._id,
          channel: source === "automatic" ? "automatic_savings" : "savings_wallet",
          completedAt: new Date(),
        }], { session }),
        Notification.create([{
          userId,
          type: "savings_update",
          title: source === "automatic" ? "Automatic saving completed" : "Savings updated",
          body: `GHS ${(amount / 100).toFixed(2)} was added to ${pot.name}.`,
          relatedSavingsPotId: pot._id,
        }], { session }),
        audit({
          actorId: userId,
          action: source === "automatic" ? "savings.auto_deposit" : "savings.deposit",
          targetType: "savings_pot",
          targetId: pot._id,
          metadata: { amount, reference },
          session,
        }),
      ]);
      result = { pot, walletBalance: user.walletBalance, alreadyCompleted: false };
    });
  } finally {
    await session.endSession();
  }
  return result;
}

export async function withdrawFromSavings({ potId, userId, amount, reference }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const pot = await SavingsPot.findOne({
        _id: potId,
        userId,
        status: { $in: ["active", "paused", "completed"] },
        currentAmount: { $gte: amount },
      }).session(session);
      if (!pot) {
        const error = new Error("Savings balance is insufficient");
        error.statusCode = 400;
        throw error;
      }
      if (pot.mode === "locked" && pot.targetDate.getTime() > Date.now()) {
        const error = new Error("This pot is locked until its target date");
        error.statusCode = 403;
        throw error;
      }

      pot.currentAmount -= amount;
      if (pot.currentAmount === 0 && pot.status === "completed") pot.status = "closed";
      await pot.save({ session });
      const user = await User.findOneAndUpdate(
        { _id: userId },
        { $inc: { walletBalance: amount } },
        { new: true, session }
      );
      if (!user) throw new Error("User wallet not found");

      await Promise.all([
        SavingsTransaction.create([{
          potId: pot._id,
          userId,
          type: "withdrawal",
          source: "wallet",
          amount,
          balanceAfter: pot.currentAmount,
          reference,
        }], { session }),
        WalletTransaction.create([{
          userId,
          type: "savings_withdrawal",
          amount,
          status: "completed",
          reference,
          relatedSavingsPotId: pot._id,
          channel: "savings_wallet",
          completedAt: new Date(),
        }], { session }),
        audit({
          actorId: userId,
          action: "savings.withdrawal",
          targetType: "savings_pot",
          targetId: pot._id,
          metadata: { amount, reference },
          session,
        }),
      ]);
      result = { pot, walletBalance: user.walletBalance };
    });
  } finally {
    await session.endSession();
  }
  return result;
}
