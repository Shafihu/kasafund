import crypto from "crypto";
import { SavingsPot } from "../models/SavingsPot.js";
import { SavingsTransaction } from "../models/SavingsTransaction.js";
import { audit } from "../utils/api.js";
import {
  depositToSavings,
  nextSavingsDate,
  withdrawFromSavings,
} from "../services/savingsService.js";

const MAX_AMOUNT = 100_000_000;

function validAmount(value) {
  return Number.isInteger(value) && value >= 100 && value <= MAX_AMOUNT;
}

function reference(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function listSavingsPots(req, res) {
  const pots = await SavingsPot.find({
    userId: req.user._id,
    status: { $ne: "closed" },
  }).sort({ updatedAt: -1 });
  return res.json({ success: true, data: pots });
}

export async function getSavingsPot(req, res) {
  const pot = await SavingsPot.findOne({ _id: req.params.id, userId: req.user._id });
  if (!pot) return res.status(404).json({ success: false, message: "Savings pot not found" });
  const transactions = await SavingsTransaction.find({ potId: pot._id })
    .sort({ createdAt: -1 })
    .limit(50);
  return res.json({ success: true, data: { pot, transactions } });
}

export async function createSavingsPot(req, res) {
  const { name, targetAmount, contributionAmount, frequency, targetDate, mode, autoSaveEnabled } = req.body;
  const endDate = new Date(targetDate);
  if (
    !String(name || "").trim() ||
    !validAmount(targetAmount) ||
    !validAmount(contributionAmount) ||
    !["daily", "weekly", "monthly"].includes(frequency) ||
    !["flexible", "locked"].includes(mode) ||
    Number.isNaN(endDate.getTime()) ||
    endDate.getTime() <= Date.now()
  ) {
    return res.status(400).json({ success: false, message: "Enter valid savings pot details and a future target date" });
  }

  const pot = await SavingsPot.create({
    userId: req.user._id,
    name: String(name).trim(),
    targetAmount,
    contributionAmount,
    frequency,
    targetDate: endDate,
    mode,
    autoSaveEnabled: Boolean(autoSaveEnabled),
    nextContributionAt: nextSavingsDate(new Date(), frequency),
  });
  await audit({
    actorId: req.user._id,
    action: "savings.created",
    targetType: "savings_pot",
    targetId: pot._id,
    metadata: { mode, autoSaveEnabled: Boolean(autoSaveEnabled) },
  });
  return res.status(201).json({ success: true, data: pot });
}

export async function updateSavingsPot(req, res) {
  const pot = await SavingsPot.findOne({ _id: req.params.id, userId: req.user._id });
  if (!pot) return res.status(404).json({ success: false, message: "Savings pot not found" });
  if (["completed", "closed"].includes(pot.status)) {
    return res.status(400).json({ success: false, message: "Completed savings pots cannot be changed" });
  }

  if (typeof req.body.autoSaveEnabled === "boolean") {
    pot.autoSaveEnabled = req.body.autoSaveEnabled;
    pot.failureReason = "";
    pot.lastAutoSaveStatus = "never";
  }
  if (["active", "paused"].includes(req.body.status)) {
    pot.status = req.body.status;
    if (pot.status === "paused") pot.autoSaveEnabled = false;
  }
  await pot.save();
  return res.json({ success: true, data: pot, message: "Savings pot updated" });
}

export async function depositSavings(req, res) {
  if (!validAmount(req.body.amount)) {
    return res.status(400).json({ success: false, message: "Enter a valid amount of at least GHS 1" });
  }
  try {
    const result = await depositToSavings({
      potId: req.params.id,
      userId: req.user._id,
      amount: req.body.amount,
      source: "wallet",
      reference: reference("ksf_save_dep"),
    });
    return res.status(201).json({ success: true, data: result, message: "Money added to savings" });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function withdrawSavings(req, res) {
  if (!validAmount(req.body.amount)) {
    return res.status(400).json({ success: false, message: "Enter a valid withdrawal amount" });
  }
  try {
    const result = await withdrawFromSavings({
      potId: req.params.id,
      userId: req.user._id,
      amount: req.body.amount,
      reference: reference("ksf_save_wd"),
    });
    return res.json({ success: true, data: result, message: "Savings moved to wallet" });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}
