import assert from "node:assert/strict";
import test from "node:test";
import { collectivePayoutDecision } from "../src/services/collectivePayoutDecisionService.js";

test("collective payout requires a strict majority", () => {
  assert.equal(collectivePayoutDecision({ eligibleVoterCount: 8, requiredYesVotes: 5, yesVotes: 4, noVotes: 0 }), "voting");
  assert.equal(collectivePayoutDecision({ eligibleVoterCount: 8, requiredYesVotes: 5, yesVotes: 5, noVotes: 0 }), "approved");
});

test("collective payout rejects when a majority is no longer possible", () => {
  assert.equal(collectivePayoutDecision({ eligibleVoterCount: 8, requiredYesVotes: 5, yesVotes: 3, noVotes: 3 }), "voting");
  assert.equal(collectivePayoutDecision({ eligibleVoterCount: 8, requiredYesVotes: 5, yesVotes: 3, noVotes: 4 }), "rejected");
});
