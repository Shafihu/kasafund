import { Router } from "express";
import {
  activateGroup,
  createGroup,
  discoverGroups,
  getGroup,
  getGroupAccess,
  getJoinRequest,
  getJoinPreview,
  inviteMember,
  joinGroup,
  joinPublicGroup,
  leaveGroup,
  listInvitations,
  listMyGroups,
  reorderRotation,
  removeMember,
  respondToInvitation,
  respondToJoinRequest,
  updateGroup,
  updateAutoContribution,
  updateMemberRole,
} from "../controllers/groupController.js";
import {
  extendPayoutGrace,
  schedulePayout,
  updatePayout,
} from "../controllers/payoutController.js";
import {
  createResolution,
  voteOnResolution,
} from "../controllers/resolutionController.js";
import {
  startContribution,
  verifyContribution,
} from "../controllers/paymentController.js";
import {
  kycAction,
  requireAuth,
  requireGoodStanding,
  requireKyc,
  requireKycWhen,
} from "../middleware/auth.js";
import chatRoutes from "./chat.js";
import { getGroupLedger } from "../controllers/ledgerController.js";
import {
  createCollectivePayoutProposal,
  voteOnCollectivePayout,
} from "../controllers/collectivePayoutController.js";

const router = Router();
router.use(requireAuth);

router.get("/", listMyGroups);
router.get("/discover", discoverGroups);
router.get("/invitations", listInvitations);
router.get("/join-preview", getJoinPreview);
router.post("/", kycAction("create a savings group"), requireKyc, requireGoodStanding, createGroup);
router.post("/:id/activate", kycAction("activate a savings group"), requireKyc, requireGoodStanding, activateGroup);
router.post("/join", kycAction("join a savings group"), requireKyc, requireGoodStanding, joinGroup);
router.post(
  "/invitations/:invitationId/respond",
  requireKycWhen((req) => req.body.accept === true, "accept a group invitation"),
  (req, res, next) => req.body.accept === true ? requireGoodStanding(req, res, next) : next(),
  respondToInvitation
);
router.post("/:id/resolutions", kycAction("propose a group resolution"), requireKyc, createResolution);
router.post(
  "/:id/collective-payouts",
  kycAction("propose a shared-goal payout"),
  requireKyc,
  createCollectivePayoutProposal
);
router.post(
  "/:id/collective-payouts/:proposalId/vote",
  kycAction("vote on a shared-goal payout"),
  requireKyc,
  voteOnCollectivePayout
);
router.post(
  "/:id/resolutions/:resolutionId/vote",
  kycAction("vote on a group resolution"),
  requireKyc,
  voteOnResolution
);
router.post("/:id/join", kycAction("join a savings group"), requireKyc, requireGoodStanding, joinPublicGroup);
router.get("/:id/join-requests/:userId", getJoinRequest);
router.post("/:id/join-requests/:userId/respond", respondToJoinRequest);
router.get("/:id/access", getGroupAccess);
router.get("/:id/ledger", getGroupLedger);
router.get("/:id", getGroup);
router.use("/:id/messages", chatRoutes);
router.patch("/:id", updateGroup);
router.patch(
  "/:id/auto-contribution",
  requireKycWhen((req) => req.body.enabled === true, "enable automatic contributions"),
  updateAutoContribution
);
router.delete("/:id/members/me", leaveGroup);
router.delete("/:id/members/:userId", removeMember);
router.patch("/:id/members/:userId/role", updateMemberRole);
router.put("/:id/rotation", reorderRotation);
router.post("/:id/invitations", inviteMember);
router.post("/:groupId/contributions", kycAction("make a contribution"), requireKyc, startContribution);
router.post(
  "/:groupId/contributions/:reference/verify",
  verifyContribution
);
router.post("/:groupId/payouts", kycAction("schedule a group payout"), requireKyc, schedulePayout);
router.patch("/:groupId/payouts/:payoutId", kycAction("manage a group payout"), requireKyc, updatePayout);
router.post(
  "/:groupId/payouts/:payoutId/extend-grace",
  kycAction("extend a contribution deadline"),
  requireKyc,
  extendPayoutGrace
);

export default router;
