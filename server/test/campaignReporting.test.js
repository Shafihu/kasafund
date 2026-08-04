import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { reportCampaign } from "../src/controllers/campaignController.js";
import { UserReport } from "../src/models/UserReport.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("campaign reporting validates identifiers, reasons, and useful context before querying", async () => {
  const invalidId = responseRecorder();
  await reportCampaign({ params: { id: "not-an-id" }, body: { reason: "scam", details: "A specific and useful concern" } }, invalidId);
  assert.equal(invalidId.statusCode, 400);
  assert.equal(invalidId.body.message, "Invalid campaign");

  const invalidReason = responseRecorder();
  await reportCampaign({ params: { id: "507f1f77bcf86cd799439011" }, body: { reason: "harassment", details: "A specific and useful concern" } }, invalidReason);
  assert.equal(invalidReason.statusCode, 400);
  assert.equal(invalidReason.body.message, "Choose a valid report reason");

  const weakDetails = responseRecorder();
  await reportCampaign({ params: { id: "507f1f77bcf86cd799439011" }, body: { reason: "misleading", details: "Too short" } }, weakDetails);
  assert.equal(weakDetails.statusCode, 400);
  assert.equal(weakDetails.body.message, "Explain the concern in 10 to 1,000 characters");
});

test("report records require the identifier that matches their target type", async () => {
  const reporterId = new mongoose.Types.ObjectId();
  const campaignId = new mongoose.Types.ObjectId();
  const memberId = new mongoose.Types.ObjectId();

  await new UserReport({ reporterId, targetType: "campaign", reportedCampaignId: campaignId, reason: "misleading", details: "Specific campaign concern" }).validate();
  await new UserReport({ reporterId, targetType: "member", reportedUserId: memberId, reason: "scam" }).validate();
  await assert.rejects(
    new UserReport({ reporterId, targetType: "campaign", reason: "misleading", details: "Specific campaign concern" }).validate(),
    /reportedCampaignId/
  );
  await assert.rejects(
    new UserReport({ reporterId, targetType: "member", reason: "scam" }).validate(),
    /reportedUserId/
  );
});
