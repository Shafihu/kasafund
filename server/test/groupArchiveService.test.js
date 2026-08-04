import assert from "node:assert/strict";
import test from "node:test";
import {
  getGroupArchiveBlockers,
  groupArchiveErrorMessage,
  isEmptyScheduledPayout,
} from "../src/services/groupArchiveService.js";

const settledGroup = {
  status: "completed",
  totalPot: 0,
  openPayoutCount: 0,
  openDelinquencyCount: 0,
  openResolutionCount: 0,
};

test("allows a completed and fully settled group to be archived", () => {
  assert.deepEqual(getGroupArchiveBlockers(settledGroup), []);
});

test("blocks an active group even when its financial records are settled", () => {
  assert.deepEqual(
    getGroupArchiveBlockers({ ...settledGroup, status: "active" }),
    ["Pause the group before archiving it"]
  );
});

test("reports every financial condition that must be resolved", () => {
  const blockers = getGroupArchiveBlockers({
    status: "paused",
    totalPot: 45000,
    openPayoutCount: 1,
    openDelinquencyCount: 2,
    openResolutionCount: 1,
  });

  assert.deepEqual(blockers, [
    "Bring the group balance to GHS 0",
    "Complete or resolve every scheduled payout",
    "Resolve every outstanding member debt",
    "Finish the active group resolution",
  ]);
  assert.equal(
    groupArchiveErrorMessage(blockers),
    "This group cannot be archived yet. Bring the group balance to GHS 0. " +
      "Complete or resolve every scheduled payout. Resolve every outstanding member debt. " +
      "Finish the active group resolution."
  );
});

test("treats only an untouched scheduled payout as removable bookkeeping", () => {
  assert.equal(
    isEmptyScheduledPayout({
      status: "scheduled",
      snapshotLockedAt: null,
      contributionStarted: false,
    }),
    true
  );
  assert.equal(
    isEmptyScheduledPayout({
      status: "scheduled",
      snapshotLockedAt: new Date(),
      contributionStarted: false,
    }),
    false
  );
  assert.equal(
    isEmptyScheduledPayout({
      status: "scheduled",
      snapshotLockedAt: null,
      contributionStarted: true,
    }),
    false
  );
  assert.equal(
    isEmptyScheduledPayout({
      status: "processing",
      snapshotLockedAt: null,
      contributionStarted: false,
    }),
    false
  );
});
