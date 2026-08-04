const campaignsNeedingRefresh = new Set<string>();

export function markCampaignForRefresh(campaignId: string) {
  campaignsNeedingRefresh.add(campaignId);
}

export function consumeCampaignRefresh(campaignId: string) {
  const shouldRefresh = campaignsNeedingRefresh.has(campaignId);
  campaignsNeedingRefresh.delete(campaignId);
  return shouldRefresh;
}
