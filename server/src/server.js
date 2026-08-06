import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { Server as SocketServer } from "socket.io";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import campaignRoutes from "./routes/campaigns.js";
import dashboardRoutes from "./routes/dashboard.js";
import developmentRoutes from "./routes/development.js";
import groupRoutes from "./routes/groups.js";
import kycRoutes from "./routes/kyc.js";
import notificationRoutes from "./routes/notifications.js";
import paymentRoutes from "./routes/payments.js";
import userRoutes from "./routes/users.js";
import uploadRoutes from "./routes/uploads.js";
import savingsRoutes from "./routes/savings.js";
import whatsappRoutes from "./routes/whatsapp.js";
import { startPayoutProcessor } from "./services/payoutProcessorService.js";
import { startAutoContributionProcessor } from "./services/autoContributionService.js";
import { startSavingsProcessor } from "./services/savingsProcessorService.js";
import { configureChatSockets } from "./services/chatSocketService.js";
import { startCampaignLifecycleProcessor } from "./services/campaignLifecycleService.js";

const app = express();
const port = env.port;
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: env.corsOrigin, methods: ["GET", "POST"] },
});
app.set("io", io);
configureChatSockets(io);

app.use(cors({ origin: env.corsOrigin }));
app.use("/api/payments", paymentRoutes);
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      req.rawBody = buffer;
    },
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "KasaFund API is running" });
});
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/dashboard", dashboardRoutes);
if (env.developmentToolsEnabled) {
  app.use("/api/dev", developmentRoutes);
  console.warn("Development payout test tools are enabled");
}
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/savings", savingsRoutes);
app.use("/api/whatsapp", whatsappRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.code === 11000) {
    return res.status(409).json({ success: false, message: "A record with that unique value already exists" });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: "Internal server error" });
});

async function start() {
  if (!env.mongoUri || !env.jwtSecret) {
    throw new Error("MONGODB_URI and JWT_SECRET must be set");
  }

  await mongoose.connect(env.mongoUri);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`KasaFund API listening on port ${port}`);
    startAutoContributionProcessor();
    startSavingsProcessor();
    startPayoutProcessor();
    startCampaignLifecycleProcessor();
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
