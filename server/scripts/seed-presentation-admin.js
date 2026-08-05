import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { User } from "../src/models/User.js";

const mongoUri = process.env.PRESENTATION_MONGODB_URI || env.mongoUri;
const password = process.env.PRESENTATION_ADMIN_PASSWORD
  || process.env.PRESENTATION_DEMO_PASSWORD
  || "KasaFundDemo2026!";
const email = "admin@demo.kasafund.app";

function assertSafeDatabase() {
  if (!mongoUri) throw new Error("PRESENTATION_MONGODB_URI or MONGODB_URI must be set");
  if (env.nodeEnv === "production") {
    throw new Error("Presentation administrator seeding is disabled in production");
  }
  const databaseName = mongoUri.split("?")[0].split("/").at(-1) || "";
  if (!/(presentation|demo)/i.test(databaseName) && process.env.ALLOW_PRESENTATION_SEED !== "true") {
    throw new Error(
      `Refusing to create a demo administrator in "${databaseName || "(unnamed)"}". `
      + "Use a presentation/demo database or set ALLOW_PRESENTATION_SEED=true.",
    );
  }
}

async function seedPresentationAdmin() {
  assertSafeDatabase();
  await mongoose.connect(mongoUri);

  const existing = await User.findOne({ email });
  if (existing && !["admin", "super_admin"].includes(existing.role)) {
    throw new Error(`Refusing to elevate the existing non-admin account ${email}`);
  }

  if (existing) {
    existing.passwordHash = await bcrypt.hash(password, 12);
    existing.isActive = true;
    existing.isEmailVerified = true;
    existing.emailVerified = true;
    existing.isPhoneVerified = true;
    existing.phoneVerifiedAt ||= new Date();
    await existing.save();
  } else {
    await User.create({
      fullName: "KasaFund Administrator",
      email,
      phone: "+233200009999",
      passwordHash: await bcrypt.hash(password, 12),
      role: "super_admin",
      isEmailVerified: true,
      emailVerified: true,
      isPhoneVerified: true,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      identityVerification: {
        provider: "didit",
        status: "verified",
        documentType: "Ghana Card",
        issuingCountry: "GHA",
        verifiedAt: new Date(),
        submittedAt: new Date(),
        lastCheckedAt: new Date(),
      },
      isActive: true,
    });
  }

  console.log(`Presentation administrator ready: ${email}`);
}

seedPresentationAdmin()
  .catch((error) => {
    console.error("Could not seed presentation administrator:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
