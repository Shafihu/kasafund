import crypto from "node:crypto";
import { env } from "../config/env.js";

const TWILIO_VERIFY_BASE_URL = "https://verify.twilio.com/v2";

export function normalizePhoneNumber(value, defaultCountryCode = "233") {
  const input = String(value || "").trim();
  if (!input) return null;

  const hasPlus = input.startsWith("+");
  const digits = input.replace(/\D/g, "");
  let normalized;

  if (hasPlus) normalized = `+${digits}`;
  else if (digits.startsWith(defaultCountryCode)) normalized = `+${digits}`;
  else if (digits.startsWith("0")) normalized = `+${defaultCountryCode}${digits.slice(1)}`;
  else if (digits.length === 9 && defaultCountryCode === "233") normalized = `+233${digits}`;
  else return null;

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export function maskPhoneNumber(phone) {
  const value = String(phone || "");
  return value.length >= 4 ? `•••• ${value.slice(-4)}` : "your phone";
}

export function twilioVerifyConfigured() {
  return Boolean(env.twilioAccountSid && env.twilioAuthToken && env.twilioVerifyServiceSid);
}

function developmentCodeHash(phone, code) {
  return crypto
    .createHmac("sha256", env.jwtSecret || "kasafund-development-only")
    .update(`phone:${phone}:${code}`)
    .digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "hex");
  const rightBuffer = Buffer.from(String(right || ""), "hex");
  return leftBuffer.length > 0 && leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function twilioRequest(path, body) {
  const response = await fetch(`${TWILIO_VERIFY_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error("Phone verification provider rejected the request");
    error.status = response.status;
    error.providerCode = payload.code;
    throw error;
  }
  return payload;
}

export async function startPhoneVerification(phone) {
  if (twilioVerifyConfigured()) {
    const verification = await twilioRequest(
      `/Services/${encodeURIComponent(env.twilioVerifyServiceSid)}/Verifications`,
      { To: phone, Channel: "sms" }
    );
    return { delivery: "sms", status: verification.status || "pending" };
  }

  if (env.nodeEnv === "production") {
    const error = new Error("Phone verification is not configured");
    error.code = "PHONE_VERIFICATION_UNAVAILABLE";
    throw error;
  }

  const devCode = crypto.randomInt(100000, 1000000).toString();
  console.log(`[phone verification] ${phone}: ${devCode}`);
  return {
    delivery: "development",
    devCode,
    developmentCodeHash: developmentCodeHash(phone, devCode),
    status: "pending",
  };
}

export async function checkPhoneVerification(phone, code, storedDevelopmentHash = "") {
  if (twilioVerifyConfigured()) {
    const check = await twilioRequest(
      `/Services/${encodeURIComponent(env.twilioVerifyServiceSid)}/VerificationCheck`,
      { To: phone, Code: code }
    );
    return { approved: check.status === "approved", status: check.status };
  }

  if (env.nodeEnv === "production") {
    const error = new Error("Phone verification is not configured");
    error.code = "PHONE_VERIFICATION_UNAVAILABLE";
    throw error;
  }

  return {
    approved: safeEqual(storedDevelopmentHash, developmentCodeHash(phone, code)),
    status: "pending",
  };
}
