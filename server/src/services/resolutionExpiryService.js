import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupResolution } from "../models/GroupResolution.js";
import { Notification } from "../models/Notification.js";
import { audit } from "../utils/api.js";
import {
  closePendingResolutionDeadlocks,
  closeResolutionDeadlock,
  shouldCloseResolutionDeadlock,
} from "./deadlockClosureService.js";

export async function expireResolution(resolutionId, now = new Date()) {
  const resolution = await GroupResolution.findOneAndUpdate(
    {
      _id: resolutionId,
      status: "voting",
      expiresAt: { $lte: now },
    },
    {
      $set: {
        status: "expired",
        decidedAt: now,
        failureReason: "Voting period ended before a decision was reached",
      },
    },
    { new: true }
  );
  if (!resolution) return null;

  const [group, managers] = await Promise.all([
    Group.findById(resolution.groupId).select("name ownerId"),
    GroupMember.find({
      groupId: resolution.groupId,
      status: "active",
      role: { $in: ["owner", "treasurer"] },
    }).select("userId"),
  ]);
  const recipients = new Set([
    ...resolution.eligibleVoterIds.map(String),
    ...managers.map((member) => String(member.userId)),
  ]);
  if (recipients.size) {
    await Notification.insertMany(
      [...recipients].map((userId) => ({
        userId,
        type: "resolution_completed",
        title: "Group vote expired",
        body: `${group?.name || "Your group"} did not reach a decision before voting closed. The payout remains safely paused.`,
        relatedGroupId: resolution.groupId,
      }))
    );
  }
  if (group?.ownerId) {
    await audit({
      actorId: group.ownerId,
      action: "group.resolution_expired",
      targetType: "group",
      targetId: resolution.groupId,
      metadata: {
        resolutionId: resolution._id,
        payoutId: resolution.payoutId,
        attemptNumber: resolution.attemptNumber || 1,
        automated: true,
      },
    });
  }
  if (shouldCloseResolutionDeadlock(resolution)) {
    await closeResolutionDeadlock(resolution._id, now);
  }
  return resolution;
}

export async function expireGroupResolutions(groupId, now = new Date()) {
  const resolutions = await GroupResolution.find({
    groupId,
    status: "voting",
    expiresAt: { $lte: now },
  }).select("_id");
  const expired = [];
  for (const resolution of resolutions) {
    const result = await expireResolution(resolution._id, now);
    if (result) expired.push(result);
  }
  return expired;
}

export async function expireDueResolutions({ limit = 50, now = new Date() } = {}) {
  const resolutions = await GroupResolution.find({
    status: "voting",
    expiresAt: { $lte: now },
  })
    .sort({ expiresAt: 1 })
    .select("_id")
    .limit(limit);
  let expired = 0;
  let errors = 0;
  for (const resolution of resolutions) {
    try {
      if (await expireResolution(resolution._id, now)) expired += 1;
    } catch (error) {
      errors += 1;
      console.error(`Resolution expiry ${resolution._id} failed:`, error.message);
    }
  }
  const deadlocks = await closePendingResolutionDeadlocks({ limit, now });
  return {
    checked: resolutions.length,
    expired,
    errors,
    deadlocksClosed: deadlocks.closed,
    deadlockErrors: deadlocks.errors,
  };
}
