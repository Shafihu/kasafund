import assert from "node:assert/strict";
import test from "node:test";
import { requireSuperAdmin } from "../src/middleware/auth.js";
import {
  campaignModerationTransition,
  getAdminCampaign,
  getAdminGroup,
  getAdminReport,
  moderateAdminCampaign,
  reportCaseTransition,
  updateAdminReport,
} from "../src/controllers/adminController.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("requireSuperAdmin permits a super administrator", () => {
  let called = false;
  requireSuperAdmin({ user: { role: "super_admin" } }, responseRecorder(), () => { called = true; });
  assert.equal(called, true);
});

test("requireSuperAdmin rejects a regular member", () => {
  const response = responseRecorder();
  requireSuperAdmin({ user: { role: "user" } }, response, () => assert.fail("next should not run"));
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "ADMIN_ACCESS_REQUIRED");
});

test("group inspection rejects an invalid identifier before querying", async () => {
  const response = responseRecorder();
  await getAdminGroup({ params: { id: "not-an-id" } }, response, () => {
    assert.fail("next should not run");
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, "Invalid group identifier");
});

test("campaign inspection rejects an invalid identifier before querying", async () => {
  const response = responseRecorder();
  await getAdminCampaign({ params: { id: "not-an-id" } }, response, () => {
    assert.fail("next should not run");
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, "Invalid campaign identifier");
});

test("campaign moderation permits only reversible active and flagged transitions", () => {
  assert.equal(campaignModerationTransition("active", "flag"), "flagged");
  assert.equal(campaignModerationTransition("flagged", "restore"), "active");
  assert.throws(
    () => campaignModerationTransition("completed", "flag"),
    /Only an active campaign can be flagged/
  );
  assert.throws(
    () => campaignModerationTransition("active", "restore"),
    /Only a flagged campaign can be restored/
  );
});

test("campaign moderation validates identifiers and reasons before opening a transaction", async () => {
  const invalidIdResponse = responseRecorder();
  await moderateAdminCampaign(
    { params: { id: "not-an-id" }, body: { action: "flag", reason: "A valid moderation reason" } },
    invalidIdResponse,
    () => assert.fail("next should not run")
  );
  assert.equal(invalidIdResponse.statusCode, 400);
  assert.equal(invalidIdResponse.body.message, "Invalid campaign identifier");

  const shortReasonResponse = responseRecorder();
  await moderateAdminCampaign(
    { params: { id: "507f1f77bcf86cd799439011" }, body: { action: "flag", reason: "Too short" } },
    shortReasonResponse,
    () => assert.fail("next should not run")
  );
  assert.equal(shortReasonResponse.statusCode, 400);
  assert.equal(shortReasonResponse.body.message, "Give a reason between 10 and 300 characters");
});

test("report cases follow an owned and reversible review lifecycle", () => {
  assert.equal(reportCaseTransition("pending", "start_review"), "reviewing");
  assert.equal(reportCaseTransition("reviewing", "start_review"), "reviewing");
  assert.equal(reportCaseTransition("reviewing", "resolve"), "resolved");
  assert.equal(reportCaseTransition("reviewing", "dismiss"), "dismissed");
  assert.equal(reportCaseTransition("resolved", "reopen"), "reviewing");
  assert.equal(reportCaseTransition("dismissed", "reopen"), "reviewing");
  assert.throws(() => reportCaseTransition("pending", "resolve"), /cannot be resolve/);
  assert.throws(() => reportCaseTransition("resolved", "dismiss"), /cannot be dismiss/);
});

test("report review endpoints reject invalid identifiers and weak decision explanations", async () => {
  const invalidIdResponse = responseRecorder();
  await getAdminReport({ params: { id: "not-an-id" } }, invalidIdResponse, () => {
    assert.fail("next should not run");
  });
  assert.equal(invalidIdResponse.statusCode, 400);
  assert.equal(invalidIdResponse.body.message, "Invalid report identifier");

  const shortSummaryResponse = responseRecorder();
  await updateAdminReport(
    { params: { id: "507f1f77bcf86cd799439011" }, body: { action: "resolve", summary: "Too short" } },
    shortSummaryResponse,
    () => assert.fail("next should not run")
  );
  assert.equal(shortSummaryResponse.statusCode, 400);
  assert.equal(shortSummaryResponse.body.message, "Give an explanation between 10 and 1,000 characters");
});
