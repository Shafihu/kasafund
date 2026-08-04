export const GROUP_AGREEMENT_VERSION = "2026-07-01";

export function agreementSnapshot(group) {
  return {
    contributionAmount: group.contribution.amount,
    contributionFrequency: group.contribution.frequency,
    gracePeriodDays: group.contribution.gracePeriodDays || 0,
    penaltyAmount: group.contribution.penaltyAmount || 0,
    acceleratedDebt: true,
    resolutionVoting: true,
  };
}

export function acceptedAgreement(group, body, source, acceptedAt = new Date()) {
  if (
    body?.agreementAccepted !== true ||
    body?.agreementVersion !== GROUP_AGREEMENT_VERSION
  ) {
    const error = new Error(
      "Review and accept the current digital group agreement before joining"
    );
    error.code = "GROUP_AGREEMENT_REQUIRED";
    error.statusCode = 428;
    throw error;
  }
  return {
    version: GROUP_AGREEMENT_VERSION,
    acceptedAt,
    source,
    termsSnapshot: agreementSnapshot(group),
  };
}
