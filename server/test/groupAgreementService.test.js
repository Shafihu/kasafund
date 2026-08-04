import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptedAgreement,
  GROUP_AGREEMENT_VERSION,
} from "../src/services/groupAgreementService.js";

const group = {
  contribution: {
    amount: 2_000,
    frequency: "weekly",
    gracePeriodDays: 2,
    penaltyAmount: 0,
  },
};

test("records the accepted version and exact financial terms", () => {
  const acceptedAt = new Date("2026-07-27T10:00:00.000Z");
  const agreement = acceptedAgreement(
    group,
    {
      agreementAccepted: true,
      agreementVersion: GROUP_AGREEMENT_VERSION,
    },
    "invite_code",
    acceptedAt
  );
  assert.equal(agreement.version, GROUP_AGREEMENT_VERSION);
  assert.equal(agreement.acceptedAt, acceptedAt);
  assert.deepEqual(agreement.termsSnapshot, {
    contributionAmount: 2_000,
    contributionFrequency: "weekly",
    gracePeriodDays: 2,
    penaltyAmount: 0,
    acceleratedDebt: true,
    resolutionVoting: true,
  });
});

test("rejects joining without explicit agreement acceptance", () => {
  assert.throws(
    () =>
      acceptedAgreement(
        group,
        { agreementAccepted: false, agreementVersion: GROUP_AGREEMENT_VERSION },
        "public_request"
      ),
    { code: "GROUP_AGREEMENT_REQUIRED" }
  );
});

test("rejects an outdated agreement version", () => {
  assert.throws(
    () =>
      acceptedAgreement(
        group,
        { agreementAccepted: true, agreementVersion: "old-version" },
        "invitation"
      ),
    { code: "GROUP_AGREEMENT_REQUIRED" }
  );
});
