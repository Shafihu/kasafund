import crypto from "crypto";
import { env } from "../config/env.js";

export function whatsappConfigured() {
  return Boolean(
    env.whatsappAccessToken &&
      env.whatsappPhoneNumberId &&
      env.whatsappVerifyToken &&
      env.whatsappAppSecret
  );
}

export function verifyWhatsAppSignature(rawBody, signature) {
  if (!env.whatsappAppSecret || !rawBody || !signature?.startsWith("sha256=")) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", env.whatsappAppSecret)
    .update(rawBody)
    .digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function extractWhatsAppMessages(payload) {
  const messages = [];

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      for (const message of change?.value?.messages || []) {
        if (message?.id && message?.from) messages.push(message);
      }
    }
  }

  return messages;
}

export async function sendWhatsAppText(to, body) {
  if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
    throw new Error("WhatsApp messaging is not configured");
  }

  const response = await fetch(
    `https://graph.facebook.com/${env.whatsappGraphApiVersion}/${env.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          body: String(body).slice(0, 4000),
          preview_url: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `WhatsApp send failed (${response.status}): ${errorBody.slice(0, 300)}`
    );
  }
}
