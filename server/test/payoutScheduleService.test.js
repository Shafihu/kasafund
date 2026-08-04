import assert from "node:assert/strict";
import test from "node:test";
import { defaultFirstPayoutDate } from "../src/services/payoutScheduleService.js";

const createdAt = new Date("2026-07-23T10:30:00.000Z");

test("daily groups schedule their first payout one day after creation", () => {
  assert.equal(
    defaultFirstPayoutDate("daily", createdAt).toISOString(),
    "2026-07-24T10:30:00.000Z"
  );
});

test("weekly groups schedule their first payout seven days after creation", () => {
  assert.equal(
    defaultFirstPayoutDate("weekly", createdAt).toISOString(),
    "2026-07-30T10:30:00.000Z"
  );
});

test("monthly groups schedule their first payout one month after creation", () => {
  assert.equal(
    defaultFirstPayoutDate("monthly", createdAt).toISOString(),
    "2026-08-23T10:30:00.000Z"
  );
});
