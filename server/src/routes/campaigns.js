import { Router } from "express";
import {
  addCampaignComment,
  addCampaignUpdate,
  createCampaign,
  getCampaign,
  listCampaigns,
  listDonatedCampaigns,
  reportCampaign,
  updateCampaign,
} from "../controllers/campaignController.js";
import { startDonation, verifyDonation } from "../controllers/paymentController.js";
import { kycAction, requireAuth, requireKyc } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", listCampaigns);
router.get("/donated", listDonatedCampaigns);
router.post("/", kycAction("create a fundraiser"), requireKyc, createCampaign);
router.get("/:id", getCampaign);
router.patch("/:id", updateCampaign);
router.post("/:id/updates", addCampaignUpdate);
router.post("/:id/comments", addCampaignComment);
router.post("/:id/report", reportCampaign);
router.post("/:campaignId/donations", kycAction("make a donation"), requireKyc, startDonation);
router.post("/:campaignId/donations/:reference/verify", verifyDonation);

export default router;
