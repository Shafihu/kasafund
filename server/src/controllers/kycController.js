import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import {
  createVerificationSession,
  retrieveVerificationDecision,
  verifyDiditWebhook,
} from "../services/diditService.js";
import { audit } from "../utils/api.js";
import { syncUserAchievements } from "../services/trustMetricsService.js";

const ACTIVE_STATUSES = new Set(["in_progress", "in_review", "resubmission_required"]);

function mapProviderStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["not started"].includes(normalized)) return "in_progress";
  if (["in progress", "awaiting user"].includes(normalized)) return "in_progress";
  if (["in review"].includes(normalized)) return "in_review";
  if (["approved"].includes(normalized)) return "verified";
  if (["declined", "abandoned"].includes(normalized)) return "declined";
  if (["resubmitted"].includes(normalized)) return "resubmission_required";
  if (["expired", "kyc expired"].includes(normalized)) return "expired";
  return "in_review";
}

function firstFeature(decision, key) {
  const list = decision?.[key];
  return Array.isArray(list) ? list[0] : null;
}

function failureReason(decision) {
  const featureGroups = [
    decision?.id_verifications,
    decision?.liveness_checks,
    decision?.face_matches,
  ];
  for (const group of featureGroups) {
    for (const feature of Array.isArray(group) ? group : []) {
      const warning = feature?.warnings?.[0];
      if (warning?.short_description) return String(warning.short_description).slice(0, 300);
    }
  }
  return "The verification could not be approved. Please review your document and try again.";
}

function requiredChecksPassed(decision) {
  return ["id_verifications", "liveness_checks", "face_matches"].every((key) => {
    const checks = decision?.[key];
    return Array.isArray(checks) && checks.some(
      (check) => String(check?.status).toLowerCase() === "approved"
    );
  });
}

export async function applyVerificationDecision(user, payload, { webhookEventId = "" } = {}) {
  const previousStatus = user.identityVerification?.status || "not_started";
  let status = mapProviderStatus(payload.status);
  const decision = payload.decision || payload;

  // KasaFund requires all three checks even if a provider workflow is misconfigured.
  if (status === "verified" && !requiredChecksPassed(decision)) status = "in_review";

  const idCheck = firstFeature(decision, "id_verifications");
  user.set("identityVerification.status", status);
  user.set("identityVerification.lastCheckedAt", new Date());
  if (payload.session_id) user.set("identityVerification.sessionId", payload.session_id);
  if (idCheck?.document_type) {
    user.set("identityVerification.documentType", String(idCheck.document_type).slice(0, 80));
  }
  if (idCheck?.issuing_state) {
    user.set("identityVerification.issuingCountry", String(idCheck.issuing_state).slice(0, 3));
  }
  user.set("identityVerification.failureReason", status === "declined" ? failureReason(decision) : "");
  user.set("identityVerification.verifiedAt", status === "verified" ? new Date() : null);
  if (webhookEventId) {
    user.set("identityVerification.lastWebhookEventId", webhookEventId);
  }
  await user.save();

  if (status !== previousStatus && ["verified", "declined", "in_review"].includes(status)) {
    const messages = {
      verified: {
        title: "Identity verified",
        body: "Your ID, liveness check, and facial match have been approved.",
      },
      declined: {
        title: "Identity verification needs attention",
        body: "We could not approve your verification. Open Account settings to review and retry.",
      },
      in_review: {
        title: "Identity verification in review",
        body: "Your verification was submitted and is being reviewed.",
      },
    };
    await Notification.create({
      userId: user._id,
      type: "identity_verification",
      ...messages[status],
    });
  }

  if (status === "verified" && status !== previousStatus) {
    try {
      await syncUserAchievements(user);
    } catch (error) {
      console.error("Verification achievement sync failed:", error.message);
    }
  }

  return status;
}

function publicStatus(user) {
  const verification = user.identityVerification || {};
  return {
    provider: verification.provider || "didit",
    status: verification.status || "not_started",
    documentType: verification.documentType || "",
    issuingCountry: verification.issuingCountry || "",
    failureReason: verification.failureReason || "",
    submittedAt: verification.submittedAt || null,
    verifiedAt: verification.verifiedAt || null,
    lastCheckedAt: verification.lastCheckedAt || null,
  };
}

export async function startVerification(req, res) {
  try {
    if (req.user.identityVerification?.status === "verified") {
      return res.json({ success: true, data: { ...publicStatus(req.user), alreadyVerified: true } });
    }

    const session = await createVerificationSession(req.user);
    req.user.set("identityVerification.provider", "didit");
    req.user.set("identityVerification.status", "in_progress");
    req.user.set("identityVerification.sessionId", session.session_id);
    req.user.set("identityVerification.submittedAt", new Date());
    req.user.set("identityVerification.lastCheckedAt", new Date());
    req.user.set("identityVerification.failureReason", "");
    await req.user.save();
    await audit({
      actorId: req.user._id,
      action: "identity_verification_started",
      targetType: "user",
      targetId: req.user._id,
      metadata: { provider: "didit", sessionId: session.session_id },
    });

    return res.status(201).json({
      success: true,
      data: {
        ...publicStatus(req.user),
        sessionUrl: session.url,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Could not start identity verification",
    });
  }
}

export async function getVerificationStatus(req, res) {
  const sessionId = req.user.identityVerification?.sessionId;
  if (sessionId && ACTIVE_STATUSES.has(req.user.identityVerification.status)) {
    try {
      const decision = await retrieveVerificationDecision(sessionId);
      await applyVerificationDecision(req.user, decision);
    } catch (error) {
      // A webhook remains the source of truth; return the stored status if reconciliation is unavailable.
      if (error.statusCode !== 400) console.error("KYC reconciliation failed:", error.message);
    }
  }
  return res.json({ success: true, data: publicStatus(req.user) });
}

export async function handleDiditWebhook(req, res) {
  const signatureMode = verifyDiditWebhook(req.body, req.headers);
  if (!signatureMode) {
    return res.status(401).json({ success: false, message: "Invalid webhook signature" });
  }
  if (!["status.updated", "data.updated"].includes(req.body.webhook_type)) {
    return res.json({ success: true });
  }
  if (!req.body.session_id || (req.body.workflow_id && req.body.workflow_id !== env.diditWorkflowId)) {
    return res.json({ success: true });
  }

  const identityFilters = [{ "identityVerification.sessionId": req.body.session_id }];
  if (mongoose.isValidObjectId(req.body.vendor_data)) {
    identityFilters.push({ _id: req.body.vendor_data });
  }
  const user = await User.findOne({ $or: identityFilters }).select(
    "+identityVerification.lastWebhookEventId"
  );
  if (!user) return res.json({ success: true });
  if (user.identityVerification?.lastWebhookEventId === req.body.event_id) {
    return res.json({ success: true });
  }

  // The Simple signature authenticates only the envelope, never trust its decision details.
  const trustedPayload = signatureMode === "v2" ? req.body : { ...req.body, decision: undefined };
  await applyVerificationDecision(user, trustedPayload, { webhookEventId: req.body.event_id });
  await audit({
    actorId: user._id,
    action: "identity_verification_status_updated",
    targetType: "user",
    targetId: user._id,
    metadata: { status: user.identityVerification.status, eventId: req.body.event_id },
  });
  return res.json({ success: true });
}
