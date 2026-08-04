import crypto from "crypto";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { WhatsAppInboundMessage } from "../models/WhatsAppInboundMessage.js";
import { WhatsAppLink } from "../models/WhatsAppLink.js";
import {
  answerAccountQuestion,
  answerKasaFundQuestion,
  assistantMenu,
  classifyAccountIntent,
} from "../services/kasaAssistantService.js";
import {
  extractWhatsAppMessages,
  sendWhatsAppText,
  verifyWhatsAppSignature,
  whatsappConfigured,
} from "../services/whatsappService.js";

const linkLifetimeMs = 10 * 60 * 1000;

function hashLinkCode(code) {
  return crypto
    .createHmac("sha256", env.jwtSecret)
    .update(String(code).trim().toUpperCase())
    .digest("hex");
}

function publicLinkStatus(link) {
  return {
    linked: Boolean(link?.linkedAt),
    phoneLast4: link?.phoneLast4 || "",
    linkedAt: link?.linkedAt || null,
    configured: whatsappConfigured(),
    businessPhone: env.whatsappBusinessPhone,
  };
}

export async function getWhatsAppLinkStatus(req, res) {
  const link = await WhatsAppLink.findOne({ userId: req.user._id });
  return res.json({ success: true, data: publicLinkStatus(link) });
}

export async function createWhatsAppLinkCode(req, res) {
  const existing = await WhatsAppLink.findOne({ userId: req.user._id });
  if (existing?.linkedAt) {
    return res.status(409).json({
      success: false,
      message: "Your WhatsApp account is already linked",
    });
  }

  const code = crypto.randomBytes(4).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + linkLifetimeMs);
  await WhatsAppLink.findOneAndUpdate(
    { userId: req.user._id },
    {
      $set: {
        linkCodeHash: hashLinkCode(code),
        linkCodeExpiresAt: expiresAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const linkMessage = `LINK ${code}`;
  const phone = env.whatsappBusinessPhone.replace(/\D/g, "");
  const deepLink = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(linkMessage)}`
    : "";

  return res.json({
    success: true,
    message: "WhatsApp link code created",
    data: {
      code,
      linkMessage,
      expiresAt,
      deepLink,
      ...publicLinkStatus(existing),
    },
  });
}

export async function unlinkWhatsApp(req, res) {
  await WhatsAppLink.deleteOne({ userId: req.user._id });
  return res.json({
    success: true,
    message: "WhatsApp disconnected from your KasaFund account",
  });
}

export function verifyWhatsAppWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const verifyToken = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && verifyToken === env.whatsappVerifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

export function receiveWhatsAppWebhook(req, res) {
  if (
    !verifyWhatsAppSignature(
      req.rawBody,
      req.headers["x-hub-signature-256"]
    )
  ) {
    return res.sendStatus(401);
  }

  res.sendStatus(200);
  void processWhatsAppPayload(req.body).catch((error) => {
    console.error("WhatsApp webhook processing failed:", error);
  });
}

async function recordInboundMessage(message) {
  try {
    await WhatsAppInboundMessage.create({
      messageId: message.id,
      waId: message.from,
      messageType: message.type || "unknown",
    });
    return true;
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

async function linkAccount(waId, text) {
  const code = text.replace(/^link\s+/i, "").trim().toUpperCase();
  if (!/^[A-F0-9]{8}$/.test(code)) return null;

  const link = await WhatsAppLink.findOne({
    linkCodeHash: hashLinkCode(code),
    linkCodeExpiresAt: { $gt: new Date() },
  }).select("+waId +linkCodeHash +linkCodeExpiresAt");

  if (!link) return null;

  const otherLink = await WhatsAppLink.exists({
    waId,
    userId: { $ne: link.userId },
  });
  if (otherLink) {
    return "This WhatsApp number is already connected to another KasaFund account. Disconnect it there before trying again.";
  }

  link.waId = waId;
  link.phoneLast4 = waId.slice(-4);
  link.linkedAt = new Date();
  link.lastInteractionAt = new Date();
  link.linkCodeHash = "";
  link.linkCodeExpiresAt = null;
  await link.save();

  const user = await User.findById(link.userId).select("fullName");
  const firstName = user?.fullName?.split(/\s+/)[0] || "there";
  return `Connected successfully, ${firstName} ✅\n\nYou can now ask about your wallet balance, KYC status, groups, or next contribution. I will never move money through WhatsApp.`;
}

async function handleInboundMessage(message) {
  if (message.type !== "text" || !message.text?.body) {
    await sendWhatsAppText(
      message.from,
      "For now, Kasa can respond to text messages only."
    );
    return;
  }

  const text = message.text.body.trim();
  if (/^link\s+/i.test(text)) {
    const response = await linkAccount(message.from, text);
    await sendWhatsAppText(
      message.from,
      response ||
        "That link code is invalid or expired. Generate a new one in KasaFund under Profile → WhatsApp assistant."
    );
    return;
  }

  if (/^(hi|hello|hey|help|menu|start)\b/i.test(text)) {
    await sendWhatsAppText(message.from, assistantMenu());
    return;
  }

  const intent = classifyAccountIntent(text);
  const link = await WhatsAppLink.findOne({ waId: message.from }).select(
    "+waId"
  );

  if (intent && !link?.linkedAt) {
    await sendWhatsAppText(
      message.from,
      "To access account information, securely link WhatsApp from KasaFund: Profile → WhatsApp assistant. General KasaFund questions still work without linking."
    );
    return;
  }

  if (intent) {
    const user = await User.findById(link.userId);
    if (!user?.isActive) {
      await sendWhatsAppText(
        message.from,
        "This KasaFund account is unavailable. Please sign in to the app for help."
      );
      return;
    }
    link.lastInteractionAt = new Date();
    await link.save();
    await sendWhatsAppText(
      message.from,
      await answerAccountQuestion(user, intent)
    );
    return;
  }

  await sendWhatsAppText(
    message.from,
    await answerKasaFundQuestion(text)
  );
}

export async function processWhatsAppPayload(payload) {
  for (const message of extractWhatsAppMessages(payload)) {
    if (!(await recordInboundMessage(message))) continue;

    try {
      await handleInboundMessage(message);
    } catch (error) {
      // Allow Meta's retry to be processed if delivery or database work failed.
      await WhatsAppInboundMessage.deleteOne({ messageId: message.id });
      console.error(`WhatsApp message ${message.id} failed:`, error.message);
    }
  }
}
