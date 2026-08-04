import assert from "node:assert/strict";
import test from "node:test";
import { decideResolution } from "../src/controllers/resolutionController.js";

test("approves only after a strict majority and recipient approval", () => {
  assert.equal(decideResolution({
    yesVotes: 2,
    votesCast: 2,
    eligibleVoterCount: 3,
    requiredYesVotes: 2,
    recipientVote: "approve",
  }), "approved");
  assert.equal(decideResolution({
    yesVotes: 2,
    votesCast: 2,
    eligibleVoterCount: 3,
    requiredYesVotes: 2,
    recipientVote: null,
  }), null);
});

test("recipient rejection immediately rejects the proposal", () => {
  assert.equal(decideResolution({
    yesVotes: 2,
    votesCast: 3,
    eligibleVoterCount: 4,
    requiredYesVotes: 3,
    recipientVote: "reject",
  }), "rejected");
});

test("rejects when remaining votes cannot reach the threshold", () => {
  assert.equal(decideResolution({
    yesVotes: 1,
    votesCast: 4,
    eligibleVoterCount: 5,
    requiredYesVotes: 3,
    recipientVote: "approve",
  }), "rejected");
});
