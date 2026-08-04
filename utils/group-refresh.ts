const groupsNeedingRefresh = new Set<string>();

export function markGroupForRefresh(groupId: string) {
  groupsNeedingRefresh.add(groupId);
}

export function consumeGroupRefresh(groupId: string) {
  const shouldRefresh = groupsNeedingRefresh.has(groupId);
  groupsNeedingRefresh.delete(groupId);
  return shouldRefresh;
}
