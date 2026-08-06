import crypto from "crypto";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { reconcileCampaignById } from "../services/campaignLifecycleService.js";
import { Contribution } from "../models/Contribution.js";
import { DebtPayment } from "../models/DebtPayment.js";
import { Donation } from "../models/Donation.js";
import { Group } from "../models/Group.js";
import { GroupDelinquency } from "../models/GroupDelinquency.js";
import { GroupMember } from "../models/GroupMember.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import {
  completeContribution,
  completeDebtRepayment,
  completeDonation,
  completeWalletDeposit,
  completeWalletWithdrawal,
  refundWalletWithdrawal,
} from "../services/paymentService.js";
import {
  initializeTransaction,
  verifyTransaction,
} from "../services/paystackService.js";
import { transferService } from "../services/transfer/index.js";
import { nowForGroup } from "../services/developmentClockService.js";
import { ensureNextPayout } from "../services/payoutScheduleService.js";

const MIN_DEPOSIT = 100;
const MIN_WITHDRAWAL = 100;
const MAX_WALLET_TRANSACTION = 10_000_000;
const appUrlPrefix = `${env.appScheme}://`;

function paymentReturnUrl(requestedUrl, fallbackPath) {
  const requested = String(requestedUrl || "").trim();
  if (requested.startsWith(appUrlPrefix)) return requested;
  if (env.nodeEnv !== "production" && requested.startsWith("exp://")) return requested;
  return `${appUrlPrefix}${fallbackPath.replace(/^\//, "")}`;
}

function currentAppReturnUrl(url) {
  return String(url || "").replace(/^susucycle:\/\//, appUrlPrefix);
}

function paymentReference(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function validAmount(amount, minimum) {
  return Number.isInteger(amount) && amount >= minimum && amount <= MAX_WALLET_TRANSACTION;
}

function normalizeGhanaPhone(value) {
  let phone = String(value || "").replace(/[^\d+]/g, "");
  if (phone.startsWith("+233")) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith("233")) phone = `0${phone.slice(3)}`;
  return /^0\d{9}$/.test(phone) ? phone : null;
}

function scheduledContribution(contribution, now = new Date()) {
  const start = new Date(contribution.startDate);
  if (start > now) return { cycleNumber: 1, dueDate: start };

  if (contribution.frequency === "daily") {
    const elapsed = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + elapsed);
    return { cycleNumber: elapsed + 1, dueDate };
  }
  if (contribution.frequency === "weekly") {
    const elapsed = Math.floor((now.getTime() - start.getTime()) / (7 * 86_400_000));
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + elapsed * 7);
    return { cycleNumber: elapsed + 1, dueDate };
  }

  const elapsed = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      now.getMonth() -
      start.getMonth() -
      (now.getDate() < start.getDate() ? 1 : 0)
  );
  const dueDate = new Date(start);
  dueDate.setMonth(start.getMonth() + elapsed);
  return { cycleNumber: elapsed + 1, dueDate };
}

function serializeWalletTransaction(transaction) {
  const relatedGroup = transaction.relatedGroupId;
  const relatedSavingsPot = transaction.relatedSavingsPotId;
  return {
    _id: transaction._id,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
    reference: transaction.reference,
    relatedGroupId: relatedGroup?._id || relatedGroup || null,
    groupName: relatedGroup?.name || "",
    relatedSavingsPotId: relatedSavingsPot?._id || relatedSavingsPot || null,
    savingsPotName: relatedSavingsPot?.name || "",
    channel: transaction.channel,
    destination: transaction.destination,
    transferMode: transaction.transferMode,
    failureReason: transaction.failureReason,
    completedAt: transaction.completedAt,
    createdAt: transaction.createdAt,
  };
}

function serializeContribution(contribution) {
  return {
    _id: contribution._id,
    groupId: contribution.groupId,
    userId: contribution.userId,
    amount: contribution.amount,
    cycleNumber: contribution.cycleNumber,
    dueDate: contribution.dueDate,
    paidAt: contribution.paidAt,
    status: contribution.status,
    paymentMethod: contribution.paymentMethod,
    paystackReference: contribution.paystackReference,
    createdAt: contribution.createdAt,
  };
}

function serializeDonation(donation) {
  return {
    _id: donation._id,
    campaignId: donation.campaignId,
    donorId: donation.donorId,
    isAnonymous: donation.isAnonymous,
    displayName: donation.displayName,
    amount: donation.amount,
    message: donation.message,
    paymentMethod: donation.paymentMethod,
    paystackReference: donation.paystackReference,
    status: donation.status,
    paidAt: donation.paidAt,
    createdAt: donation.createdAt,
  };
}

function serializeDebtPayment(payment) {
  return {
    _id: payment._id,
    delinquencyId: payment.delinquencyId,
    groupId: payment.groupId,
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    reference: payment.reference,
    status: payment.status,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  };
}

export async function listGroupDebts(req, res) {
  const debts = await GroupDelinquency.find({
    userId: req.user._id,
    status: "open",
    liabilityType: "post_payout_debt",
  })
    .populate("groupId", "name coverImageUrl")
    .populate("creditorUserId", "fullName avatarUrl")
    .populate("creditorAllocations.userId", "fullName avatarUrl")
    .sort({ createdAt: 1 });
  return res.json({
    success: true,
    data: {
      totalAmount: debts.reduce((sum, debt) => sum + debt.amountDue, 0),
      debts: debts.map((debt) => ({
        _id: debt._id,
        group: debt.groupId,
        creditor: debt.creditorUserId,
        creditors: debt.creditorAllocations?.length
          ? debt.creditorAllocations.map((allocation) => ({
              user: allocation.userId,
              amount: allocation.amount,
            }))
          : [{
              user: debt.creditorUserId,
              amount: debt.amountDue,
            }],
        cycleNumber: debt.cycleNumber,
        amountDue: debt.amountDue,
        dueDate: debt.dueDate,
        createdAt: debt.createdAt,
      })),
    },
  });
}

export async function startDebtRepayment(req, res) {
  const paymentMethod = req.body.paymentMethod;
  if (!["mobile_money", "card", "wallet"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: "Choose a valid payment method" });
  }
  const debt = await GroupDelinquency.findOne({
    _id: req.params.debtId,
    userId: req.user._id,
    status: "open",
    liabilityType: "post_payout_debt",
  });
  if (!debt) {
    return res.status(404).json({ success: false, message: "Outstanding group debt not found" });
  }
  if (!debt.creditorUserId) {
    return res.status(409).json({
      success: false,
      message: "This debt needs account review before it can be repaid",
    });
  }

  const existing = await DebtPayment.findOne({
    delinquencyId: debt._id,
    userId: req.user._id,
    paymentMethod,
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .select("+authorizationUrl");
  if (existing?.authorizationUrl) {
    return res.json({
      success: true,
      message: "Resume pending debt repayment",
      data: {
        payment: serializeDebtPayment(existing),
        paymentType: "paystack",
        reference: existing.reference,
        authorizationUrl: existing.authorizationUrl,
      },
    });
  }

  const reference = paymentReference(
    paymentMethod === "wallet" ? "ksf_wallet_debt" : "ksf_debt"
  );
  const payment = await DebtPayment.create({
    delinquencyId: debt._id,
    groupId: debt.groupId,
    userId: req.user._id,
    creditorUserId: debt.creditorUserId,
    amount: debt.amountDue,
    paymentMethod,
    reference,
    returnUrl: paymentReturnUrl(req.body.callbackUrl, "wallet/debts"),
  });

  if (paymentMethod === "wallet") {
    try {
      const result = await completeDebtRepayment({
        reference,
        amount: payment.amount,
        paidAt: new Date(),
        debitWallet: true,
      });
      return res.status(201).json({
        success: true,
        message: "Group debt repaid from wallet",
        data: {
          payment: serializeDebtPayment(result.payment),
          paymentType: "wallet",
          reference,
        },
      });
    } catch (error) {
      payment.status = "failed";
      payment.failureReason = error.message;
      await payment.save();
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  try {
    const configuredCallback = env.paystackCallbackUrl;
    const callbackUrl = configuredCallback.startsWith("https://")
      ? configuredCallback
      : payment.returnUrl;
    const paystackData = await initializeTransaction({
      email: req.user.email,
      amount: payment.amount,
      currency: "GHS",
      reference,
      channels: [paymentMethod === "card" ? "card" : "mobile_money"],
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      metadata: {
        kind: "debt_repayment",
        debtPaymentId: String(payment._id),
        delinquencyId: String(debt._id),
        groupId: String(debt.groupId),
        userId: String(req.user._id),
        paymentMethod,
      },
    });
    payment.authorizationUrl = paystackData.authorization_url;
    payment.paystackAccessCode = paystackData.access_code;
    await payment.save();
    return res.status(201).json({
      success: true,
      data: {
        payment: serializeDebtPayment(payment),
        paymentType: "paystack",
        reference,
        authorizationUrl: paystackData.authorization_url,
      },
    });
  } catch (error) {
    payment.status = "failed";
    payment.failureReason = error.message;
    await payment.save();
    return res.status(error.statusCode || 502).json({ success: false, message: error.message });
  }
}

export async function verifyDebtRepayment(req, res) {
  const payment = await DebtPayment.findOne({
    userId: req.user._id,
    reference: req.params.reference,
  });
  if (!payment || String(payment.delinquencyId) !== String(req.params.debtId)) {
    return res.status(404).json({ success: false, message: "Debt repayment not found" });
  }
  if (payment.status === "paid") {
    return res.json({ success: true, data: serializeDebtPayment(payment) });
  }
  try {
    const paystackPayment = await verifyTransaction(payment.reference);
    if (paystackPayment.status !== "success") {
      return res.status(202).json({
        success: true,
        message: "Debt repayment is still pending",
        data: serializeDebtPayment(payment),
      });
    }
    const result = await completeDebtRepayment({
      reference: paystackPayment.reference,
      amount: paystackPayment.amount,
      paidAt: paystackPayment.paid_at ? new Date(paystackPayment.paid_at) : new Date(),
    });
    return res.json({ success: true, data: serializeDebtPayment(result.payment) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function getWallet(req, res) {
  const transactions = await WalletTransaction.find({ userId: req.user._id })
    .populate("relatedGroupId", "name")
    .populate("relatedSavingsPotId", "name")
    .sort({ createdAt: -1 })
    .limit(50);
  return res.json({
    success: true,
    data: {
      balance: req.user.walletBalance,
      currency: "GHS",
      transactions: transactions.map(serializeWalletTransaction),
    },
  });
}

export async function initializeWalletDeposit(req, res) {
  const amount = req.body.amount;
  if (!validAmount(amount, MIN_DEPOSIT)) {
    return res.status(400).json({
      success: false,
      message: "Deposit amount must be between GHS 1 and GHS 100,000",
    });
  }

  const reference = paymentReference("ksf_dep");
  const transaction = await WalletTransaction.create({
    userId: req.user._id,
    type: "deposit",
    amount,
    reference,
    status: "initialized",
    returnUrl: paymentReturnUrl(req.body.callbackUrl, "wallet/add-money"),
  });

  try {
    const configuredCallback = env.paystackCallbackUrl;
    const callbackUrl = configuredCallback.startsWith("https://")
      ? configuredCallback
      : transaction.returnUrl;
    const paystackData = await initializeTransaction({
      email: req.user.email,
      amount,
      currency: "GHS",
      reference,
      channels: ["card", "mobile_money"],
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      metadata: {
        kind: "wallet_deposit",
        userId: String(req.user._id),
        walletTransactionId: String(transaction._id),
      },
    });
    transaction.paystackAccessCode = paystackData.access_code;
    await transaction.save();

    return res.status(201).json({
      success: true,
      data: {
        reference,
        authorizationUrl: paystackData.authorization_url,
        accessCode: paystackData.access_code,
      },
    });
  } catch (error) {
    transaction.status = "failed";
    transaction.failureReason = error.message;
    await transaction.save();
    return res.status(error.statusCode || 502).json({ success: false, message: error.message });
  }
}

export async function paystackCallback(req, res) {
  const reference = String(req.query.reference || req.query.trxref || "").trim();
  if (!reference) {
    return res.status(400).send("Payment reference is missing");
  }

  const transaction = await WalletTransaction.findOne({
    reference,
    type: "deposit",
  }).select("+returnUrl");
  const contribution = transaction
    ? null
    : await Contribution.findOne({ paystackReference: reference }).select("+returnUrl");
  const donation = transaction || contribution
    ? null
    : await Donation.findOne({ paystackReference: reference }).select("+returnUrl");
  const debtPayment = transaction || contribution || donation
    ? null
    : await DebtPayment.findOne({ reference }).select("+returnUrl");
  if (!transaction && !contribution && !donation && !debtPayment) {
    return res.status(404).send("Payment was not found");
  }

  const storedReturnUrl = transaction
    ? transaction.returnUrl || `${appUrlPrefix}wallet/add-money`
    : contribution
      ? contribution.returnUrl || `${appUrlPrefix}groups/${contribution.groupId}/contribute`
      : donation
        ? donation.returnUrl || `${appUrlPrefix}fundraising/${donation.campaignId}/donate`
        : debtPayment.returnUrl || `${appUrlPrefix}wallet/debts`;
  const returnUrl = currentAppReturnUrl(storedReturnUrl);
  const separator = returnUrl.includes("?") ? "&" : "?";
  return res.redirect(302, `${returnUrl}${separator}reference=${encodeURIComponent(reference)}`);
}

export async function verifyWalletDeposit(req, res) {
  const transaction = await WalletTransaction.findOne({
    reference: req.params.reference,
    userId: req.user._id,
    type: "deposit",
  });
  if (!transaction) {
    return res.status(404).json({ success: false, message: "Deposit not found" });
  }
  if (transaction.status === "completed") {
    return res.json({ success: true, data: serializeWalletTransaction(transaction) });
  }

  try {
    const payment = await verifyTransaction(transaction.reference);
    if (payment.status !== "success") {
      return res.status(202).json({
        success: true,
        message: "Payment is still pending",
        data: serializeWalletTransaction(transaction),
      });
    }
    const result = await completeWalletDeposit({
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      channel: payment.channel,
      paidAt: payment.paid_at ? new Date(payment.paid_at) : new Date(),
    });
    return res.json({ success: true, data: serializeWalletTransaction(result.transaction) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function getPayoutProviders(_req, res) {
  try {
    const providers = await transferService.listProviders();
    return res.json({
      success: true,
      data: providers,
    });
  } catch (error) {
    return res.status(error.statusCode || 502).json({ success: false, message: error.message });
  }
}

export async function createWalletWithdrawal(req, res) {
  const amount = req.body.amount;
  const accountNumber = normalizeGhanaPhone(req.body.accountNumber);
  const providerCode = String(req.body.providerCode || "").trim().toUpperCase();
  const providerName = String(req.body.providerName || providerCode).trim().slice(0, 80);

  if (!validAmount(amount, MIN_WITHDRAWAL)) {
    return res.status(400).json({
      success: false,
      message: "Withdrawal amount must be between GHS 1 and GHS 100,000",
    });
  }
  if (!accountNumber || !/^[A-Z0-9_-]{2,20}$/.test(providerCode)) {
    return res.status(400).json({
      success: false,
      message: "A valid Ghana mobile money number and provider are required",
    });
  }
  if (req.user.walletBalance < amount) {
    return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
  }

  let recipient;
  try {
    recipient = await transferService.createRecipient({
      name: req.user.fullName,
      accountNumber,
      providerCode,
      currency: "GHS",
    });
  } catch (error) {
    return res.status(error.statusCode || 502).json({ success: false, message: error.message });
  }

  const reference = paymentReference("ksf_wdr");
  const session = await mongoose.startSession();
  let transaction;
  try {
    await session.withTransaction(async () => {
      const user = await User.findOneAndUpdate(
        { _id: req.user._id, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } },
        { new: true, session }
      );
      if (!user) {
        const error = new Error("Insufficient wallet balance");
        error.statusCode = 400;
        throw error;
      }
      [transaction] = await WalletTransaction.create(
        [{
          userId: req.user._id,
          type: "withdrawal",
          amount,
          reference,
          status: "pending",
          paystackRecipientCode: recipient.recipientCode,
          transferMode: recipient.mode,
          transferMetadata: {
            mocked: recipient.mocked,
            note: recipient.note,
          },
          destination: {
            providerCode,
            providerName,
            accountLast4: accountNumber.slice(-4),
          },
        }],
        { session }
      );
    });
  } catch (error) {
    await session.endSession();
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
  await session.endSession();

  try {
    const transfer = await transferService.initiate({
      amount,
      recipientCode: recipient.recipientCode,
      reference,
      reason: "KasaFund wallet withdrawal",
      currency: "GHS",
    });
    transaction.paystackTransferCode = transfer.transferCode || "";
    transaction.transferMode = transfer.mode;
    transaction.transferMetadata = {
      mocked: transfer.mocked,
      note: transfer.note,
      providerStatus: transfer.status,
    };
    await transaction.save();

    if (transfer.status === "success") {
      transaction = (await completeWalletWithdrawal(reference)) || transaction;
    }
    return res.status(201).json({
      success: true,
      message: transfer.message,
      data: {
        transaction: serializeWalletTransaction(transaction),
        requiresOtp: transfer.status === "otp",
        transferCode: transfer.status === "otp" ? transfer.transferCode : undefined,
        mocked: transfer.mocked,
      },
    });
  } catch (error) {
    if (error.statusCode === 400) {
      await refundWalletWithdrawal(reference, "failed", error.message);
      return res.status(400).json({ success: false, message: error.message });
    }

    // The transfer request may have reached Paystack. Reconcile by reference before refunding.
    try {
      const transfer = await transferService.verify(reference);
      if (transfer.status === "success") await completeWalletWithdrawal(reference);
      else if (["failed", "reversed"].includes(transfer.status)) {
        await refundWalletWithdrawal(reference, transfer.status, transfer.reason);
      }
    } catch {
      // Keep funds reserved and let the signed webhook provide the final status.
    }
    return res.status(202).json({
      success: true,
      message: "Withdrawal is being confirmed",
      data: {
        transaction: serializeWalletTransaction(transaction),
        requiresOtp: false,
        mocked: Boolean(transaction.transferMetadata?.mocked),
      },
    });
  }
}

export async function finalizeWalletWithdrawal(req, res) {
  const transaction = await WalletTransaction.findOne({
    reference: req.params.reference,
    userId: req.user._id,
    type: "withdrawal",
    status: "pending",
  });
  if (!transaction) {
    return res.status(404).json({ success: false, message: "Pending withdrawal not found" });
  }
  const otp = String(req.body.otp || "").trim();
  if (!/^\d{4,8}$/.test(otp) || !transaction.paystackTransferCode) {
    return res.status(400).json({ success: false, message: "A valid transfer OTP is required" });
  }

  try {
    const transfer = await transferService.finalize({
      transferCode: transaction.paystackTransferCode,
      otp,
    });
    if (transfer.status === "success") {
      await completeWalletWithdrawal(transaction.reference);
    }
    const updated = await WalletTransaction.findById(transaction._id);
    return res.json({ success: true, data: serializeWalletTransaction(updated) });
  } catch (error) {
    return res.status(error.statusCode || 502).json({ success: false, message: error.message });
  }
}

export async function startContribution(req, res) {
  const group = await Group.findOne({ _id: req.params.groupId, status: "active" });
  const member = await GroupMember.findOne({ groupId: req.params.groupId, userId: req.user._id, status: "active" });
  if (!group || !member) return res.status(404).json({ success: false, message: "Active group membership required" });
  const contributionNow = nowForGroup(group._id);
  const paymentMethod = req.body.paymentMethod;
  if (!["mobile_money", "card", "wallet"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: "Choose a valid payment method" });
  }

  const scheduledPayout = await ensureNextPayout(group._id);
  if (
    scheduledPayout?.expectedContributorIds?.length &&
    !scheduledPayout.expectedContributorIds.some(
      (userId) => String(userId) === String(req.user._id)
    )
  ) {
    return res.status(409).json({
      success: false,
      message: "You joined after this cycle started. Your contributions begin next cycle",
    });
  }
  const schedule = scheduledPayout
    ? {
        cycleNumber: scheduledPayout.cycleNumber,
        dueDate: scheduledPayout.scheduledDate,
        amount: scheduledPayout.contributionAmount || group.contribution.amount,
      }
    : {
        ...scheduledContribution(group.contribution),
        amount: group.contribution.amount,
      };
  if (scheduledPayout && !scheduledPayout.snapshotLockedAt) {
    scheduledPayout.snapshotLockedAt = contributionNow;
    await scheduledPayout.save();
  }
  const existing = await Contribution.findOne({
    groupId: group._id,
    userId: req.user._id,
    cycleNumber: schedule.cycleNumber,
    status: { $in: ["pending", "paid"] },
  })
    .sort({ createdAt: -1 })
    .select("+authorizationUrl");
  if (existing?.status === "paid") {
    return res.status(409).json({
      success: false,
      message: "You have already paid this contribution cycle",
    });
  }
  if (existing?.authorizationUrl) {
    return res.json({
      success: true,
      message: "Resume pending contribution",
      data: {
        contribution: serializeContribution(existing),
        paymentType: "paystack",
        reference: existing.paystackReference,
        authorizationUrl: existing.authorizationUrl,
      },
    });
  }

  const reference = paymentReference(paymentMethod === "wallet" ? "ksf_wallet_con" : "ksf_con");
  if (paymentMethod === "wallet") {
    try {
      const result = await completeContribution({
        reference,
        groupId: group._id,
        userId: req.user._id,
        amount: schedule.amount,
        cycleNumber: schedule.cycleNumber,
        dueDate: schedule.dueDate,
        paymentMethod: "wallet",
        paidAt: contributionNow,
        debitWallet: true,
      });
      return res.status(201).json({
        success: true,
        message: "Contribution paid from wallet",
        data: {
          contribution: serializeContribution(result.contribution),
          paymentType: "wallet",
          reference,
        },
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  const contribution = await Contribution.create({
    groupId: group._id,
    userId: req.user._id,
    amount: schedule.amount,
    cycleNumber: schedule.cycleNumber,
    dueDate: schedule.dueDate,
    paymentMethod,
    paystackReference: reference,
    returnUrl: paymentReturnUrl(
      req.body.callbackUrl,
      `groups/${group._id}/contribute`
    ),
  });
  member.lastContributionStatus = "pending";
  await member.save();

  try {
    const configuredCallback = env.paystackCallbackUrl;
    const callbackUrl = configuredCallback.startsWith("https://")
      ? configuredCallback
      : contribution.returnUrl;
    const paystackData = await initializeTransaction({
      email: req.user.email,
      amount: contribution.amount,
      currency: "GHS",
      reference,
      channels: [paymentMethod === "card" ? "card" : "mobile_money"],
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      metadata: {
        kind: "contribution",
        groupId: String(group._id),
        userId: String(req.user._id),
        cycleNumber: contribution.cycleNumber,
        dueDate: contribution.dueDate,
        paymentMethod,
      },
    });
    contribution.authorizationUrl = paystackData.authorization_url;
    contribution.paystackAccessCode = paystackData.access_code;
    await contribution.save();
    return res.status(201).json({
      success: true,
      data: {
        contribution: serializeContribution(contribution),
        paymentType: "paystack",
        reference,
        authorizationUrl: paystackData.authorization_url,
      },
    });
  } catch (error) {
    contribution.status = "failed";
    await contribution.save();
    member.lastContributionStatus = "pending";
    await member.save();
    return res.status(error.statusCode || 502).json({ success: false, message: error.message });
  }
}

export async function verifyContribution(req, res) {
  const contribution = await Contribution.findOne({
    groupId: req.params.groupId,
    userId: req.user._id,
    paystackReference: req.params.reference,
  });
  if (!contribution) {
    return res.status(404).json({ success: false, message: "Contribution not found" });
  }
  if (contribution.status === "paid") {
    return res.json({ success: true, data: serializeContribution(contribution) });
  }

  try {
    const payment = await verifyTransaction(contribution.paystackReference);
    if (payment.status !== "success") {
      return res.status(202).json({
        success: true,
        message: "Contribution payment is still pending",
        data: serializeContribution(contribution),
      });
    }
    const result = await completeContribution({
      reference: payment.reference,
      amount: payment.amount,
      paymentMethod: contribution.paymentMethod,
      paidAt: payment.paid_at ? new Date(payment.paid_at) : new Date(),
    });
    return res.json({
      success: true,
      data: serializeContribution(result.contribution),
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function startDonation(req, res) {
  if (!validAmount(req.body.amount, 100)) {
    return res.status(400).json({ success: false, message: "Donation must be between GHS 1 and GHS 100,000" });
  }
  const campaign = await reconcileCampaignById(req.params.campaignId);
  if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" });
  if (campaign.status !== "active") {
    return res.status(400).json({
      success: false,
      message: campaign.status === "completed" ? "This campaign has reached its goal" : "This campaign has ended",
    });
  }
  const amountRemaining = campaign.goalAmount - campaign.raisedAmount;
  if (req.body.amount > amountRemaining) {
    return res.status(400).json({
      success: false,
      message: `Only GHS ${(amountRemaining / 100).toFixed(2)} remains to reach this campaign's goal`,
    });
  }
  const paymentMethod = req.body.paymentMethod;
  if (!["mobile_money", "card", "wallet"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: "Choose a valid payment method" });
  }
  const isAnonymous = Boolean(req.body.isAnonymous);
  if (isAnonymous && !campaign.allowAnonymousDonations) {
    return res.status(400).json({ success: false, message: "This campaign does not allow anonymous donations" });
  }
  const reference = paymentReference(paymentMethod === "wallet" ? "ksf_wallet_don" : "ksf_don");

  if (paymentMethod === "wallet") {
    try {
      const result = await completeDonation({
        reference,
        campaignId: campaign._id,
        donorId: req.user._id,
        isAnonymous,
        displayName: req.user.fullName,
        amount: req.body.amount,
        message: String(req.body.message || "").trim(),
        paymentMethod: "wallet",
        currency: "GHS",
        paidAt: new Date(),
        debitWallet: true,
      });
      return res.status(201).json({
        success: true,
        message: "Donation paid from wallet",
        data: {
          donation: serializeDonation(result.donation),
          paymentType: "wallet",
          reference,
        },
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  const donation = await Donation.create({
    campaignId: campaign._id,
    donorId: req.user._id,
    isAnonymous,
    displayName: isAnonymous ? "Anonymous" : req.user.fullName,
    amount: req.body.amount,
    message: String(req.body.message || "").trim(),
    paymentMethod,
    paystackReference: reference,
    returnUrl: paymentReturnUrl(
      req.body.callbackUrl,
      `fundraising/${campaign._id}/donate`
    ),
  });

  try {
    const configuredCallback = env.paystackCallbackUrl;
    const callbackUrl = configuredCallback.startsWith("https://")
      ? configuredCallback
      : donation.returnUrl;
    const paystackData = await initializeTransaction({
      email: req.user.email,
      amount: donation.amount,
      currency: "GHS",
      reference,
      channels: [paymentMethod],
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      metadata: {
        kind: "donation",
        campaignId: String(campaign._id),
        donorId: String(req.user._id),
        isAnonymous,
        displayName: isAnonymous ? "Anonymous" : req.user.fullName,
        paymentMethod,
      },
    });
    donation.authorizationUrl = paystackData.authorization_url;
    donation.paystackAccessCode = paystackData.access_code;
    await donation.save();
    return res.status(201).json({
      success: true,
      data: {
        donation: serializeDonation(donation),
        paymentType: "paystack",
        reference,
        authorizationUrl: paystackData.authorization_url,
      },
    });
  } catch (error) {
    donation.status = "failed";
    await donation.save();
    return res.status(error.statusCode || 502).json({ success: false, message: error.message });
  }
}

export async function verifyDonation(req, res) {
  const donation = await Donation.findOne({
    campaignId: req.params.campaignId,
    donorId: req.user._id,
    paystackReference: req.params.reference,
  });
  if (!donation) {
    return res.status(404).json({ success: false, message: "Donation not found" });
  }
  if (donation.status === "completed") {
    return res.json({ success: true, data: serializeDonation(donation) });
  }

  try {
    const payment = await verifyTransaction(donation.paystackReference);
    if (payment.status !== "success") {
      return res.status(202).json({
        success: true,
        message: "Donation payment is still pending",
        data: serializeDonation(donation),
      });
    }
    const result = await completeDonation({
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: donation.paymentMethod,
      paidAt: payment.paid_at ? new Date(payment.paid_at) : new Date(),
    });
    return res.json({ success: true, data: serializeDonation(result.donation) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function paystackWebhook(req, res) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(503).json({ success: false, message: "Payments are not configured" });
  }
  const signature = req.headers["x-paystack-signature"];
  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest("hex");
  const receivedBuffer = Buffer.from(String(signature || ""));
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return res.status(401).json({ success: false, message: "Invalid webhook signature" });
  }

  const event = JSON.parse(req.body.toString("utf8"));
  if (["transfer.success", "transfer.failed", "transfer.reversed"].includes(event.event)) {
    if (event.event === "transfer.success") {
      await completeWalletWithdrawal(event.data.reference);
    } else {
      await refundWalletWithdrawal(
        event.data.reference,
        event.event === "transfer.reversed" ? "reversed" : "failed",
        event.data.reason || event.data.failures
      );
    }
    return res.sendStatus(200);
  }
  if (event.event !== "charge.success") return res.sendStatus(200);
  const payment = event.data;
  const metadata = payment.metadata || {};
  const common = {
    reference: payment.reference,
    amount: payment.amount,
    currency: payment.currency,
    paymentMethod:
      metadata.paymentMethod ||
      ({ mobile_money: "mobile_money", card: "card", bank: "bank_transfer", bank_transfer: "bank_transfer" }[payment.channel]),
    paidAt: payment.paid_at ? new Date(payment.paid_at) : new Date(),
  };
  if (metadata.kind === "contribution") {
    await completeContribution({ ...metadata, ...common });
  } else if (metadata.kind === "debt_repayment") {
    await completeDebtRepayment({ ...metadata, ...common });
  } else if (metadata.kind === "donation") {
    await completeDonation({ ...metadata, ...common });
  } else if (metadata.kind === "wallet_deposit") {
    await completeWalletDeposit({
      ...common,
      channel: payment.channel,
    });
  }
  return res.sendStatus(200);
}
