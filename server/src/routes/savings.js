import { Router } from "express";
import {
  createSavingsPot,
  depositSavings,
  getSavingsPot,
  listSavingsPots,
  updateSavingsPot,
  withdrawSavings,
} from "../controllers/savingsController.js";
import { kycAction, requireAuth, requireKyc } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.get("/", listSavingsPots);
router.get("/:id", getSavingsPot);
router.post("/", kycAction("create a personal savings pot"), requireKyc, createSavingsPot);
router.patch("/:id", kycAction("manage personal savings"), requireKyc, updateSavingsPot);
router.post("/:id/deposits", kycAction("save money"), requireKyc, depositSavings);
router.post("/:id/withdrawals", kycAction("withdraw personal savings"), requireKyc, withdrawSavings);

export default router;
