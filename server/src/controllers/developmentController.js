import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupResolution } from "../models/GroupResolution.js";
import {
  clearSimulatedGroupTime,
  getSimulatedGroupTime,
  nowForGroup,
  setSimulatedGroupTime,
} from "../services/developmentClockService.js";
import { processAutoContribution } from "../services/autoContributionService.js";
import { processPayout } from "../services/payoutProcessorService.js";
import { evaluatePayoutReadiness } from "../services/payoutReadinessService.js";
import { ensureNextPayout } from "../services/payoutScheduleService.js";
import { expireGroupResolutions } from "../services/resolutionExpiryService.js";

async function manageableGroup(groupId, userId) {
  const [group, membership] = await Promise.all([
    Group.findOne({ _id: groupId, status: "active" }).select("name"),
    GroupMember.findOne({
      groupId,
      userId,
      status: "active",
      role: { $in: ["owner", "treasurer"] },
    }).select("role"),
  ]);
  return group && membership ? { group, membership } : null;
}

async function simulationState(groupId) {
  const payout = await ensureNextPayout(groupId);
  if (!payout) return { simulatedNow: getSimulatedGroupTime(groupId), payout: null };
  const now = nowForGroup(groupId);
  const readiness = await evaluatePayoutReadiness(payout, { now });
  return {
    simulatedNow: getSimulatedGroupTime(groupId),
    effectiveNow: now,
    payout: {
      _id: payout._id,
      cycleNumber: payout.cycleNumber,
      scheduledDate: payout.scheduledDate,
      graceEndsAt: payout.graceEndsAt,
      status: payout.status,
      fundingStatus: readiness.status,
      expectedCount: readiness.expectedCount,
      paidCount: readiness.paidCount,
      missingCount: readiness.missingCount,
    },
  };
}

export async function getPayoutSimulation(req, res) {
  if (!(await manageableGroup(req.params.groupId, req.user._id))) {
    return res.status(403).json({
      success: false,
      message: "Owner or treasurer permission required",
    });
  }
  return res.json({ success: true, data: await simulationState(req.params.groupId) });
}

export async function setPayoutSimulationStage(req, res) {
  if (!(await manageableGroup(req.params.groupId, req.user._id))) {
    return res.status(403).json({
      success: false,
      message: "Owner or treasurer permission required",
    });
  }
  const payout = await ensureNextPayout(req.params.groupId);
  if (!payout) {
    return res.status(404).json({ success: false, message: "No scheduled payout found" });
  }
  const stage = String(req.body.stage || "");
  if (stage === "reset") {
    clearSimulatedGroupTime(req.params.groupId);
  } else if (stage === "resolution_expired") {
    const resolution = await GroupResolution.findOne({
      groupId: req.params.groupId,
      status: "voting",
    }).sort({ createdAt: -1 });
    if (!resolution) {
      return res.status(409).json({
        success: false,
        message: "Create a resolution vote before simulating its expiry",
      });
    }
    setSimulatedGroupTime(
      req.params.groupId,
      new Date(resolution.expiresAt).getTime() + 60 * 1000
    );
  } else {
    const scheduledAt = new Date(payout.scheduledDate).getTime();
    const graceEndsAt = new Date(payout.graceEndsAt).getTime();
    const stageTimes = {
      before_due: scheduledAt - 60 * 60 * 1000,
      due: scheduledAt + 60 * 1000,
      grace: scheduledAt + Math.max(60 * 1000, Math.floor((graceEndsAt - scheduledAt) / 2)),
      overdue: graceEndsAt + 60 * 1000,
    };
    if (!(stage in stageTimes)) {
      return res.status(400).json({
        success: false,
        message: "Choose before_due, due, grace, overdue, resolution_expired, or reset",
      });
    }
    setSimulatedGroupTime(req.params.groupId, stageTimes[stage]);
  }
  return res.json({
    success: true,
    message: stage === "reset" ? "Real time restored" : `Simulating ${stage.replace("_", " ")}`,
    data: await simulationState(req.params.groupId),
  });
}

export async function runPayoutSimulation(req, res) {
  if (!(await manageableGroup(req.params.groupId, req.user._id))) {
    return res.status(403).json({
      success: false,
      message: "Owner or treasurer permission required",
    });
  }
  if (req.body.confirm !== true) {
    return res.status(400).json({
      success: false,
      message: "Explicit confirmation is required before running test processors",
    });
  }
  const simulatedNow = getSimulatedGroupTime(req.params.groupId);
  if (!simulatedNow) {
    return res.status(409).json({
      success: false,
      message: "Choose a simulated payout stage first",
    });
  }
  const processor = String(req.body.processor || "all");
  if (!["auto_contributions", "payout", "all"].includes(processor)) {
    return res.status(400).json({
      success: false,
      message: "Choose auto_contributions, payout, or all",
    });
  }

  let payout = await ensureNextPayout(req.params.groupId);
  if (!payout) {
    return res.status(404).json({ success: false, message: "No scheduled payout found" });
  }
  if (!payout.snapshotLockedAt) {
    payout.snapshotLockedAt = simulatedNow;
    await payout.save();
  }

  const autoContributionResults = [];
  const expiredResolutions = await expireGroupResolutions(
    req.params.groupId,
    simulatedNow
  );
  if (processor === "auto_contributions" || processor === "all") {
    const members = await GroupMember.find({
      groupId: req.params.groupId,
      userId: { $in: payout.expectedContributorIds },
      status: "active",
      "autoContribution.enabled": true,
    }).select("_id userId");
    for (const member of members) {
      const result = await processAutoContribution(member._id, simulatedNow);
      autoContributionResults.push({ userId: member.userId, ...result });
    }
  }

  let payoutResult = null;
  if (processor === "payout" || processor === "all") {
    payoutResult = await processPayout(payout._id, {
      requireDayEnded: true,
      actorId: req.user._id,
      now: simulatedNow,
    });
  }

  return res.json({
    success: true,
    data: {
      autoContributions: autoContributionResults,
      expiredResolutions: expiredResolutions.length,
      deadlockClosed: expiredResolutions.some(
        (resolution) => (resolution.attemptNumber || 1) >= 2
      ),
      payout: payoutResult
        ? {
            processed: payoutResult.processed,
            reason: payoutResult.reason,
            missingCount: payoutResult.readiness?.missingCount || 0,
          }
        : null,
      state: await simulationState(req.params.groupId),
    },
  });
}
