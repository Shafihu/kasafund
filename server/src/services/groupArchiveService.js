export function getGroupArchiveBlockers({
  status,
  totalPot,
  openPayoutCount,
  openDelinquencyCount,
  openResolutionCount,
}) {
  const blockers = [];

  if (status === "active") {
    blockers.push("Pause the group before archiving it");
  }
  if (totalPot > 0) {
    blockers.push("Bring the group balance to GHS 0");
  }
  if (openPayoutCount > 0) {
    blockers.push("Complete or resolve every scheduled payout");
  }
  if (openDelinquencyCount > 0) {
    blockers.push("Resolve every outstanding member debt");
  }
  if (openResolutionCount > 0) {
    blockers.push("Finish the active group resolution");
  }

  return blockers;
}

export function groupArchiveErrorMessage(blockers) {
  if (!blockers.length) return "";
  return `This group cannot be archived yet. ${blockers.join(". ")}.`;
}

export function isEmptyScheduledPayout({
  status,
  snapshotLockedAt,
  contributionStarted,
}) {
  return status === "scheduled" && !snapshotLockedAt && !contributionStarted;
}
