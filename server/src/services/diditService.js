import crypto from "crypto";
import { env } from "../config/env.js";

const DIDIT_BASE_URL = "https://verification.didit.me/v3";

function ensureConfigured() {
  if (!env.diditApiKey || !env.diditWorkflowId) {
    const error = new Error("Identity verification is not configured");
    error.statusCode = 503;
    throw error;
  }
}

async function diditRequest(path, { method = "GET", body } = {}) {
  ensureConfigured();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${DIDIT_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.diditApiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        result.detail || result.message || "Identity provider request failed"
      );
      error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Identity provider did not respond in time");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createVerificationSession(user) {
  const configuredCountry = user.preferences?.country || "GH";
  return diditRequest("/session/", {
    method: "POST",
    body: {
      workflow_id: env.diditWorkflowId,
      vendor_data: user.id,
      callback: env.diditCallbackUrl,
      callback_method: "both",
      language: "en",
      metadata: { product: "kasafund", purpose: "financial_account_kyc" },
      contact_details: {
        email: user.email,
        phone: user.phone || undefined,
        send_notification_emails: false,
      },
      expected_details: { id_country: configuredCountry === "GH" ? "GHA" : configuredCountry },
    },
  });
}

export function retrieveVerificationDecision(sessionId) {
  return diditRequest(`/session/${encodeURIComponent(sessionId)}/decision/`);
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortKeys(value[key]);
        return result;
      }, {});
  }
  return value;
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyDiditWebhook(body, headers) {
  if (!env.diditWebhookSecret) return null;
  const timestamp = String(headers["x-timestamp"] || "");
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return null;

  const canonical = JSON.stringify(sortKeys(body));
  const expectedV2 = crypto
    .createHmac("sha256", env.diditWebhookSecret)
    .update(canonical, "utf8")
    .digest("hex");
  if (safeEqual(expectedV2, headers["x-signature-v2"])) return "v2";

  const simple = [
    body.timestamp ?? "",
    body.session_id ?? "",
    body.status ?? "",
    body.webhook_type ?? "",
  ].join(":");
  const expectedSimple = crypto
    .createHmac("sha256", env.diditWebhookSecret)
    .update(simple)
    .digest("hex");
  return safeEqual(expectedSimple, headers["x-signature-simple"]) ? "simple" : null;
}
