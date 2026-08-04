import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateCommitment,
  remainingRoundCommitment,
} from "../src/services/debtLiabilityService.js";

test("accelerates the remaining commitment after a first payout", () => {
  assert.equal(
    remainingRoundCommitment({
      payoutReceived: 10_000,
      contributionsPaid: 2_000,
      minimumContribution: 2_000,
    }),
    8_000
  );
});

test("subtracts every contribution already completed in the round", () => {
  assert.equal(
    remainingRoundCommitment({
      payoutReceived: 10_000,
      contributionsPaid: 6_000,
      minimumContribution: 2_000,
    }),
    4_000
  );
});

test("never records less than the currently missed contribution", () => {
  assert.equal(
    remainingRoundCommitment({
      payoutReceived: 10_000,
      contributionsPaid: 10_000,
      minimumContribution: 2_000,
    }),
    2_000
  );
});

test("distributes an accelerated debt across remaining recipients", () => {
  assert.deepEqual(allocateCommitment(8_000, 2_000, ["a", "b", "c", "d"]), [
    { userId: "a", amount: 2_000 },
    { userId: "b", amount: 2_000 },
    { userId: "c", amount: 2_000 },
    { userId: "d", amount: 2_000 },
  ]);
});
