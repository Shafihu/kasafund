import assert from "node:assert/strict";
import mongoose from "mongoose";
import test from "node:test";
import { Payout } from "../src/models/Payout.js";

const objectId = () => new mongoose.Types.ObjectId();

test("normal scheduled payouts validate without a resolution original amount", () => {
  const payout = new Payout({
    groupId: objectId(),
    recipientId: objectId(),
    cycleNumber: 1,
    rotationRound: 1,
    amount: 10_000,
    contributionAmount: 10_000,
    expectedContributorIds: [objectId()],
    scheduledDate: new Date("2026-08-01T00:00:00.000Z"),
  });

  assert.equal(payout.originalAmount, null);
  assert.equal(payout.validateSync(), undefined);
});

test("resolution original amount still rejects fractional values", () => {
  const payout = new Payout({
    groupId: objectId(),
    recipientId: objectId(),
    cycleNumber: 1,
    rotationRound: 1,
    amount: 10_000,
    originalAmount: 9_999.5,
    scheduledDate: new Date("2026-08-01T00:00:00.000Z"),
  });

  assert.match(
    payout.validateSync()?.errors.originalAmount.message || "",
    /integer/
  );
});
