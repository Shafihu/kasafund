import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { Campaign } from "../src/models/Campaign.js";
import { Notification } from "../src/models/Notification.js";
import { User } from "../src/models/User.js";
import { UserReport } from "../src/models/UserReport.js";

const mongoUri = process.env.PRESENTATION_MONGODB_URI || env.mongoUri;
const namespace = "kasafund-presentation-v1";
const day = 86_400_000;
const days = (value) => new Date(Date.now() + value * day);
const id = (key) => new mongoose.Types.ObjectId(
  crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex").slice(0, 24)
);

function assertSafeDatabase() {
  if (!mongoUri) throw new Error("PRESENTATION_MONGODB_URI or MONGODB_URI must be set");
  if (env.nodeEnv === "production") throw new Error("Presentation seeding is disabled in production");
  const databaseName = mongoUri.split("?")[0].split("/").at(-1) || "";
  if (!/(presentation|demo)/i.test(databaseName) && process.env.ALLOW_PRESENTATION_SEED !== "true") {
    throw new Error(`Refusing to add presentation reports to \"${databaseName || "(unnamed)"}\"`);
  }
}

async function requiredUser(email) {
  const user = await User.findOne({ email }).select("_id").lean();
  if (!user) throw new Error(`Required presentation user ${email} was not found. Run the main presentation seed first.`);
  return user._id;
}

async function requiredCampaign(shareSlug) {
  const campaign = await Campaign.findOne({ shareSlug }).select("_id").lean();
  if (!campaign) throw new Error(`Required presentation campaign ${shareSlug} was not found. Run the main presentation seed first.`);
  return campaign._id;
}

async function seedReports() {
  assertSafeDatabase();
  await mongoose.connect(mongoUri);
  const [adminId, abenaId, nanaId, kojoId, yawId, efuaId, kofiId, mabelId, shopCampaignId] = await Promise.all([
    requiredUser("admin@demo.kasafund.app"),
    requiredUser("abena@demo.kasafund.app"),
    requiredUser("nana@demo.kasafund.app"),
    requiredUser("kojo@demo.kasafund.app"),
    requiredUser("yaw@demo.kasafund.app"),
    requiredUser("efua@demo.kasafund.app"),
    requiredUser("kofi@demo.kasafund.app"),
    requiredUser("mabel@demo.kasafund.app"),
    requiredCampaign("demo-shop"),
  ]);
  const reportIds = {
    pending: id("user-report:pending-scam"),
    reviewing: id("user-report:reviewing-harassment"),
    resolved: id("user-report:resolved-impersonation"),
    campaign: id("campaign-report:misleading-shop"),
  };
  const reports = [
    {
      _id: reportIds.campaign, reporterId: mabelId, targetType: "campaign", reportedCampaignId: shopCampaignId,
      reason: "misleading",
      details: "The campaign says all funds will replace shop equipment, but a recent shared message describes a different use. Please verify the stated budget with the organizer.",
      status: "pending", createdAt: days(-1), updatedAt: days(-1),
    },
    {
      _id: reportIds.pending, reporterId: abenaId, targetType: "member", reportedUserId: nanaId, reason: "scam",
      details: "The member sent me a private request to transfer money outside KasaFund and said it was required to keep my place in a savings group.",
      status: "pending", createdAt: days(-1), updatedAt: days(-1),
    },
    {
      _id: reportIds.reviewing, reporterId: kojoId, targetType: "member", reportedUserId: yawId, reason: "harassment",
      details: "I received repeated insulting messages after declining an invitation. I asked the member to stop, but another message arrived the next day.",
      status: "reviewing", assignedTo: adminId, reviewStartedAt: days(-2),
      internalNotes: [{ authorId: adminId, body: "Confirmed the reporter and reported member shared one group. Reviewing the relevant message timeline before deciding the outcome.", createdAt: days(-2) }],
      createdAt: days(-3), updatedAt: days(-2),
    },
    {
      _id: reportIds.resolved, reporterId: efuaId, targetType: "member", reportedUserId: kofiId, reason: "impersonation",
      details: "The profile used a business name and logo that looked like another local organisation.",
      status: "resolved", assignedTo: adminId, reviewStartedAt: days(-6),
      resolutionSummary: "We reviewed the profile concern and confirmed that the account information has been corrected. Thank you for helping keep KasaFund trustworthy.",
      resolvedAt: days(-4), resolvedBy: adminId,
      internalNotes: [{ authorId: adminId, body: "Compared the profile information with the organisation's public contact details and requested corrected account information.", createdAt: days(-5) }],
      decisions: [{ action: "resolved", summary: "We reviewed the profile concern and confirmed that the account information has been corrected. Thank you for helping keep KasaFund trustworthy.", authorId: adminId, createdAt: days(-4) }],
      createdAt: days(-7), updatedAt: days(-4),
    },
  ];

  const results = await Promise.all(reports.map((report) => UserReport.updateOne(
    { _id: report._id },
    { $setOnInsert: report },
    { upsert: true, setDefaultsOnInsert: true, timestamps: false }
  )));
  await Notification.updateOne(
    { _id: id("notification:report-resolved") },
    { $setOnInsert: { userId: efuaId, type: "report_update", title: "Your report has been reviewed", body: reports[3].resolutionSummary, relatedUserId: kofiId, isRead: true, createdAt: days(-4) } },
    { upsert: true, setDefaultsOnInsert: true, timestamps: false }
  );
  await Promise.all([
    AuditLog.updateOne(
      { _id: id("audit:report-review-started") },
      { $setOnInsert: { actorId: adminId, action: "admin.user_report_start_review", targetType: "user_report", targetId: reportIds.reviewing, metadata: { previousStatus: "pending", status: "reviewing", reportReason: "harassment" }, createdAt: days(-2) } },
      { upsert: true, setDefaultsOnInsert: true }
    ),
    AuditLog.updateOne(
      { _id: id("audit:report-resolved") },
      { $setOnInsert: { actorId: adminId, action: "admin.user_report_resolve", targetType: "user_report", targetId: reportIds.resolved, metadata: { previousStatus: "reviewing", status: "resolved", reportReason: "impersonation" }, createdAt: days(-4) } },
      { upsert: true, setDefaultsOnInsert: true }
    ),
  ]);
  console.log(`Presentation reports ready. Added ${results.filter((result) => result.upsertedCount).length}; preserved ${results.filter((result) => !result.upsertedCount).length}.`);
}

seedReports()
  .catch((error) => { console.error("Presentation report seed failed:", error.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
