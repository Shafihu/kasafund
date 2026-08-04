import assert from "node:assert/strict";
import test from "node:test";
import {
  FINAL_RESOLUTION_ATTEMPT,
  shouldCloseResolutionDeadlock,
} from "../src/services/deadlockClosureService.js";

test("keeps the first expired vote available for one final attempt", () => {
  assert.equal(
    shouldCloseResolutionDeadlock({ status: "expired", attemptNumber: 1 }),
    false
  );
});

test("closes an expired final vote as a deadlock", () => {
  assert.equal(FINAL_RESOLUTION_ATTEMPT, 2);
  assert.equal(
    shouldCloseResolutionDeadlock({ status: "expired", attemptNumber: 2 }),
    true
  );
});

test("never closes a vote that is still active", () => {
  assert.equal(
    shouldCloseResolutionDeadlock({ status: "voting", attemptNumber: 2 }),
    false
  );
});
