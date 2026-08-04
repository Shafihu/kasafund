import mongoose from "mongoose";
import { Contribution } from "../models/Contribution.js";
import { Group } from "../models/Group.js";
import { GroupDelinquency } from "../models/GroupDelinquency.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupResolution } from "../models/GroupResolution.js";
import { Payout } from "../models/Payout.js";

function userSummary(user) {
  if (!user) return null;
  return {
    _id: String(user._id),
    fullName: user.fullName || "Member",
    avatarUrl: user.avatarUrl || "",
  };
}

export async function getGroupLedger(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid group ID" });
  }

  const [group, membership] = await Promise.all([
    Group.findById(req.params.id).select("name contribution status"),
    GroupMember.findOne({
      groupId: req.params.id,
      userId: req.user._id,
      status: "active",
    }).select("role"),
  ]);
  if (!group) {
    return res.status(404).json({ success: false, message: "Group not found" });
  }
  if (!membership) {
    return res.status(403).json({
      success: false,
      message: "Only active group members can view the financial ledger",
    });
  }

  const payouts = await Payout.find({ groupId: group._id })
    .populate("recipientId", "fullName avatarUrl")
    .populate("expectedContributorIds", "fullName avatarUrl")
    .sort({ cycleNumber: -1 })
    .limit(50);
  const payoutIds = payouts.map((payout) => payout._id);
  const cycleNumbers = payouts.map((payout) => payout.cycleNumber);

  const [contributions, delinquencies, resolutions] = await Promise.all([
    Contribution.find({
      groupId: group._id,
      cycleNumber: { $in: cycleNumbers },
      status: { $in: ["paid", "refunded"] },
    })
      .populate("userId", "fullName avatarUrl")
      .sort({ paidAt: 1 }),
    GroupDelinquency.find({
      groupId: group._id,
      payoutId: { $in: payoutIds },
    }).populate("userId", "fullName avatarUrl"),
    GroupResolution.find({
      groupId: group._id,
      payoutId: { $in: payoutIds },
    })
      .populate("createdBy", "fullName")
      .sort({ attemptNumber: -1 }),
  ]);

  const contributionsByCycle = new Map();
  for (const contribution of contributions) {
    const entries = contributionsByCycle.get(contribution.cycleNumber) || [];
    entries.push(contribution);
    contributionsByCycle.set(contribution.cycleNumber, entries);
  }
  const delinquencyByPayout = new Map();
  for (const delinquency of delinquencies) {
    const entries = delinquencyByPayout.get(String(delinquency.payoutId)) || [];
    entries.push(delinquency);
    delinquencyByPayout.set(String(delinquency.payoutId), entries);
  }
  const resolutionByPayout = new Map();
  for (const resolution of resolutions) {
    const key = String(resolution.payoutId);
    if (!resolutionByPayout.has(key)) resolutionByPayout.set(key, resolution);
  }

  const cycles = payouts.map((payout) => {
    const cycleContributions = contributionsByCycle.get(payout.cycleNumber) || [];
    const paidByUser = new Map(
      cycleContributions.map((contribution) => [
        String(contribution.userId?._id),
        contribution,
      ])
    );
    const cycleDelinquencies =
      delinquencyByPayout.get(String(payout._id)) || [];
    const delinquencyByUser = new Map(
      cycleDelinquencies.map((item) => [String(item.userId?._id), item])
    );
    const expectedMembers = (payout.expectedContributorIds || []).map((user) => {
      const contribution = paidByUser.get(String(user?._id));
      const delinquency = delinquencyByUser.get(String(user?._id));
      return {
        user: userSummary(user),
        status: contribution
          ? contribution.status === "refunded"
            ? "refunded"
            : "paid"
          : delinquency || payout.fundingStatus === "overdue"
            ? "defaulted"
            : "pending",
        amount: contribution?.amount || payout.contributionAmount || group.contribution.amount,
        paidAt: contribution?.paidAt || null,
        refundedAt: contribution?.refundedAt || null,
        paymentMethod: contribution?.paymentMethod || null,
        delinquencyStatus: delinquency?.status || null,
      };
    });
    const resolution = resolutionByPayout.get(String(payout._id));
    const collectedAmount = cycleContributions.reduce(
      (sum, contribution) => sum + contribution.amount,
      0
    );

    const scheduledAmount = payout.originalAmount || payout.amount;

    return {
      _id: String(payout._id),
      cycleNumber: payout.cycleNumber,
      rotationRound: payout.rotationRound,
      scheduledDate: payout.scheduledDate,
      graceEndsAt: payout.graceEndsAt,
      contributionAmount:
        payout.contributionAmount || group.contribution.amount,
      expectedAmount:
        (payout.contributionAmount || group.contribution.amount) *
        expectedMembers.length,
      collectedAmount,
      shortageAmount: Math.max(0, scheduledAmount - collectedAmount),
      recipient: userSummary(payout.recipientId),
      payout: {
        status: payout.status,
        fundingStatus: payout.fundingStatus,
        scheduledAmount,
        actualAmount:
          payout.closureReason === "resolution_deadlock" ? 0 : payout.amount,
        paidAt: payout.paidAt,
        closedAt: payout.closedAt,
        closureReason: payout.closureReason,
      },
      members: expectedMembers,
      resolution: resolution
        ? {
            _id: String(resolution._id),
            status: resolution.status,
            attemptNumber: resolution.attemptNumber,
            originalPayoutAmount: resolution.originalPayoutAmount,
            proposedPayoutAmount: resolution.proposedPayoutAmount,
            yesVotes: resolution.votes.filter((vote) => vote.choice === "approve").length,
            noVotes: resolution.votes.filter((vote) => vote.choice === "reject").length,
            requiredYesVotes: resolution.requiredYesVotes,
            decidedAt: resolution.decidedAt,
            createdBy: userSummary(resolution.createdBy),
          }
        : null,
    };
  });

  return res.json({
    success: true,
    data: {
      group: {
        _id: String(group._id),
        name: group.name,
        status: group.status,
        contributionAmount: group.contribution.amount,
        frequency: group.contribution.frequency,
      },
      summary: {
        totalCycles: cycles.length,
        completedCycles: cycles.filter((cycle) => cycle.payout.status === "completed").length,
        totalCollected: cycles.reduce((sum, cycle) => sum + cycle.collectedAmount, 0),
        totalPaidOut: cycles
          .filter((cycle) => cycle.payout.status === "completed")
          .reduce((sum, cycle) => sum + cycle.payout.actualAmount, 0),
      },
      cycles,
    },
  });
}
