import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const serverDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

dotenv.config({ path: path.join(serverDirectory, ".env") });

function booleanValue(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  developmentToolsEnabled:
    (process.env.NODE_ENV || "development") !== "production" &&
    booleanValue(process.env.ENABLE_PAYOUT_TEST_TOOLS, false),
  port: Number(process.env.PORT) || 5050,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  appScheme: process.env.APP_SCHEME || "kasafund",
  paystackCallbackUrl: process.env.PAYSTACK_CALLBACK_URL || "",
  paystackLiveTransfers: booleanValue(process.env.PAYSTACK_LIVE_TRANSFERS, false),
  automaticPayoutsEnabled: booleanValue(process.env.AUTOMATIC_PAYOUTS_ENABLED, true),
  payoutProcessorIntervalMs: Math.max(
    Number(process.env.PAYOUT_PROCESSOR_INTERVAL_MS) || 900_000,
    10_000
  ),
  automaticContributionsEnabled: booleanValue(
    process.env.AUTOMATIC_CONTRIBUTIONS_ENABLED,
    true
  ),
  autoContributionProcessorIntervalMs: Math.max(
    Number(process.env.AUTO_CONTRIBUTION_PROCESSOR_INTERVAL_MS) || 900_000,
    10_000
  ),
  automaticSavingsEnabled: booleanValue(process.env.AUTOMATIC_SAVINGS_ENABLED, true),
  savingsProcessorIntervalMs: Math.max(
    Number(process.env.SAVINGS_PROCESSOR_INTERVAL_MS) || 900_000,
    10_000
  ),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  diditApiKey: process.env.DIDIT_API_KEY || "",
  diditWorkflowId: process.env.DIDIT_WORKFLOW_ID || "",
  diditWebhookSecret: process.env.DIDIT_WEBHOOK_SECRET || "",
  diditCallbackUrl:
    process.env.DIDIT_CALLBACK_URL || "kasafund://profile/identity-verification",
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioVerifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID || "",
  googleClientIds: (process.env.GOOGLE_CLIENT_IDS || "")
    .split(",")
    .map((clientId) => clientId.trim())
    .filter(Boolean),
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  whatsappBusinessPhone: process.env.WHATSAPP_BUSINESS_PHONE || "",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || "",
  whatsappGraphApiVersion:
    process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
});
