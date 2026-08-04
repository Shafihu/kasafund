import { Router } from "express";
import { blockUser, getAccountStanding, getKasaPointsLeaderboard, getPendingAchievement, getPublicUserProfile, listUserDirectory, markAchievementPresented, reportUser, unblockUser } from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.get("/me/achievements/pending", requireAuth, getPendingAchievement);
router.get("/me/standing", requireAuth, getAccountStanding);
router.get("/leaderboard", requireAuth, getKasaPointsLeaderboard);
router.patch("/me/achievements/:achievementId/presented", requireAuth, markAchievementPresented);
router.get("/directory", requireAuth, listUserDirectory);
router.get("/:id", requireAuth, getPublicUserProfile);
router.post("/:id/report", requireAuth, reportUser);
router.post("/:id/block", requireAuth, blockUser);
router.delete("/:id/block", requireAuth, unblockUser);

export default router;
