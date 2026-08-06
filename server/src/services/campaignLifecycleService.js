import { Campaign } from "../models/Campaign.js";
import { Donation } from "../models/Donation.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";

const PROCESSOR_INTERVAL_MS = 60_000;

export function campaignLifecycleStatus(campaign, now = new Date()) {
  if (!campaign || campaign.status !== "active") return campaign?.status || null;
  if (campaign.raisedAmount >= campaign.goalAmount) return "completed";
  if (new Date(campaign.deadline).getTime() <= now.getTime()) return "closed";
  return "active";
}

async function notifyLifecycleChange(campaign, status, session) {
  const options = session ? { session } : undefined;
  const notification = {
    userId: campaign.creatorId?._id || campaign.creatorId,
    type: "campaign_update",
    title: status === "completed" ? "Campaign goal reached" : "Campaign ended",
    body: status === "completed"
      ? `${campaign.title} reached its fundraising goal and is now complete.`
      : `${campaign.title} reached its deadline and is now closed.`,
    relatedCampaignId: campaign._id,
  };
  await Notification.create([notification], options);

  if (status === "completed") {
    const donorIds = await Donation.distinct("donorId", {
      campaignId: campaign._id,
      status: "completed",
      donorId: { $ne: null },
    }).session(session);
    const eligibleDonorIds = donorIds.filter(
      (donorId) => String(donorId) !== String(campaign.creatorId?._id || campaign.creatorId)
    );
    const supporters = eligibleDonorIds.length
      ? await User.find({
          _id: { $in: eligibleDonorIds },
          "preferences.campaignNotifications": { $ne: false },
        }).select("_id").session(session)
      : [];
    if (supporters.length) {
      await Notification.insertMany(
        supporters.map((supporter) => ({
          userId: supporter._id,
          type: "campaign_update",
          title: "A campaign you supported reached its goal",
          body: `${campaign.title} is now fully funded. Thank you for being part of it.`,
          relatedCampaignId: campaign._id,
        })),
        options
      );
    }
  }
}

export async function reconcileCampaignLifecycle(campaign, { now = new Date(), session = null } = {}) {
  const nextStatus = campaignLifecycleStatus(campaign, now);
  if (nextStatus === campaign.status) return { campaign, changed: false };

  const updated = await Campaign.findOneAndUpdate(
    { _id: campaign._id, status: "active" },
    { $set: { status: nextStatus } },
    { new: true, session }
  );
  if (!updated) return { campaign, changed: false };

  await notifyLifecycleChange(updated, nextStatus, session);
  campaign.status = nextStatus;
  return { campaign, changed: true };
}

export async function reconcileCampaignById(campaignId, options = {}) {
  const campaign = await Campaign.findById(campaignId).session(options.session || null);
  if (!campaign) return null;
  return (await reconcileCampaignLifecycle(campaign, options)).campaign;
}

export async function processCampaignLifecycles({ now = new Date(), limit = 100 } = {}) {
  const campaigns = await Campaign.find({
    status: "active",
    $or: [
      { deadline: { $lte: now } },
      { $expr: { $gte: ["$raisedAmount", "$goalAmount"] } },
    ],
  }).limit(limit);
  const summary = { checked: campaigns.length, completed: 0, closed: 0 };

  for (const campaign of campaigns) {
    const result = await reconcileCampaignLifecycle(campaign, { now });
    if (result.changed) summary[result.campaign.status] += 1;
  }
  return summary;
}

export function startCampaignLifecycleProcessor() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await processCampaignLifecycles();
      if (summary.completed || summary.closed) {
        console.log("Campaign lifecycle run:", summary);
      }
    } catch (error) {
      console.error("Campaign lifecycle processor failed:", error.message);
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(run, PROCESSOR_INTERVAL_MS);
  timer.unref();
  console.log(`Campaign lifecycle processor runs every ${PROCESSOR_INTERVAL_MS}ms`);
  return timer;
}
