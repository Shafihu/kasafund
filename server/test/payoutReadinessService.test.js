import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePayoutReadiness,
  endOfScheduledDayUtc,
} from "../src/services/payoutReadinessService.js";

test("marks a payout ready only when every snapshotted member has paid", () => {
  const result = calculatePayoutReadiness({
    expectedContributorIds: ["member-a", "member-b"],
    paidContributorIds: ["member-a", "member-b"],
    graceEndsAt: new Date("2026-07-25T00:00:00.000Z"),
    now: new Date("2026-07-24T12:00:00.000Z"),
  });

  assert.equal(result.status, "ready");
  assert.equal(result.paidCount, 2);
  assert.equal(result.missingCount, 0);
});

test("keeps an incomplete payout awaiting during its grace period", () => {
  const result = calculatePayoutReadiness({
    expectedContributorIds: ["member-a", "member-b"],
    paidContributorIds: ["member-a"],
    graceEndsAt: new Date("2026-07-25T00:00:00.000Z"),
    now: new Date("2026-07-24T12:00:00.000Z"),
  });

  assert.equal(result.status, "awaiting");
  assert.deepEqual(result.missingContributorIds, ["member-b"]);
});

test("marks missing contributions overdue after grace expires", () => {
  const result = calculatePayoutReadiness({
    expectedContributorIds: ["member-a", "member-b"],
    paidContributorIds: ["member-a"],
    graceEndsAt: new Date("2026-07-25T00:00:00.000Z"),
    now: new Date("2026-07-25T00:00:00.000Z"),
  });

  assert.equal(result.status, "overdue");
  assert.equal(result.missingCount, 1);
});

test("calculates grace from the end of the scheduled UTC day", () => {
  assert.equal(
    endOfScheduledDayUtc("2026-07-23T14:30:00.000Z", 2).toISOString(),
    "2026-07-26T00:00:00.000Z"
  );
});
