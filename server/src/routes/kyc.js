import { Router } from "express";
import {
  getVerificationStatus,
  handleDiditWebhook,
  startVerification,
} from "../controllers/kycController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/webhook/didit", handleDiditWebhook);
router.post("/session", requireAuth, startVerification);
router.get("/status", requireAuth, getVerificationStatus);

export default router;
