import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";

const googleClient = new OAuth2Client();

export function isGoogleAuthConfigured() {
  return env.googleClientIds.length > 0;
}

export async function verifyGoogleIdToken(idToken) {
  if (!isGoogleAuthConfigured()) {
    const error = new Error("Google sign-in is not configured");
    error.code = "GOOGLE_AUTH_NOT_CONFIGURED";
    throw error;
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.googleClientIds,
  });
  const payload = ticket.getPayload();

  if (
    !payload?.sub ||
    !payload.email ||
    payload.email_verified !== true
  ) {
    const error = new Error("Google could not verify this email address");
    error.code = "INVALID_GOOGLE_ACCOUNT";
    throw error;
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    fullName: payload.name?.trim() || payload.email.split("@")[0],
    profileImage: payload.picture || "",
  };
}
