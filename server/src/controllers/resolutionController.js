import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupResolution } from "../models/GroupResolution.js";
import { Notification } from "../models/Notification.js";
import { nowForGroup } from "../services/developmentClockService.js";
import { processPayout } from "../services/payoutProcessorService.js";
import {
  evaluatePayoutReadiness,
  recordPayoutDelinquencies,
} from "../services/payoutReadinessService.js";
import { ensureNextPayout } from "../services/payoutScheduleService.js";
import {
  expireGroupResolutions,
  expireResolution,
} from "../services/resolutionExpiryService.js";
import { audit } from "../utils/api.js";

async function manager(groupId, userId) {
  return GroupMember.exists({
    groupId,
    userId,
    status: "active",
    role: { $in: ["owner", "treasurer"] },
  });
}

function voteSummary(resolution) {
  const yesVotes = resolution.votes.filter((vote) => vote.choice === "approve").length;
  const noVotes = resolution.votes.filter((vote) => vote.choice === "reject").length;
  const recipientVote = resolution.votes.find(
    (vote) => String(vote.userId) === String(resolution.recipientId)
  )?.choice || null;
  return { yesVotes, noVotes, recipientVote };
}

export function decideResolution({
  yesVotes,
  votesCast,
  eligibleVoterCount,
  requiredYesVotes,
  recipientVote,
}) {
  if (recipientVote === "reject") return "rejected";
  if (yesVotes >= requiredYesVotes && recipientVote === "approve") return "approved";
  const remainingVotes = eligibleVoterCount - votesCast;
  if (yesVotes + remainingVotes < requiredYesVotes) return "rejected";
  return null;
}

export async function createResolution(req, res) {
  if (!(await manager(req.params.id, req.user._id))) {
    return res.status(403).json({
      success: false,
      message: "Owner or treasurer permission required",
    });
  }
  const [group, payout] = await Promise.all([
    Group.findOne({ _id: req.params.id, status: "active" }),
    ensureNextPayout(req.params.id),
  ]);
  if (!group || !payout) {
    return res.status(404).json({ success: false, message: "Active payout not found" });
  }
  const now = nowForGroup(group._id);
  await expireGroupResolutions(group._id, now);
  const readiness = await evaluatePayoutReadiness(payout, { now });
  if (readiness.status !== "overdue" || !readiness.missingCount) {
    return res.status(409).json({
      success: false,
      message: "A resolution can only be proposed for an overdue payout",
    });
  }
  if (readiness.missingContributorIds.some(
    (userId) => String(userId) === String(payout.recipientId)
  )) {
    return res.status(409).json({
      success: false,
      message: "The payout recipient must pay their own contribution before a resolution vote",
    });
  }

  const missing = new Set(readiness.missingContributorIds.map(String));
  const defaultingOwner = await GroupMember.exists({
    groupId: group._id,
    userId: { $in: readiness.missingContributorIds },
    status: "active",
    role: "owner",
  });
  if (defaultingOwner) {
    return res.status(409).json({
      success: false,
      message: "Transfer group ownership before resolving a cycle where the owner defaulted",
    });
  }
  const eligibleVoterIds = payout.expectedContributorIds.filter(
    (userId) => !missing.has(String(userId))
  );
  const proposedPayoutAmount =
    (payout.contributionAmount || group.contribution.amount) * readiness.paidCount;
  if (!eligibleVoterIds.length || proposedPayoutAmount < 1) {
    return res.status(409).json({
      success: false,
      message: "There are not enough paid members to resolve this payout",
    });
  }

  await recordPayoutDelinquencies(payout, readiness);
  let resolution;
  const existingResolution = await GroupResolution.findOne({ payoutId: payout._id });
  if (existingResolution) {
    if (existingResolution.status !== "expired") {
      return res.status(409).json({
        success: false,
        message: existingResolution.status === "voting"
          ? "A resolution vote is already active for this payout"
          : "This payout already has a completed resolution decision",
      });
    }
    if ((existingResolution.attemptNumber || 1) >= 2) {
      return res.status(409).json({
        success: false,
        message:
          "The final vote has ended. This cycle is being safely closed and paid contributions will be returned.",
      });
    }
    existingResolution.createdBy = req.user._id;
    existingResolution.status = "voting";
    existingResolution.recipientId = payout.recipientId;
    existingResolution.defaultingUserIds = readiness.missingContributorIds;
    existingResolution.eligibleVoterIds = eligibleVoterIds;
    existingResolution.requiredYesVotes = Math.floor(eligibleVoterIds.length / 2) + 1;
    existingResolution.originalPayoutAmount = payout.amount;
    existingResolution.proposedPayoutAmount = proposedPayoutAmount;
    existingResolution.votes = [];
    existingResolution.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    existingResolution.decidedAt = null;
    existingResolution.executedAt = null;
    existingResolution.failureReason = "";
    existingResolution.attemptNumber = (existingResolution.attemptNumber || 1) + 1;
    resolution = await existingResolution.save();
  } else {
    try {
      resolution = await GroupResolution.create({
        groupId: group._id,
        payoutId: payout._id,
        createdBy: req.user._id,
        recipientId: payout.recipientId,
        defaultingUserIds: readiness.missingContributorIds,
        eligibleVoterIds,
        requiredYesVotes: Math.floor(eligibleVoterIds.length / 2) + 1,
        originalPayoutAmount: payout.amount,
        proposedPayoutAmount,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "A resolution already exists for this payout",
        });
      }
      throw error;
    }
  }

  await Notification.insertMany(eligibleVoterIds.map((userId) => ({
    userId,
    type: "resolution_created",
    title: resolution.attemptNumber > 1 ? "New group vote required" : "Group vote required",
    body: `${group.name} proposed a reduced payout because ${readiness.missingCount} ${
      readiness.missingCount === 1 ? "member has" : "members have"
    } not contributed.${
      resolution.attemptNumber > 1
        ? " This is the final vote before the cycle closes and confirmed contributions are refunded."
        : ""
    }`,
    relatedGroupId: group._id,
  })));
  await audit({
    actorId: req.user._id,
    action: "group.resolution_created",
    targetType: "group",
    targetId: group._id,
    metadata: {
      resolutionId: resolution._id,
      payoutId: payout._id,
      proposedPayoutAmount,
      attemptNumber: resolution.attemptNumber,
    },
  });
  return res.status(201).json({ success: true, data: resolution });
}

export async function voteOnResolution(req, res) {
  const choice = req.body.choice;
  if (!["approve", "reject"].includes(choice)) {
    return res.status(400).json({ success: false, message: "Choose approve or reject" });
  }
  const now = nowForGroup(req.params.id);
  const expired = await expireResolution(req.params.resolutionId, now);
  if (expired) {
    return res.status(409).json({
      success: false,
      message: "This voting period has ended. Group management can propose a new vote.",
    });
  }
  let resolution = await GroupResolution.findOneAndUpdate(
    {
      _id: req.params.resolutionId,
      groupId: req.params.id,
      status: "voting",
      expiresAt: { $gt: now },
      eligibleVoterIds: req.user._id,
      "votes.userId": { $ne: req.user._id },
    },
    {
      $push: {
        votes: { userId: req.user._id, choice, votedAt: now },
      },
    },
    { new: true }
  );
  if (!resolution) {
    return res.status(409).json({
      success: false,
      message: "You cannot vote on this resolution or have already voted",
    });
  }

  const summary = voteSummary(resolution);
  const decision = decideResolution({
    yesVotes: summary.yesVotes,
    votesCast: resolution.votes.length,
    eligibleVoterCount: resolution.eligibleVoterIds.length,
    requiredYesVotes: resolution.requiredYesVotes,
    recipientVote: summary.recipientVote,
  });

  let payoutResult = null;
  if (decision) {
    const decided = await GroupResolution.findOneAndUpdate(
      { _id: resolution._id, status: "voting" },
      { $set: { status: decision, decidedAt: now } },
      { new: true }
    );
    if (decided) resolution = decided;
    if (decided?.status === "rejected") {
      const group = await Group.findById(resolution.groupId).select("name");
      await Notification.insertMany(resolution.eligibleVoterIds.map((userId) => ({
        userId,
        type: "resolution_completed",
        title: "Resolution rejected",
        body: `${group?.name || "Your group"} will continue waiting for the missing contributions.`,
        relatedGroupId: resolution.groupId,
      })));
    }
    if (decided?.status === "approved") {
      payoutResult = await processPayout(resolution.payoutId, {
        actorId: req.user._id,
        now,
        requireDayEnded: true,
        resolutionId: resolution._id,
      });
      if (!payoutResult.processed) {
        resolution.status = "failed";
        resolution.failureReason = payoutResult.reason || "Payout could not be processed";
        await resolution.save();
      } else {
        const group = await Group.findById(resolution.groupId).select("name");
        await Notification.insertMany(resolution.eligibleVoterIds.map((userId) => ({
          userId,
          type: "resolution_completed",
          title: "Resolution approved",
          body: `${group?.name || "Your group"} completed the reduced payout and suspended the defaulting members.`,
          relatedGroupId: resolution.groupId,
        })));
      }
      resolution = await GroupResolution.findById(resolution._id);
    }
  }

  await audit({
    actorId: req.user._id,
    action: `group.resolution_vote_${choice}`,
    targetType: "group",
    targetId: resolution.groupId,
    metadata: { resolutionId: resolution._id },
  });
  return res.json({
    success: true,
    data: {
      resolution,
      ...voteSummary(resolution),
      payoutProcessed: Boolean(payoutResult?.processed),
    },
  });
}
