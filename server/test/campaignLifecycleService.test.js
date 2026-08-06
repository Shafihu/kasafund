import assert from "node:assert/strict";
import test from "node:test";
import { campaignLifecycleStatus } from "../src/services/campaignLifecycleService.js";

const now = new Date("2026-08-06T12:00:00.000Z");

test("keeps an active campaign open before its deadline and goal", () => {
  assert.equal(campaignLifecycleStatus({
    status: "active",
    raisedAmount: 75_000,
    goalAmount: 100_000,
    deadline: new Date("2026-08-07T12:00:00.000Z"),
  }, now), "active");
});

test("closes an active campaign when its deadline elapses", () => {
  assert.equal(campaignLifecycleStatus({
    status: "active",
    raisedAmount: 75_000,
    goalAmount: 100_000,
    deadline: new Date("2026-08-06T12:00:00.000Z"),
  }, now), "closed");
});

test("completes a funded campaign even when its deadline also elapsed", () => {
  assert.equal(campaignLifecycleStatus({
    status: "active",
    raisedAmount: 100_000,
    goalAmount: 100_000,
    deadline: new Date("2026-08-05T12:00:00.000Z"),
  }, now), "completed");
});

test("does not rewrite an existing final or moderation status", () => {
  assert.equal(campaignLifecycleStatus({ status: "flagged" }, now), "flagged");
  assert.equal(campaignLifecycleStatus({ status: "completed" }, now), "completed");
  assert.equal(campaignLifecycleStatus({ status: "closed" }, now), "closed");
});
