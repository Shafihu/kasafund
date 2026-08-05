import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { sendVerificationEmail } from "../services/emailService.js";
import { verifyGoogleIdToken } from "../services/googleAuthService.js";
import {
  checkPhoneVerification,
  maskPhoneNumber,
  normalizePhoneNumber,
  startPhoneVerification,
} from "../services/phoneVerificationService.js";
import { isHostedImageUrl } from "../utils/api.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const editablePreferenceKeys = [
  "notifications",
  "darkMode",
  "biometricLogin",
  "analytics",
  "autoBackup",
  "locationServices",
  "language",
  "country",
  "currency",
  "hideWalletBalance",
  "gamifiedSavings",
  "contributionReminders",
  "payoutNotifications",
  "groupInviteNotifications",
  "campaignNotifications",
  "donationNotifications",
  "anonymousDonationsByDefault",
  "allowGroupInvites",
  "publicProfile",
  "showProfileBio",
  "showSharedGroups",
  "showOnLeaderboard",
  "onboardingCompleted",
];

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

const verificationCodeLifetimeMs = 30 * 60 * 1000;
const verificationResendDelayMs = 60 * 1000;
const phoneVerificationLifetimeMs = 10 * 60 * 1000;
const phoneVerificationResendDelayMs = 60 * 1000;
const phoneVerificationMaxAttempts = 5;

function hashVerificationCode(code) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(String(code))
    .digest("hex");
}

async function issueVerificationCode(user) {
  const code = crypto.randomInt(100000, 1000000).toString();
  const now = new Date();

  user.emailVerificationCodeHash = hashVerificationCode(code);
  user.emailVerificationExpiresAt = new Date(now.getTime() + verificationCodeLifetimeMs);
  user.emailVerificationSentAt = now;
  user.emailVerificationAttempts = 0;
  await user.save();

  try {
    return await sendVerificationEmail({
      email: user.email,
      fullName: user.fullName,
      code,
    });
  } catch (error) {
    user.emailVerificationSentAt = null;
    await user.save();
    throw error;
  }
}

export async function register(req, res) {
  const fullName = req.body.fullName?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const submittedPhone = req.body.phone?.trim();
  const phone = submittedPhone ? normalizePhoneNumber(submittedPhone) : null;
  const password = req.body.password;

  if (!fullName || !emailPattern.test(email || "") || password?.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Full name, a valid email, and an 8-character password are required",
    });
  }
  if (submittedPhone && !phone) {
    return res.status(400).json({ success: false, message: "Enter a valid phone number" });
  }

  if (await User.exists({ email })) {
    return res.status(409).json({
      success: false,
      message: "Email is already registered",
    });
  }
  if (phone && (await User.exists({ phone }))) {
    return res.status(409).json({ success: false, message: "Phone number is already registered" });
  }

  const user = await User.create({
    fullName,
    email,
    phone: phone || undefined,
    passwordHash: await bcrypt.hash(password, 12),
    preferences: { onboardingCompleted: false },
  });

  let emailVerification;
  try {
    emailVerification = await issueVerificationCode(user);
  } catch (error) {
    console.error("Initial verification email failed:", error.message);
    emailVerification = { delivery: "unavailable" };
  }

  return res.status(201).json({
    success: true,
    message: "Account created. Verify your email to continue.",
    data: { user, token: createToken(user.id), emailVerification },
  });
}

export async function login(req, res) {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;
  const user = await User.findOne({ email }).select(
    "+passwordHash +password +emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationSentAt +emailVerificationAttempts"
  );
  const storedPasswordHash = user?.passwordHash || user?.password;

  if (
    !user ||
    !user.isActive ||
    !storedPasswordHash ||
    !(await bcrypt.compare(password || "", storedPasswordHash))
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  if (!user.passwordHash) user.passwordHash = storedPasswordHash;
  if (!user.avatarUrl && user.profileImage) user.avatarUrl = user.profileImage;
  user.lastLoginAt = new Date();
  await user.save();

  let emailVerification;
  const needsFreshVerificationCode =
    !user.isEmailVerified &&
    !user.emailVerified &&
    (!user.emailVerificationCodeHash ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() <= Date.now());
  if (needsFreshVerificationCode) {
    try {
      emailVerification = await issueVerificationCode(user);
    } catch (error) {
      console.error("Login verification email failed:", error.message);
      emailVerification = { delivery: "unavailable" };
    }
  }

  return res.json({
    success: true,
    message: "Login successful",
    data: { user, token: createToken(user.id), emailVerification },
  });
}

export async function googleLogin(req, res) {
  const idToken = String(req.body.idToken || "").trim();
  if (!idToken) {
    return res.status(400).json({
      success: false,
      message: "A Google ID token is required",
    });
  }

  let googleAccount;
  try {
    googleAccount = await verifyGoogleIdToken(idToken);
  } catch (error) {
    if (error.code === "GOOGLE_AUTH_NOT_CONFIGURED") {
      return res.status(503).json({ success: false, message: error.message });
    }
    return res.status(401).json({
      success: false,
      message: "Google sign-in could not be verified. Please try again.",
    });
  }

  let user = await User.findOne({ googleId: googleAccount.googleId }).select(
    "+googleId"
  );
  let isNewUser = false;

  if (!user) {
    user = await User.findOne({ email: googleAccount.email }).select("+googleId");
  }

  if (user && !user.isActive) {
    return res.status(403).json({
      success: false,
      message: "This account is not active",
    });
  }

  if (user?.googleId && user.googleId !== googleAccount.googleId) {
    return res.status(409).json({
      success: false,
      message: "This email is already linked to another Google account",
    });
  }

  if (!user) {
    isNewUser = true;
    user = new User({
      fullName: googleAccount.fullName,
      email: googleAccount.email,
      googleId: googleAccount.googleId,
      avatarUrl: googleAccount.profileImage,
      isEmailVerified: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      preferences: { onboardingCompleted: false },
    });
  } else {
    user.googleId = googleAccount.googleId;
    user.isEmailVerified = true;
    user.emailVerified = true;
    user.emailVerifiedAt ||= new Date();
    if (!user.avatarUrl && googleAccount.profileImage) {
      user.avatarUrl = googleAccount.profileImage;
    }
  }

  user.lastLoginAt = new Date();
  await user.save();

  return res.status(isNewUser ? 201 : 200).json({
    success: true,
    message: isNewUser
      ? "KasaFund account created with Google"
      : "Google sign-in successful",
    data: {
      user,
      token: createToken(user.id),
      isNewUser,
    },
  });
}

export async function resendEmailVerification(req, res) {
  if (req.user.isEmailVerified || req.user.emailVerified) {
    return res.json({ success: true, message: "Your email is already verified" });
  }

  const user = await User.findById(req.user._id).select(
    "+emailVerificationSentAt +emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts"
  );
  const lastSentAt = user.emailVerificationSentAt?.getTime() || 0;
  const retryAfterSeconds = Math.ceil(
    (lastSentAt + verificationResendDelayMs - Date.now()) / 1000
  );

  if (retryAfterSeconds > 0) {
    return res.status(429).json({
      success: false,
      message: `Please wait ${retryAfterSeconds} seconds before requesting another code`,
      retryAfterSeconds,
    });
  }

  try {
    const emailVerification = await issueVerificationCode(user);
    return res.json({
      success: true,
      message: "A new verification code has been sent",
      data: { emailVerification },
    });
  } catch {
    return res.status(503).json({
      success: false,
      message: "We could not send a verification email. Please try again shortly.",
    });
  }
}

export async function verifyEmail(req, res) {
  const code = String(req.body.code || "").trim();
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: "Enter the 6-digit code" });
  }

  const user = await User.findById(req.user._id).select(
    "+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts"
  );

  if (user.isEmailVerified || user.emailVerified) {
    return res.json({ success: true, message: "Email verified", data: { user } });
  }
  if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
    return res.status(400).json({ success: false, message: "Request a new verification code" });
  }
  if (user.emailVerificationExpiresAt.getTime() <= Date.now()) {
    return res.status(400).json({ success: false, message: "This code has expired. Request a new one." });
  }
  if ((user.emailVerificationAttempts || 0) >= 5) {
    return res.status(429).json({ success: false, message: "Too many attempts. Request a new code." });
  }

  const expected = Buffer.from(user.emailVerificationCodeHash, "hex");
  const received = Buffer.from(hashVerificationCode(code), "hex");
  const matches = expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!matches) {
    user.emailVerificationAttempts = (user.emailVerificationAttempts || 0) + 1;
    await user.save();
    return res.status(400).json({ success: false, message: "That verification code is incorrect" });
  }

  user.isEmailVerified = true;
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationCodeHash = "";
  user.emailVerificationExpiresAt = null;
  user.emailVerificationSentAt = null;
  user.emailVerificationAttempts = 0;
  await user.save();

  return res.json({ success: true, message: "Email verified successfully", data: { user } });
}

function clearPendingPhoneVerification(user) {
  user.pendingPhone = "";
  user.phoneVerificationCodeHash = "";
  user.phoneVerificationExpiresAt = null;
  user.phoneVerificationSentAt = null;
  user.phoneVerificationAttempts = 0;
}

function phoneProviderErrorResponse(error, res) {
  if ([60203, 60245].includes(Number(error.providerCode)) || error.status === 429) {
    return res.status(429).json({
      success: false,
      message: "Too many verification messages were requested. Please wait and try again.",
    });
  }
  if (Number(error.providerCode) === 60202) {
    return res.status(429).json({
      success: false,
      message: "Too many incorrect attempts. Request a new code.",
    });
  }
  if (error.code === "PHONE_VERIFICATION_UNAVAILABLE") {
    return res.status(503).json({ success: false, message: error.message });
  }
  return res.status(503).json({
    success: false,
    message: "We could not send or check the SMS code. Please try again shortly.",
  });
}

async function issuePhoneVerification(user, phone) {
  const now = new Date();
  const delivery = await startPhoneVerification(phone);

  user.pendingPhone = phone;
  user.phoneVerificationCodeHash = delivery.developmentCodeHash || "";
  user.phoneVerificationExpiresAt = new Date(now.getTime() + phoneVerificationLifetimeMs);
  user.phoneVerificationSentAt = now;
  user.phoneVerificationAttempts = 0;
  await user.save();

  return {
    delivery: delivery.delivery,
    phoneLast4: phone.slice(-4),
    maskedPhone: maskPhoneNumber(phone),
    expiresInSeconds: Math.floor(phoneVerificationLifetimeMs / 1000),
    resendAfterSeconds: Math.floor(phoneVerificationResendDelayMs / 1000),
    ...(delivery.devCode ? { devCode: delivery.devCode } : {}),
  };
}

export async function startPhoneNumberVerification(req, res) {
  const phone = normalizePhoneNumber(req.body.phoneNumber);
  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid phone number, including the country code when outside Ghana",
    });
  }
  if (phone === req.user.phone && req.user.isPhoneVerified) {
    return res.status(409).json({ success: false, message: "This phone number is already verified" });
  }
  if (await User.exists({ phone, _id: { $ne: req.user._id } })) {
    return res.status(409).json({ success: false, message: "This phone number is already in use" });
  }

  const user = await User.findById(req.user._id).select(
    "+pendingPhone +phoneVerificationCodeHash +phoneVerificationExpiresAt +phoneVerificationSentAt +phoneVerificationAttempts"
  );
  const lastSentAt = user.phoneVerificationSentAt?.getTime() || 0;
  const retryAfterSeconds = Math.ceil(
    (lastSentAt + phoneVerificationResendDelayMs - Date.now()) / 1000
  );
  if (retryAfterSeconds > 0) {
    return res.status(429).json({
      success: false,
      message: `Please wait ${retryAfterSeconds} seconds before requesting another code`,
      retryAfterSeconds,
    });
  }

  try {
    const phoneVerification = await issuePhoneVerification(user, phone);
    return res.json({
      success: true,
      message: `A verification code was sent to ${phoneVerification.maskedPhone}`,
      data: { phoneVerification },
    });
  } catch (error) {
    return phoneProviderErrorResponse(error, res);
  }
}

export async function resendPhoneNumberVerification(req, res) {
  const user = await User.findById(req.user._id).select(
    "+pendingPhone +phoneVerificationCodeHash +phoneVerificationExpiresAt +phoneVerificationSentAt +phoneVerificationAttempts"
  );
  if (!user.pendingPhone) {
    return res.status(400).json({ success: false, message: "Enter a phone number first" });
  }

  const lastSentAt = user.phoneVerificationSentAt?.getTime() || 0;
  const retryAfterSeconds = Math.ceil(
    (lastSentAt + phoneVerificationResendDelayMs - Date.now()) / 1000
  );
  if (retryAfterSeconds > 0) {
    return res.status(429).json({
      success: false,
      message: `Please wait ${retryAfterSeconds} seconds before requesting another code`,
      retryAfterSeconds,
    });
  }

  if (await User.exists({ phone: user.pendingPhone, _id: { $ne: user._id } })) {
    clearPendingPhoneVerification(user);
    await user.save();
    return res.status(409).json({ success: false, message: "This phone number is now in use" });
  }

  try {
    const phoneVerification = await issuePhoneVerification(user, user.pendingPhone);
    return res.json({
      success: true,
      message: `A new code was sent to ${phoneVerification.maskedPhone}`,
      data: { phoneVerification },
    });
  } catch (error) {
    return phoneProviderErrorResponse(error, res);
  }
}

export async function verifyPhoneNumber(req, res) {
  const code = String(req.body.code || "").trim();
  if (!/^\d{4,10}$/.test(code)) {
    return res.status(400).json({ success: false, message: "Enter the verification code from the SMS" });
  }

  const user = await User.findById(req.user._id).select(
    "+pendingPhone +phoneVerificationCodeHash +phoneVerificationExpiresAt +phoneVerificationSentAt +phoneVerificationAttempts"
  );
  if (!user.pendingPhone || !user.phoneVerificationExpiresAt) {
    return res.status(400).json({ success: false, message: "Request a new verification code" });
  }
  if (user.phoneVerificationExpiresAt.getTime() <= Date.now()) {
    clearPendingPhoneVerification(user);
    await user.save();
    return res.status(400).json({ success: false, message: "This code has expired. Request a new one." });
  }
  if ((user.phoneVerificationAttempts || 0) >= phoneVerificationMaxAttempts) {
    return res.status(429).json({ success: false, message: "Too many attempts. Request a new code." });
  }
  if (await User.exists({ phone: user.pendingPhone, _id: { $ne: user._id } })) {
    clearPendingPhoneVerification(user);
    await user.save();
    return res.status(409).json({ success: false, message: "This phone number is now in use" });
  }

  let check;
  try {
    check = await checkPhoneVerification(
      user.pendingPhone,
      code,
      user.phoneVerificationCodeHash
    );
  } catch (error) {
    if (error.status === 404) {
      clearPendingPhoneVerification(user);
      await user.save();
      return res.status(400).json({ success: false, message: "This code expired or reached its attempt limit. Request a new one." });
    }
    return phoneProviderErrorResponse(error, res);
  }

  if (!check.approved) {
    user.phoneVerificationAttempts = (user.phoneVerificationAttempts || 0) + 1;
    await user.save();
    return res.status(400).json({ success: false, message: "That verification code is incorrect" });
  }

  user.phone = user.pendingPhone;
  user.isPhoneVerified = true;
  user.phoneVerifiedAt = new Date();
  clearPendingPhoneVerification(user);
  try {
    await user.save();
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "This phone number is already in use" });
    }
    throw error;
  }

  return res.json({
    success: true,
    message: "Phone number verified successfully",
    data: { user },
  });
}

export function getProfile(req, res) {
  return res.json(req.user);
}

export async function updateProfile(req, res) {
  const { fullName, bio, profileImage, phoneNumber, preferences, notificationPrefs } = req.body;

  if (typeof fullName === "string" && fullName.trim()) {
    req.user.fullName = fullName.trim();
  }
  if (typeof bio === "string") req.user.bio = bio.trim();
  if (typeof profileImage === "string") {
    if (!isHostedImageUrl(profileImage.trim())) {
      return res.status(400).json({ success: false, message: "Profile image must be uploaded first" });
    }
    req.user.avatarUrl = profileImage.trim();
  }
  if (typeof phoneNumber === "string") {
    const requestedPhone = normalizePhoneNumber(phoneNumber);
    if (requestedPhone !== (req.user.phone || null)) {
      return res.status(409).json({
        success: false,
        code: "PHONE_VERIFICATION_REQUIRED",
        message: "Verify a new phone number before changing it",
      });
    }
  }

  if (preferences && typeof preferences === "object") {
    for (const key of editablePreferenceKeys) {
      if (preferences[key] !== undefined) {
        req.user.set(`preferences.${key}`, preferences[key]);
      }
    }
  }
  if (notificationPrefs && typeof notificationPrefs === "object") {
    for (const key of ["push", "email", "sms"]) {
      if (typeof notificationPrefs[key] === "boolean") {
        req.user.set(`notificationPrefs.${key}`, notificationPrefs[key]);
      }
    }
  }
  if (typeof preferences?.notifications === "boolean") {
    req.user.set("notificationPrefs.push", preferences.notifications);
  }

  await req.user.save();
  return res.json(req.user);
}

export async function changePassword(req, res) {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");

  if (!currentPassword || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Your current password and a new password of at least 8 characters are required",
    });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "Your new password must be different from your current password",
    });
  }

  const user = await User.findById(req.user._id).select("+passwordHash +password");
  const storedPasswordHash = user?.passwordHash || user?.password;
  if (!user || !storedPasswordHash || !(await bcrypt.compare(currentPassword, storedPasswordHash))) {
    return res.status(400).json({ success: false, message: "Current password is incorrect" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.password = undefined;
  await user.save();
  return res.json({ success: true, message: "Password changed successfully" });
}

export async function deleteProfileImage(req, res) {
  req.user.avatarUrl = "";
  await req.user.save();
  return res.status(204).send();
}

export function refreshToken(req, res) {
  return res.json({ token: createToken(req.user.id) });
}

export function logout(_req, res) {
  return res.json({ success: true, message: "Logged out" });
}
