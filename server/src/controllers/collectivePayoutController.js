import crypto from "crypto";
import mongoose from "mongoose";
import { CollectivePayoutProposal } from "../models/CollectivePayoutProposal.js";
import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { audit } from "../utils/api.js";
import { collectivePayoutDecision } from "../services/collectivePayoutDecisionService.js";

const VOTING_WINDOW_MS = 48 * 60 * 60 * 1000;

function proposalData(proposal, currentUserId) {
  if (!proposal) return null;
  const votes = proposal.votes || [];
  const currentVote = votes.find(
    (vote) => String(vote.userId?._id || vote.userId) === String(currentUserId)
  );
  const eligible = (proposal.eligibleVoterIds || []).some(
    (userId) => String(userId?._id || userId) === String(currentUserId)
  );
  return {
    _id: String(proposal._id),
    proposedBy: proposal.proposedBy,
    recipient: proposal.recipientId,
    amount: proposal.amount,
    purpose: proposal.purpose,
    status: proposal.status,
    eligibleVoterCount: proposal.eligibleVoterIds.length,
    requiredYesVotes: proposal.requiredYesVotes,
    yesVotes: votes.filter((vote) => vote.choice === "approve").length,
    noVotes: votes.filter((vote) => vote.choice === "reject").length,
    currentUserVote: currentVote?.choice || null,
    canVote: proposal.status === "voting" && eligible && !currentVote,
    expiresAt: proposal.expiresAt,
    decidedAt: proposal.decidedAt,
    paidAt: proposal.paidAt,
    createdAt: proposal.createdAt,
  };
}

async function expireOpenProposal(groupId, session = null) {
  const query = CollectivePayoutProposal.findOne({ groupId, status: "voting" });
  if (session) query.session(session);
  const proposal = await query;
  if (proposal && proposal.expiresAt <= new Date()) {
    proposal.status = "expired";
    proposal.decidedAt = new Date();
    await proposal.save(session ? { session } : undefined);
    return null;
  }
  return proposal;
}

export async function getCurrentCollectiveProposal(groupId, currentUserId) {
  const proposal = await expireOpenProposal(groupId);
  if (!proposal) return null;
  await proposal.populate([
    { path: "proposedBy", select: "fullName avatarUrl" },
    { path: "recipientId", select: "fullName avatarUrl" },
  ]);
  return proposalData(proposal, currentUserId);
}

export async function listCollectiveProposals(groupId, currentUserId) {
  await expireOpenProposal(groupId);
  const proposals = await CollectivePayoutProposal.find({ groupId })
    .populate("proposedBy", "fullName avatarUrl")
    .populate("recipientId", "fullName avatarUrl")
    .sort({ createdAt: -1 })
    .limit(20);
  return proposals.map((proposal) => proposalData(proposal, currentUserId));
}

export async function createCollectivePayoutProposal(req, res) {
  const [group, manager, recipient, activeMembers] = await Promise.all([
    Group.findById(req.params.id),
    GroupMember.findOne({
      groupId: req.params.id,
      userId: req.user._id,
      status: "active",
      role: { $in: ["owner", "treasurer"] },
    }),
    GroupMember.findOne({
      groupId: req.params.id,
      userId: req.body.recipientId,
      status: "active",
    }),
    GroupMember.find({ groupId: req.params.id, status: "active" }).select("userId"),
  ]);
  if (!group || group.savingModel !== "collective_goal") {
    return res.status(404).json({ success: false, message: "Collective goal group not found" });
  }
  if (!manager) {
    return res.status(403).json({ success: false, message: "Only the owner or treasurer can propose a payout" });
  }
  if (group.status !== "active" || group.collectiveGoal?.status !== "target_reached") {
    return res.status(409).json({ success: false, message: "The shared goal must be reached before a payout can be proposed" });
  }
  const amount = req.body.amount;
  const purpose = String(req.body.purpose || "").trim();
  if (!Number.isInteger(amount) || amount < 1 || amount > group.totalPot) {
    return res.status(400).json({ success: false, message: "Enter an amount within the available group balance" });
  }
  if (!recipient) {
    return res.status(400).json({ success: false, message: "Choose an active group member to receive the payout" });
  }
  if (purpose.length < 5) {
    return res.status(400).json({ success: false, message: "Briefly explain what this payout is for" });
  }
  await expireOpenProposal(group._id);
  if (await CollectivePayoutProposal.exists({ groupId: group._id, status: "voting" })) {
    return res.status(409).json({ success: false, message: "Finish the current payout vote before creating another" });
  }

  const eligibleVoterIds = activeMembers.map((member) => member.userId);
  const proposal = await CollectivePayoutProposal.create({
    groupId: group._id,
    proposedBy: req.user._id,
    recipientId: recipient.userId,
    amount,
    purpose,
    eligibleVoterIds,
    requiredYesVotes: Math.floor(eligibleVoterIds.length / 2) + 1,
    expiresAt: new Date(Date.now() + VOTING_WINDOW_MS),
  });
  await Promise.all([
    Notification.insertMany(
      eligibleVoterIds
        .filter((userId) => String(userId) !== String(req.user._id))
        .map((userId) => ({
          userId,
          type: "resolution_created",
          title: `Payout vote in ${group.name}`,
          body: `${req.user.fullName} proposed a shared-goal payout. Cast your vote within 48 hours.`,
          relatedGroupId: group._id,
        }))
    ),
    audit({
      actorId: req.user._id,
      action: "group.collective_payout_proposed",
      targetType: "group",
      targetId: group._id,
      metadata: { proposalId: proposal._id, recipientId: recipient.userId, amount },
    }),
  ]);
  await proposal.populate([
    { path: "proposedBy", select: "fullName avatarUrl" },
    { path: "recipientId", select: "fullName avatarUrl" },
  ]);
  return res.status(201).json({ success: true, data: proposalData(proposal, req.user._id) });
}

export async function voteOnCollectivePayout(req, res) {
  if (!["approve", "reject"].includes(req.body.choice)) {
    return res.status(400).json({ success: false, message: "Choose approve or reject" });
  }
  const session = await mongoose.startSession();
  let proposal;
  let group;
  let decision = "voting";
  try {
    await session.withTransaction(async () => {
      proposal = await CollectivePayoutProposal.findOne({
        _id: req.params.proposalId,
        groupId: req.params.id,
        status: "voting",
      }).session(session);
      if (!proposal || proposal.expiresAt <= new Date()) {
        const error = new Error("This payout vote is no longer open");
        error.statusCode = 409;
        throw error;
      }
      const eligible = proposal.eligibleVoterIds.some(
        (userId) => String(userId) === String(req.user._id)
      );
      if (!eligible) {
        const error = new Error("You are not eligible to vote on this proposal");
        error.statusCode = 403;
        throw error;
      }
      if (proposal.votes.some((vote) => String(vote.userId) === String(req.user._id))) {
        const error = new Error("You have already voted on this proposal");
        error.statusCode = 409;
        throw error;
      }
      proposal.votes.push({ userId: req.user._id, choice: req.body.choice });
      const yesVotes = proposal.votes.filter((vote) => vote.choice === "approve").length;
      const noVotes = proposal.votes.filter((vote) => vote.choice === "reject").length;
      const voteDecision = collectivePayoutDecision({
        eligibleVoterCount: proposal.eligibleVoterIds.length,
        requiredYesVotes: proposal.requiredYesVotes,
        yesVotes,
        noVotes,
      });

      if (voteDecision === "approved") {
        group = await Group.findOneAndUpdate(
          {
            _id: proposal.groupId,
            savingModel: "collective_goal",
            status: "active",
            totalPot: { $gte: proposal.amount },
          },
          {
            $inc: {
              totalPot: -proposal.amount,
              "collectiveGoal.paidOutAmount": proposal.amount,
            },
          },
          { new: true, session }
        );
        if (!group) {
          const error = new Error("The group balance is no longer sufficient for this payout");
          error.statusCode = 409;
          throw error;
        }
        await User.updateOne(
          { _id: proposal.recipientId },
          { $inc: { walletBalance: proposal.amount } },
          { session }
        );
        const [walletTransaction] = await WalletTransaction.create([{
          userId: proposal.recipientId,
          type: "payout",
          amount: proposal.amount,
          status: "completed",
          reference: `ksf_collective_${crypto.randomUUID()}`,
          relatedGroupId: proposal.groupId,
          channel: "collective_goal_vote",
          completedAt: new Date(),
        }], { session });
        proposal.status = "paid";
        proposal.decidedAt = new Date();
        proposal.paidAt = proposal.decidedAt;
        proposal.walletTransactionId = walletTransaction._id;
        decision = "paid";
        if (group.totalPot === 0) {
          group.status = "completed";
          group.collectiveGoal.status = "completed";
          group.collectiveGoal.completedAt = proposal.paidAt;
          await group.save({ session });
        }
      } else if (voteDecision === "rejected") {
        proposal.status = "rejected";
        proposal.decidedAt = new Date();
        decision = "rejected";
      }
      await proposal.save({ session });
      await audit({
        actorId: req.user._id,
        action: "group.collective_payout_voted",
        targetType: "group",
        targetId: proposal.groupId,
        metadata: { proposalId: proposal._id, choice: req.body.choice, decision },
        session,
      });
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }

  if (decision !== "voting") {
    const voterIds = proposal.eligibleVoterIds;
    await Notification.insertMany(voterIds.map((userId) => ({
      userId,
      type: decision === "paid" ? "payout_completed" : "resolution_completed",
      title: decision === "paid" ? "Shared-goal payout approved" : "Payout proposal rejected",
      body: decision === "paid"
        ? "The majority approved the proposal and the recipient's KasaFund wallet was credited."
        : "The proposal did not receive enough member support.",
      relatedGroupId: proposal.groupId,
    })));
  }
  await proposal.populate([
    { path: "proposedBy", select: "fullName avatarUrl" },
    { path: "recipientId", select: "fullName avatarUrl" },
  ]);
  return res.json({
    success: true,
    message: decision === "voting" ? "Vote recorded" : decision === "paid" ? "Payout approved and completed" : "Proposal rejected",
    data: proposalData(proposal, req.user._id),
  });
}
