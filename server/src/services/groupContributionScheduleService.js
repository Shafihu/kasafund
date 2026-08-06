export function scheduledGroupContribution(contribution, now = new Date()) {
  const start = new Date(contribution.startDate);
  if (start > now) return { cycleNumber: 1, dueDate: start };

  if (contribution.frequency === "daily") {
    const elapsed = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + elapsed);
    return { cycleNumber: elapsed + 1, dueDate };
  }
  if (contribution.frequency === "weekly") {
    const elapsed = Math.floor((now.getTime() - start.getTime()) / (7 * 86_400_000));
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + elapsed * 7);
    return { cycleNumber: elapsed + 1, dueDate };
  }

  const elapsed = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      now.getMonth() -
      start.getMonth() -
      (now.getDate() < start.getDate() ? 1 : 0)
  );
  const dueDate = new Date(start);
  dueDate.setMonth(start.getMonth() + elapsed);
  return { cycleNumber: elapsed + 1, dueDate };
}
