import { Router } from "express";
import {
  createWhatsAppLinkCode,
  getWhatsAppLinkStatus,
  receiveWhatsAppWebhook,
  unlinkWhatsApp,
  verifyWhatsAppWebhook,
} from "../controllers/whatsappController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/link", requireAuth, getWhatsAppLinkStatus);
router.post("/link/code", requireAuth, createWhatsAppLinkCode);
router.delete("/link", requireAuth, unlinkWhatsApp);
router.get("/webhook", verifyWhatsAppWebhook);
router.post("/webhook", receiveWhatsAppWebhook);

export default router;
