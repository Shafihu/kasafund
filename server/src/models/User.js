import mongoose from "mongoose";

const userPreferencesSchema = new mongoose.Schema(
  {
    notifications: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: false },
    biometricLogin: { type: Boolean, default: false },
    analytics: { type: Boolean, default: true },
    autoBackup: { type: Boolean, default: true },
    locationServices: { type: Boolean, default: false },
    language: { type: String, default: "en", trim: true, maxlength: 10 },
    country: { type: String, default: "GH", uppercase: true, maxlength: 2 },
    currency: { type: String, default: "GHS", uppercase: true, maxlength: 3 },
    hideWalletBalance: { type: Boolean, default: false },
    gamifiedSavings: { type: Boolean, default: false },
    contributionReminders: { type: Boolean, default: true },
    payoutNotifications: { type: Boolean, default: true },
    groupInviteNotifications: { type: Boolean, default: true },
    campaignNotifications: { type: Boolean, default: true },
    donationNotifications: { type: Boolean, default: true },
    anonymousDonationsByDefault: { type: Boolean, default: false },
    allowGroupInvites: { type: Boolean, default: true },
    publicProfile: { type: Boolean, default: true },
    showProfileBio: { type: Boolean, default: true },
    showSharedGroups: { type: Boolean, default: true },
    showOnLeaderboard: { type: Boolean, default: true },
    onboardingCompleted: { type: Boolean, default: true },
  },
  { _id: false }
);

const notificationPreferencesSchema = new mongoose.Schema(
  {
    push: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
  },
  { _id: false }
);

const identityVerificationSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["didit"], default: "didit" },
    status: {
      type: String,
      enum: [
        "not_started",
        "in_progress",
        "in_review",
        "verified",
        "declined",
        "expired",
        "resubmission_required",
      ],
      default: "not_started",
    },
    sessionId: { type: String, default: "", trim: true },
    documentType: { type: String, default: "", trim: true, maxlength: 80 },
    issuingCountry: { type: String, default: "", trim: true, maxlength: 3 },
    failureReason: { type: String, default: "", trim: true, maxlength: 300 },
    verifiedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    lastCheckedAt: { type: Date, default: null },
    lastWebhookEventId: { type: String, default: "", select: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      unique: true,
      sparse: true,
    },
    passwordHash: {
      type: String,
      select: false,
      required() {
        return this.isNew && !this.googleId;
      },
    },
    password: { type: String, select: false },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      select: false,
    },
    avatarUrl: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 300 },
    role: {
      type: String,
      enum: ["user", "super_admin", "admin"],
      default: "user",
      immutable: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationCodeHash: { type: String, default: "", select: false },
    emailVerificationExpiresAt: { type: Date, default: null, select: false },
    emailVerificationSentAt: { type: Date, default: null, select: false },
    emailVerificationAttempts: { type: Number, default: 0, select: false },
    paystackCustomerCode: { type: String, default: "", trim: true },
    walletBalance: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    notificationPrefs: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },
    preferences: { type: userPreferencesSchema, default: () => ({}) },
    identityVerification: {
      type: identityVerificationSchema,
      default: () => ({}),
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ "identityVerification.sessionId": 1 });
userSchema.index({ "identityVerification.status": 1 });

userSchema.set("toJSON", {
  transform: (_document, result) => {
    delete result.passwordHash;
    delete result.password;
    delete result.googleId;
    delete result.emailVerified;
    delete result.emailVerificationCodeHash;
    delete result.emailVerificationExpiresAt;
    delete result.emailVerificationSentAt;
    delete result.emailVerificationAttempts;
    delete result.profileImage;
    if (result.identityVerification) {
      delete result.identityVerification.sessionId;
      delete result.identityVerification.lastWebhookEventId;
    }
    result.phoneNumber = result.phone || "";
    result.profileImage = result.avatarUrl || _document.profileImage || "";
    result.emailVerified = result.isEmailVerified || _document.emailVerified || false;
    if (result.role === "admin") result.role = "super_admin";
    return result;
  },
});

export const User = mongoose.model("User", userSchema);
