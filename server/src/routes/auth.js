import { Router } from "express";
import {
  changePassword,
  deleteProfileImage,
  getProfile,
  googleLogin,
  login,
  logout,
  refreshToken,
  register,
  resendEmailVerification,
  resendPhoneNumberVerification,
  startPhoneNumberVerification,
  updateProfile,
  verifyEmail,
  verifyPhoneNumber,
} from "../controllers/authController.js";
import { requireAuth, requireVerifiedEmail } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/email/resend", requireAuth, resendEmailVerification);
router.post("/email/verify", requireAuth, verifyEmail);
router.post("/phone/start", requireAuth, requireVerifiedEmail, startPhoneNumberVerification);
router.post("/phone/resend", requireAuth, requireVerifiedEmail, resendPhoneNumberVerification);
router.post("/phone/verify", requireAuth, requireVerifiedEmail, verifyPhoneNumber);
router.get("/profile", requireAuth, getProfile);
router.put("/profile", requireAuth, updateProfile);
router.patch("/password", requireAuth, changePassword);
router.delete("/profile/image", requireAuth, deleteProfileImage);
router.post("/refresh", requireAuth, refreshToken);
router.post("/logout", requireAuth, logout);

export default router;
