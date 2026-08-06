import mongoose from "mongoose";
import { Campaign } from "../models/Campaign.js";
import { reconcileCampaignLifecycle } from "./campaignLifecycleService.js";
import { Contribution } from "../models/Contribution.js";
import { DebtPayment } from "../models/DebtPayment.js";
import { Donation } from "../models/Donation.js";
import { Group } from "../models/Group.js";
import { GroupDelinquency } from "../models/GroupDelinquency.js";
import { GroupMember } from "../models/GroupMember.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { audit } from "../utils/api.js";
import { syncUserAchievements } from "./trustMetricsService.js";

export async function completeDebtRepayment(data) {
  const session = await mongoose.startSession();
  let payment;
  let alreadyCompleted = false;
  await session.withTransaction(async () => {
    payment = await DebtPayment.findOne({ reference: data.reference }).session(session);
    if (!payment) {
      const error = new Error("Debt repayment was not found");
      error.statusCode = 404;
      throw error;
    }
    if (payment.status === "paid") {
      alreadyCompleted = true;
      return;
    }
    if (payment.amount !== data.amount) {
      const error = new Error("Debt repayment amount does not match the amount due");
      error.statusCode = 400;
      throw error;
    }

    const debt = await GroupDelinquency.findOne({
      _id: payment.delinquencyId,
      userId: payment.userId,
      status: "open",
      liabilityType: "post_payout_debt",
    }).session(session);
    if (!debt) {
      const error = new Error("This debt is no longer payable");
      error.statusCode = 409;
      throw error;
    }
    if (
      debt.amountDue !== payment.amount ||
      String(debt.creditorUserId) !== String(payment.creditorUserId)
    ) {
      const error = new Error("Debt repayment details no longer match the account liability");
      error.statusCode = 409;
      throw error;
    }

    const paidAt = data.paidAt || new Date();
    if (data.debitWallet) {
      const debtor = await User.findOneAndUpdate(
        { _id: payment.userId, walletBalance: { $gte: payment.amount } },
        { $inc: { walletBalance: -payment.amount } },
        { new: true, session }
      );
      if (!debtor) {
        const error = new Error("Insufficient wallet balance");
        error.statusCode = 400;
        throw error;
      }
      await WalletTransaction.create(
        [{
          userId: payment.userId,
          type: "debt_repayment",
          amount: payment.amount,
          status: "completed",
          reference: `${payment.reference}_debit`,
          relatedGroupId: payment.groupId,
          channel: "wallet_debt_repayment",
          completedAt: paidAt,
        }],
        { session }
      );
    }

    const configuredAllocations = debt.creditorAllocations || [];
    const allocations =
      configuredAllocations.length &&
      configuredAllocations.reduce((sum, item) => sum + item.amount, 0) ===
        payment.amount
        ? configuredAllocations
        : [{ userId: payment.creditorUserId, amount: payment.amount }];
    const availableCreditorCount = await User.countDocuments({
      _id: { $in: allocations.map((item) => item.userId) },
      isActive: true,
    }).session(session);
    if (availableCreditorCount !== allocations.length) {
      const error = new Error("The debt recipient is unavailable");
      error.statusCode = 409;
      throw error;
    }
    await User.bulkWrite(
      allocations.map((allocation) => ({
        updateOne: {
          filter: { _id: allocation.userId, isActive: true },
          update: { $inc: { walletBalance: allocation.amount } },
        },
      })),
      { session }
    );
    await WalletTransaction.insertMany(
      allocations.map((allocation, index) => ({
        userId: allocation.userId,
        type: "debt_recovery",
        amount: allocation.amount,
        status: "completed",
        reference: `${payment.reference}_credit_${index + 1}`,
        relatedGroupId: payment.groupId,
        channel: "group_debt_recovery",
        completedAt: paidAt,
      })),
      { session }
    );

    payment.status = "paid";
    payment.paidAt = paidAt;
    payment.failureReason = "";
    await payment.save({ session });
    debt.status = "paid";
    debt.resolvedAt = paidAt;
    await debt.save({ session });

    const group = await Group.findById(payment.groupId).select("name").session(session);
    await Notification.insertMany(
      [
        {
          userId: payment.userId,
          type: "debt_repayment",
          title: "Group debt repaid",
          body: `Your overdue contribution to ${group?.name || "the group"} has been settled.`,
          relatedGroupId: payment.groupId,
        },
        ...allocations.map((allocation) => ({
          userId: allocation.userId,
          type: "debt_repayment",
          title: "Late contribution recovered",
          body: `${moneyForNotification(allocation.amount)} from a missed ${group?.name || "group"} contribution was added to your wallet.`,
          relatedGroupId: payment.groupId,
        })),
      ],
      { session }
    );
    await audit({
      actorId: payment.userId,
      action: "group.debt_repaid",
      targetType: "group",
      targetId: payment.groupId,
      metadata: {
        delinquencyId: debt._id,
        debtPaymentId: payment._id,
        amount: payment.amount,
      },
      session,
    });
  }).finally(() => session.endSession());
  return { payment, alreadyCompleted };
}

function moneyForNotification(amount) {
  return `GHS ${(amount / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function completeContribution(data) {
  const session = await mongoose.startSession();
  let contribution;
  let alreadyCompleted = false;
  await session.withTransaction(async () => {
    contribution = await Contribution.findOneAndUpdate(
      { paystackReference: data.reference },
      {
        $setOnInsert: {
          groupId: data.groupId,
          userId: data.userId,
          amount: data.amount,
          cycleNumber: data.cycleNumber || 1,
          dueDate: data.dueDate || new Date(),
          paymentMethod: data.paymentMethod,
          paystackReference: data.reference,
        },
      },
      { new: true, upsert: true, session, runValidators: true }
    );
    if (contribution?.status === "paid") {
      alreadyCompleted = true;
      return;
    }
    if (contribution.amount !== data.amount) {
      throw new Error("Contribution payment amount does not match the expected amount");
    }
    if (data.debitWallet) {
      const user = await User.findOneAndUpdate(
        { _id: contribution.userId, walletBalance: { $gte: contribution.amount } },
        { $inc: { walletBalance: -contribution.amount } },
        { new: true, session }
      );
      if (!user) {
        const error = new Error("Insufficient wallet balance");
        error.statusCode = 400;
        throw error;
      }
      await WalletTransaction.create([{
        userId: contribution.userId,
        type: "contribution",
        amount: contribution.amount,
        status: "completed",
        reference: contribution.paystackReference,
        relatedGroupId: contribution.groupId,
        channel: data.source === "auto" ? "auto_contribution" : "group_wallet",
        completedAt: data.paidAt || new Date(),
      }], { session });
    }
    contribution.status = "paid";
    contribution.paidAt = data.paidAt || new Date();
    contribution.receiptUrl = data.receiptUrl || contribution.receiptUrl;
    await contribution.save({ session });
    await Promise.all([
      Group.updateOne({ _id: contribution.groupId }, { $inc: { totalPot: contribution.amount } }, { session }),
      GroupMember.updateOne(
        { groupId: contribution.groupId, userId: contribution.userId, status: "active" },
        { $inc: { totalContributed: contribution.amount }, $set: { lastContributionStatus: "paid" } },
        { session }
      ),
      GroupDelinquency.updateOne(
        {
          groupId: contribution.groupId,
          userId: contribution.userId,
          cycleNumber: contribution.cycleNumber,
          status: "open",
        },
        { $set: { status: "paid", resolvedAt: contribution.paidAt } },
        { session }
      ),
      Notification.create([{
        userId: contribution.userId,
        type: "payment_confirmed",
        title: data.source === "auto" ? "Auto-contribution paid" : "Contribution confirmed",
        body: data.source === "auto"
          ? "Your scheduled group contribution was paid from your wallet."
          : "Your group contribution was received",
        relatedGroupId: contribution.groupId,
      }], { session }),
      audit({ actorId: contribution.userId, action: "group.contribution_paid", targetType: "group", targetId: contribution.groupId, metadata: { contributionId: contribution._id, amount: contribution.amount }, session }),
    ]);
  });
  await session.endSession();
  if (!alreadyCompleted && contribution?.userId) {
    try {
      await syncUserAchievements(contribution.userId);
    } catch (error) {
      console.error("Contribution achievement sync failed:", error.message);
    }
  }
  return { contribution, alreadyCompleted };
}

export async function completeDonation(data) {
  const session = await mongoose.startSession();
  let donation;
  let alreadyCompleted = false;
  try {
    await session.withTransaction(async () => {
      donation = await Donation.findOneAndUpdate(
        { paystackReference: data.reference },
        {
          $setOnInsert: {
            campaignId: data.campaignId,
            donorId: data.donorId || null,
            isAnonymous: Boolean(data.isAnonymous),
            displayName: data.isAnonymous ? "Anonymous" : data.displayName,
            amount: data.amount,
            message: data.message,
            paymentMethod: data.paymentMethod,
            paystackReference: data.reference,
          },
        },
        { new: true, upsert: true, session, runValidators: true }
      );
      if (donation?.status === "completed") {
        alreadyCompleted = true;
        return;
      }
      if (donation.amount !== data.amount) {
        throw new Error("Donation payment amount does not match the expected amount");
      }
      if (data.currency && data.currency !== "GHS") {
        throw new Error("Donation payment currency does not match");
      }
      if (data.debitWallet) {
        const user = await User.findOneAndUpdate(
          { _id: donation.donorId, walletBalance: { $gte: donation.amount } },
          { $inc: { walletBalance: -donation.amount } },
          { new: true, session }
        );
        if (!user) {
          const error = new Error("Insufficient wallet balance");
          error.statusCode = 400;
          throw error;
        }
      }
      donation.status = "completed";
      donation.paidAt = data.paidAt || new Date();
      await donation.save({ session });
      const campaign = await Campaign.findOneAndUpdate(
        { _id: donation.campaignId },
        { $inc: { raisedAmount: donation.amount, donorCount: 1 } },
        { new: true, session }
      );
      if (!campaign) throw new Error("Campaign not found for donation");
      await reconcileCampaignLifecycle(campaign, {
        now: data.paidAt || new Date(),
        session,
      });
      const creatorWantsDonationAlerts = await User.exists({
        _id: campaign.creatorId,
        "preferences.donationNotifications": { $ne: false },
      }).session(session);
      if (creatorWantsDonationAlerts) {
        await Notification.create([{
          userId: campaign.creatorId,
          type: "donation_received",
          title: "Donation received",
          body: `Your campaign received GHS ${(donation.amount / 100).toFixed(2)}.`,
          relatedCampaignId: campaign._id,
        }], { session });
      }
      if (donation.donorId) {
        await Notification.create([{
          userId: donation.donorId,
          type: "payment_confirmed",
          title: "Donation confirmed",
          body: `Your GHS ${(donation.amount / 100).toFixed(2)} donation was received.`,
          relatedCampaignId: campaign._id,
        }], { session });
        await audit({ actorId: donation.donorId, action: "campaign.donation_completed", targetType: "campaign", targetId: donation.campaignId, metadata: { donationId: donation._id, amount: donation.amount }, session });
      }
    });
  } finally {
    await session.endSession();
  }
  return { donation, alreadyCompleted };
}

export async function completeWalletDeposit(data) {
  const session = await mongoose.startSession();
  let transaction;
  let alreadyCompleted = false;

  await session.withTransaction(async () => {
    transaction = await WalletTransaction.findOne({
      reference: data.reference,
      type: "deposit",
    }).session(session);
    if (!transaction) throw new Error("Wallet deposit was not found");
    if (transaction.status === "completed") {
      alreadyCompleted = true;
      return;
    }
    if (transaction.amount !== data.amount || data.currency !== "GHS") {
      throw new Error("Wallet deposit amount or currency does not match");
    }

    transaction.status = "completed";
    transaction.channel = data.channel || transaction.channel;
    transaction.completedAt = data.paidAt || new Date();
    transaction.failureReason = "";
    await transaction.save({ session });
    await User.updateOne(
      { _id: transaction.userId },
      { $inc: { walletBalance: transaction.amount } },
      { session }
    );
    await audit({
      actorId: transaction.userId,
      action: "wallet.deposit_completed",
      targetType: "wallet_transaction",
      targetId: transaction._id,
      metadata: { reference: transaction.reference, amount: transaction.amount },
      session,
    });
  });

  await session.endSession();
  return { transaction, alreadyCompleted };
}

export async function completeWalletWithdrawal(reference) {
  return WalletTransaction.findOneAndUpdate(
    { reference, type: "withdrawal", status: { $in: ["initialized", "pending"] } },
    { $set: { status: "completed", completedAt: new Date(), failureReason: "" } },
    { new: true }
  );
}

export async function refundWalletWithdrawal(reference, status = "failed", reason = "") {
  const session = await mongoose.startSession();
  let transaction;

  await session.withTransaction(async () => {
    transaction = await WalletTransaction.findOneAndUpdate(
      {
        reference,
        type: "withdrawal",
        status: { $in: ["initialized", "pending"] },
      },
      {
        $set: {
          status: status === "reversed" ? "reversed" : "failed",
          failureReason: String(reason || "Transfer could not be completed").slice(0, 500),
        },
      },
      { new: true, session }
    );
    if (!transaction) return;
    await User.updateOne(
      { _id: transaction.userId },
      { $inc: { walletBalance: transaction.amount } },
      { session }
    );
  });

  await session.endSession();
  return transaction;
}
