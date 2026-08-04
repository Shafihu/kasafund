import { Router } from "express";
import {
  addAdminReportNote,
  getAdminOverview,
  getAdminCampaign,
  getAdminGroup,
  getAdminReport,
  getAdminUser,
  listAdminAuditLogs,
  listAdminCampaigns,
  listAdminGroups,
  listAdminReports,
  listAdminUsers,
  listKycReviewQueue,
  moderateAdminCampaign,
  reconcileAdminUserKyc,
  updateAdminReport,
} from "../controllers/adminController.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireSuperAdmin);
router.get("/overview", getAdminOverview);
router.get("/audit", listAdminAuditLogs);
router.get("/reports", listAdminReports);
router.get("/reports/:id", getAdminReport);
router.patch("/reports/:id", updateAdminReport);
router.post("/reports/:id/notes", addAdminReportNote);
router.get("/users", listAdminUsers);
router.get("/kyc-review", listKycReviewQueue);
router.get("/groups", listAdminGroups);
router.get("/groups/:id", getAdminGroup);
router.get("/campaigns", listAdminCampaigns);
router.get("/campaigns/:id", getAdminCampaign);
router.patch("/campaigns/:id/moderation", moderateAdminCampaign);
router.get("/users/:id", getAdminUser);
router.post("/users/:id/kyc/reconcile", reconcileAdminUserKyc);

export default router;
