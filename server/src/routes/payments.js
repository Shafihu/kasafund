import { Router } from "express";
import express from "express";
import {
  createWalletWithdrawal,
  finalizeWalletWithdrawal,
  getPayoutProviders,
  getPayoutMethod,
  savePayoutMethod,
  listGroupDebts,
  getWallet,
  initializeWalletDeposit,
  startDebtRepayment,
  paystackCallback,
  paystackWebhook,
  verifyWalletDeposit,
  verifyDebtRepayment,
} from "../controllers/paymentController.js";
import { kycAction, requireAuth, requireKyc } from "../middleware/auth.js";

const router = Router();
router.post("/paystack/webhook", express.raw({ type: "application/json", limit: "1mb" }), paystackWebhook);
router.get("/paystack/callback", paystackCallback);
router.use(express.json({ limit: "1mb" }));
router.get("/wallet", requireAuth, getWallet);
router.get("/debts", requireAuth, listGroupDebts);
router.post(
  "/debts/:debtId/repay",
  requireAuth,
  kycAction("repay an overdue group contribution"),
  requireKyc,
  startDebtRepayment
);
router.post(
  "/debts/:debtId/repayments/:reference/verify",
  requireAuth,
  verifyDebtRepayment
);
router.get("/wallet/payout-providers", requireAuth, getPayoutProviders);
router.get("/wallet/payout-method", requireAuth, getPayoutMethod);
router.put(
  "/wallet/payout-method",
  requireAuth,
  kycAction("set up a payout method"),
  requireKyc,
  savePayoutMethod
);
router.post("/wallet/deposits", requireAuth, kycAction("add money to your wallet"), requireKyc, initializeWalletDeposit);
router.post("/wallet/deposits/:reference/verify", requireAuth, verifyWalletDeposit);
router.post("/wallet/withdrawals", requireAuth, kycAction("withdraw money"), requireKyc, createWalletWithdrawal);
router.post(
  "/wallet/withdrawals/:reference/finalize",
  requireAuth,
  finalizeWalletWithdrawal
);

export default router;
