export function collectivePayoutDecision({
  eligibleVoterCount,
  requiredYesVotes,
  yesVotes,
  noVotes,
}) {
  if (yesVotes >= requiredYesVotes) return "approved";
  const rejectionThreshold = eligibleVoterCount - requiredYesVotes + 1;
  if (noVotes >= rejectionThreshold) return "rejected";
  return "voting";
}
