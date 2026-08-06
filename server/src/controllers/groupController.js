import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Contribution } from "../models/Contribution.js";
import { Group } from "../models/Group.js";
import { GroupDelinquency } from "../models/GroupDelinquency.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupInvitation } from "../models/GroupInvitation.js";
import { GroupJoinRequest } from "../models/GroupJoinRequest.js";
import { GroupMessage } from "../models/GroupMessage.js";
import { GroupResolution } from "../models/GroupResolution.js";
import { Notification } from "../models/Notification.js";
import { Payout } from "../models/Payout.js";
import { User } from "../models/User.js";
import { UserBlock } from "../models/UserBlock.js";
import { getUnreadCount } from "./chatController.js";
import {
  defaultFirstPayoutDate,
  ensureNextPayout,
} from "../services/payoutScheduleService.js";
import { evaluatePayoutReadiness } from "../services/payoutReadinessService.js";
import { expireGroupResolutions } from "../services/resolutionExpiryService.js";
import { scheduledGroupContribution } from "../services/groupContributionScheduleService.js";
import {
  getSimulatedGroupTime,
  nowForGroup,
} from "../services/developmentClockService.js";
import { audit, createShortCode, isHostedImageUrl, pagination, sendPage } from "../utils/api.js";
import {
  acceptedAgreement,
  GROUP_AGREEMENT_VERSION,
} from "../services/groupAgreementService.js";
import {
  getGroupArchiveBlockers,
  groupArchiveErrorMessage,
  isEmptyScheduledPayout,
} from "../services/groupArchiveService.js";
import {
  getCurrentCollectiveProposal,
  listCollectiveProposals,
} from "./collectivePayoutController.js";

async function membership(groupId, userId) {
  return GroupMember.findOne({ groupId, userId, status: "active" });
}

async function manageableMembership(groupId, userId) {
  return GroupMember.findOne({
    groupId,
    userId,
    status: "active",
    role: { $in: ["owner", "treasurer", "moderator"] },
  });
}

async function hasActiveCycleObligation(groupId, userId) {
  return Payout.exists({
    groupId,
    status: { $in: ["scheduled", "processing"] },
    expectedContributorIds: userId,
  });
}

export async function createGroup(req, res) {
  const {
    name,
    description,
    coverImageUrl,
    type,
    contribution,
    rotation,
    savingModel = "rotational",
    collectiveGoal,
    isPublic,
    expectedMemberCount,
    creatorPayoutPosition,
  } = req.body;
  if (!name?.trim() || !type || !Number.isInteger(contribution?.amount) || contribution.amount < 1) {
    return res.status(400).json({ success: false, message: "Name, type and contribution amount in pesewas are required" });
  }
  if (!["daily", "weekly", "monthly"].includes(contribution.frequency)) {
    return res.status(400).json({ success: false, message: "Invalid contribution frequency" });
  }
  if (!["rotational", "collective_goal"].includes(savingModel)) {
    return res.status(400).json({ success: false, message: "Choose a valid saving model" });
  }
  if (
    savingModel === "collective_goal" &&
    (!Number.isInteger(collectiveGoal?.targetAmount) || collectiveGoal.targetAmount < contribution.amount)
  ) {
    return res.status(400).json({ success: false, message: "The shared goal must be at least one contribution" });
  }
  if (!Number.isInteger(expectedMemberCount) || expectedMemberCount < 2 || expectedMemberCount > 50) {
    return res.status(400).json({ success: false, message: "Expected members must be between 2 and 50" });
  }
  if (savingModel === "rotational" && (!Number.isInteger(creatorPayoutPosition) || creatorPayoutPosition < 0 || creatorPayoutPosition >= expectedMemberCount)) {
    return res.status(400).json({ success: false, message: "Choose a valid payout position for the creator" });
  }
  if (!isHostedImageUrl(coverImageUrl)) {
    return res.status(400).json({ success: false, message: "Group cover must be uploaded first" });
  }

  const createdAt = new Date();
  let agreement;
  try {
    agreement = acceptedAgreement(
      { contribution },
      req.body,
      "group_creation",
      createdAt
    );
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
  const requestedStartDate = contribution.startDate
    ? new Date(contribution.startDate)
    : null;
  const firstPayoutDate =
    requestedStartDate &&
    !Number.isNaN(requestedStartDate.getTime()) &&
    requestedStartDate > createdAt
      ? requestedStartDate
      : defaultFirstPayoutDate(contribution.frequency, createdAt);

  const session = await mongoose.startSession();
  let group;
  await session.withTransaction(async () => {
    [group] = await Group.create(
      [{
        name: name.trim(),
        description,
        coverImageUrl,
        type,
        ownerId: req.user._id,
        savingModel,
        contribution: {
          amount: contribution.amount,
          frequency: contribution.frequency,
          startDate: firstPayoutDate,
          gracePeriodDays: contribution.gracePeriodDays || 0,
          penaltyAmount: contribution.penaltyAmount || 0,
        },
        rotation: {
          isEnabled: savingModel === "rotational" && (rotation?.isEnabled ?? true),
          order: savingModel === "rotational" ? [req.user._id] : [],
          pendingOrder: [],
          completedRecipientIds: [],
          currentPositionIndex: 0,
          roundNumber: 1,
          cycleStartedAt: null,
        },
        collectiveGoal: savingModel === "collective_goal"
          ? {
              targetAmount: collectiveGoal.targetAmount,
              targetDate: collectiveGoal.targetDate || null,
              status: "saving",
            }
          : null,
        expectedMemberCount,
        status: "setup",
        inviteCode: createShortCode(),
        isPublic: Boolean(isPublic),
      }],
      { session }
    );
    await GroupMember.create(
      [{
        groupId: group._id,
        userId: req.user._id,
        role: "owner",
        payoutPosition: savingModel === "rotational" ? creatorPayoutPosition : null,
        setupPayoutPosition: savingModel === "rotational" ? creatorPayoutPosition : null,
        agreement,
      }],
      { session }
    );
    await audit({ actorId: req.user._id, action: "group.created", targetType: "group", targetId: group._id, session });
  });
  await session.endSession();
  return res.status(201).json({ success: true, data: group });
}

export async function activateGroup(req, res) {
  const owner = await GroupMember.findOne({
    groupId: req.params.id,
    userId: req.user._id,
    status: "active",
    role: "owner",
  });
  if (!owner) {
    return res.status(403).json({ success: false, message: "Only the group owner can activate the group" });
  }

  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ success: false, message: "Group not found" });
  if (group.status !== "setup") {
    return res.status(409).json({ success: false, message: "This group has already left setup" });
  }

  const activeMembers = await GroupMember.find({ groupId: group._id, status: "active" });
  if (activeMembers.length < group.expectedMemberCount) {
    return res.status(400).json({
      success: false,
      message: `Wait for at least ${group.expectedMemberCount} members to accept before activation`,
    });
  }

  const memberIds = activeMembers.map((member) => String(member.userId));
  const isRotational = group.savingModel !== "collective_goal";
  const requestedOrder = Array.isArray(req.body.order)
    ? req.body.order.map(String)
    : activeMembers
        .sort((a, b) => (a.payoutPosition ?? 0) - (b.payoutPosition ?? 0))
        .map((member) => String(member.userId));
  const uniqueOrder = new Set(requestedOrder);
  if (isRotational && (
    requestedOrder.length !== memberIds.length ||
    uniqueOrder.size !== memberIds.length ||
    memberIds.some((userId) => !uniqueOrder.has(userId))
  )) {
    return res.status(400).json({ success: false, message: "Payout order must include every accepted member exactly once" });
  }

  const activatedAt = new Date();
  const scheduledStart = defaultFirstPayoutDate(
    group.contribution.frequency,
    activatedAt
  );
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    group.status = "active";
    group.contribution.startDate = scheduledStart;
    group.rotation.isEnabled = isRotational;
    group.rotation.order = isRotational ? requestedOrder : [];
    group.rotation.pendingOrder = [];
    group.rotation.completedRecipientIds = [];
    group.rotation.currentPositionIndex = 0;
    group.rotation.roundNumber = 1;
    group.rotation.cycleStartedAt = activatedAt;
    await group.save({ session });
    if (isRotational) await GroupMember.bulkWrite(
      requestedOrder.map((userId, payoutPosition) => ({
        updateOne: {
          filter: { groupId: group._id, userId, status: "active" },
          update: { payoutPosition },
        },
      })),
      { session }
    );
    if (isRotational) await ensureNextPayout(group._id, { session });
    await audit({
      actorId: req.user._id,
      action: "group.activated",
      targetType: "group",
      targetId: group._id,
      metadata: { memberCount: activeMembers.length, firstContributionDate: scheduledStart, savingModel: group.savingModel },
      session,
    });
  });
  await session.endSession();

  const otherMemberIds = memberIds.filter((userId) => userId !== String(req.user._id));
  if (otherMemberIds.length) {
    await Notification.insertMany(otherMemberIds.map((userId) => ({
      userId,
      type: isRotational ? "payout_scheduled" : "savings_update",
      title: `${group.name} is now active`,
      body: isRotational
        ? `The owner confirmed the payout order. The first payout is scheduled for ${scheduledStart.toLocaleDateString("en-GH")}.`
        : `Shared-goal contributions begin on ${scheduledStart.toLocaleDateString("en-GH")}. Payouts require a member vote after the target is reached.`,
      relatedGroupId: group._id,
    })));
  }

  return res.json({ success: true, data: group, message: "Group activated" });
}

export async function listMyGroups(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const memberships = await GroupMember.find({ userId: req.user._id, status: "active" }).select("groupId chatLastReadAt joinedAt");
  const groupIds = memberships.map((item) => item.groupId);
  const filter = { _id: { $in: groupIds }, status: { $ne: "archived" } };
  const [groups, total] = await Promise.all([
    Group.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Group.countDocuments(filter),
  ]);
  const membershipByGroup = new Map(memberships.map((item) => [String(item.groupId), item]));
  const data = await Promise.all(groups.map(async (group) => {
    const member = membershipByGroup.get(String(group._id));
    const unreadChatCount = await GroupMessage.countDocuments({
      groupId: group._id,
      senderId: { $ne: req.user._id },
      createdAt: { $gt: member?.chatLastReadAt || member?.joinedAt || new Date(0) },
    });
    return { ...group.toObject(), unreadChatCount };
  }));
  return sendPage(res, data, page, limit, total);
}

export async function discoverGroups(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const memberships = await GroupMember.find({
    userId: req.user._id,
    status: { $in: ["active", "suspended"] },
  }).distinct("groupId");
  const filter = { _id: { $nin: memberships }, isPublic: true, status: "active" };
  const [groups, total, joinRequests] = await Promise.all([
    Group.find(filter)
      .select("-inviteCode -rotation.order")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Group.countDocuments(filter),
    GroupJoinRequest.find({
      userId: req.user._id,
      status: { $in: ["pending", "declined"] },
    }).select("groupId status agreement.version"),
  ]);
  const requestStatusByGroup = new Map(
    joinRequests.map((request) => [
      String(request.groupId),
      request.status === "pending" && !request.agreement?.version
        ? "agreement_required"
        : request.status,
    ])
  );
  return sendPage(
    res,
    groups.map((group) => ({
      ...group.toObject(),
      joinRequestStatus: requestStatusByGroup.get(String(group._id)) || null,
    })),
    page,
    limit,
    total
  );
}

export async function listInvitations(req, res) {
  const invitations = await GroupInvitation.find({
    invitedUserId: req.user._id,
    status: "pending",
    expiresAt: { $gt: new Date() },
  })
    .populate("groupId", "name type memberCount contribution")
    .populate("invitedBy", "fullName avatarUrl")
    .sort({ createdAt: -1 });
  return res.json({ success: true, data: invitations.filter((item) => item.groupId) });
}

async function addUserToGroup(
  group,
  user,
  actorId,
  requestedPosition = null,
  agreement
) {
  const session = await mongoose.startSession();
  let joined = false;
  await session.withTransaction(async () => {
    const existing = await GroupMember.findOne({ groupId: group._id, userId: user._id }).session(session);
    if (existing?.status === "active") return;
    if (existing?.status === "suspended" || existing?.rejoinBlocked) {
      const error = new Error(
        "This membership was suspended for contribution default and cannot rejoin the group"
      );
      error.code = "GROUP_REJOIN_BLOCKED";
      throw error;
    }
    let member;
    if (existing) {
      existing.status = "active";
      existing.role = "member";
      existing.joinedAt = new Date();
      existing.suspendedAt = null;
      existing.suspensionReason = "";
      existing.rejoinBlocked = false;
      existing.agreement = agreement;
      member = existing;
    } else {
      [member] = await GroupMember.create(
        [{ groupId: group._id, userId: user._id, agreement }],
        { session }
      );
    }
    const groupDocument = await Group.findById(group._id).session(session);
    if (groupDocument.savingModel === "collective_goal") {
      member.setupPayoutPosition = null;
      member.payoutPosition = null;
      await member.save({ session });
      groupDocument.memberCount = await GroupMember.countDocuments({
        groupId: group._id,
        status: "active",
      }).session(session);
      await groupDocument.save({ session });
      joined = true;
      await audit({
        actorId,
        action: "group.joined",
        targetType: "group",
        targetId: group._id,
        metadata: {
          savingModel: groupDocument.savingModel,
          agreementVersion: agreement.version,
          agreementAcceptedAt: agreement.acceptedAt,
          agreementSource: agreement.source,
        },
        session,
      });
      return;
    }
    if (groupDocument.status === "setup") {
      member.setupPayoutPosition = Number.isInteger(requestedPosition)
        ? requestedPosition
        : groupDocument.expectedMemberCount - 1;
      member.payoutPosition = member.setupPayoutPosition;
      await member.save({ session });
      const setupMembers = await GroupMember.find({
        groupId: group._id,
        status: "active",
      })
        .sort({ setupPayoutPosition: 1, joinedAt: 1 })
        .session(session);
      const order = setupMembers.map((setupMember) => setupMember.userId);
      groupDocument.rotation.order = order;
      groupDocument.memberCount = setupMembers.length;
      await groupDocument.save({ session });
      await GroupMember.bulkWrite(
        order.map((userId, payoutPosition) => ({
          updateOne: {
            filter: { groupId: group._id, userId, status: "active" },
            update: { payoutPosition },
          },
        })),
        { session }
      );
      joined = true;
      await audit({
        actorId,
        action: "group.joined",
        targetType: "group",
        targetId: group._id,
        metadata: {
          agreementVersion: agreement.version,
          agreementAcceptedAt: agreement.acceptedAt,
          agreementSource: agreement.source,
        },
        session,
      });
      return;
    }
    const currentOrder = groupDocument.rotation.order.filter(
      (userId) => String(userId) !== String(user._id)
    );
    const roundHasStarted =
      (groupDocument.rotation.completedRecipientIds || []).length > 0 ||
      (groupDocument.rotation.currentPositionIndex || 0) > 0;
    const order = (roundHasStarted && groupDocument.rotation.pendingOrder?.length
      ? groupDocument.rotation.pendingOrder
      : currentOrder
    ).filter((userId) => String(userId) !== String(user._id));
    const position = Number.isInteger(requestedPosition)
      ? Math.min(Math.max(requestedPosition, 0), order.length)
      : order.length;
    order.splice(position, 0, user._id);
    if (roundHasStarted) groupDocument.rotation.pendingOrder = order;
    else groupDocument.rotation.order = order;
    groupDocument.memberCount += 1;
    member.payoutPosition = roundHasStarted ? currentOrder.length + position : position;
    await Promise.all([groupDocument.save({ session }), member.save({ session })]);
    if (!roundHasStarted) {
      await GroupMember.bulkWrite(
        order.map((userId, payoutPosition) => ({
          updateOne: {
            filter: { groupId: group._id, userId, status: "active" },
            update: { payoutPosition },
          },
        })),
        { session }
      );
    }
    await ensureNextPayout(group._id, { session });
    joined = true;
    await audit({
      actorId,
      action: "group.joined",
      targetType: "group",
      targetId: group._id,
      metadata: {
        agreementVersion: agreement.version,
        agreementAcceptedAt: agreement.acceptedAt,
        agreementSource: agreement.source,
      },
      session,
    });
  });
  await session.endSession();
  return joined;
}

export async function joinPublicGroup(req, res) {
  const group = await Group.findOne({ _id: req.params.id, isPublic: true, status: "active" });
  if (!group) return res.status(404).json({ success: false, message: "Public group not found" });
  const existingMembership = await GroupMember.findOne({
    groupId: group._id,
    userId: req.user._id,
  }).select("status rejoinBlocked");
  if (existingMembership?.status === "active") {
    return res.json({ success: true, data: existingMembership, message: "Already a member" });
  }
  if (existingMembership?.status === "suspended" || existingMembership?.rejoinBlocked) {
    return res.status(403).json({
      success: false,
      code: "GROUP_REJOIN_BLOCKED",
      message: "You were suspended from this group and cannot request to rejoin",
    });
  }
  if (await UserBlock.exists({
    $or: [
      { blockerId: group.ownerId, blockedUserId: req.user._id },
      { blockerId: req.user._id, blockedUserId: group.ownerId },
    ],
  })) {
    return res.status(403).json({
      success: false,
      message: "You cannot request membership in this group",
    });
  }

  let agreement;
  try {
    agreement = acceptedAgreement(group, req.body, "public_request");
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
  const existingRequest = await GroupJoinRequest.findOne({
    groupId: group._id,
    userId: req.user._id,
  });
  if (existingRequest?.status === "pending") {
    existingRequest.agreement = agreement;
    await existingRequest.save();
    return res.json({
      success: true,
      data: existingRequest,
      message: "Your membership request is already awaiting review",
    });
  }
  if (existingRequest?.status === "declined") {
    return res.status(409).json({
      success: false,
      code: "GROUP_JOIN_REQUEST_DECLINED",
      message: "The group owner declined your membership request",
    });
  }

  const request = await GroupJoinRequest.create({
    groupId: group._id,
    userId: req.user._id,
    agreement,
  });
  await Notification.create({
    userId: group.ownerId,
    type: "join_request",
    title: "New membership request",
    body: `${req.user.fullName} requested to join ${group.name}. Review their trust profile before deciding.`,
    relatedGroupId: group._id,
    relatedUserId: req.user._id,
  });
  await audit({
    actorId: req.user._id,
    action: "group.join_requested",
    targetType: "group",
    targetId: group._id,
    metadata: { joinRequestId: request._id },
  });
  return res.status(202).json({
    success: true,
    data: request,
    message: "Membership request sent to the group owner",
  });
}

async function ownerMembership(groupId, userId) {
  return GroupMember.exists({
    groupId,
    userId,
    status: "active",
    role: "owner",
  });
}

export async function getJoinRequest(req, res) {
  if (!(await ownerMembership(req.params.id, req.user._id))) {
    return res.status(403).json({
      success: false,
      message: "Only the group owner can review membership requests",
    });
  }
  const request = await GroupJoinRequest.findOne({
    groupId: req.params.id,
    userId: req.params.userId,
  })
    .populate("groupId", "name")
    .populate("userId", "fullName avatarUrl");
  if (!request) {
    return res.status(404).json({ success: false, message: "Membership request not found" });
  }
  return res.json({ success: true, data: request });
}

export async function respondToJoinRequest(req, res) {
  if (!(await ownerMembership(req.params.id, req.user._id))) {
    return res.status(403).json({
      success: false,
      message: "Only the group owner can review membership requests",
    });
  }
  if (typeof req.body.accept !== "boolean") {
    return res.status(400).json({ success: false, message: "Choose accept or decline" });
  }
  const request = await GroupJoinRequest.findOne({
    groupId: req.params.id,
    userId: req.params.userId,
    status: "pending",
  }).populate("userId");
  if (!request) {
    return res.status(404).json({
      success: false,
      message: "Pending membership request not found",
    });
  }
  const group = await Group.findOne({ _id: req.params.id, status: "active" });
  if (!group) {
    return res.status(404).json({ success: false, message: "Group is no longer available" });
  }

  if (req.body.accept) {
    if (!request.agreement?.version || !request.agreement?.acceptedAt) {
      return res.status(409).json({
        success: false,
        code: "GROUP_AGREEMENT_REQUIRED",
        message:
          "The applicant must accept the digital group agreement before approval",
      });
    }
    const outstandingDebt = await GroupDelinquency.findOne({
      userId: request.userId._id,
      status: "open",
    }).select("groupId amountDue");
    if (outstandingDebt) {
      return res.status(409).json({
        success: false,
        code: "GROUP_CONTRIBUTION_OVERDUE",
        message: "This applicant must resolve their overdue group contribution before joining",
      });
    }
    try {
      await addUserToGroup(
        group,
        request.userId,
        req.user._id,
        null,
        request.agreement.toObject()
      );
    } catch (error) {
      if (error?.code === "GROUP_REJOIN_BLOCKED") {
        return res.status(403).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }
  }
  request.status = req.body.accept ? "accepted" : "declined";
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  await request.save();
  await Notification.create({
    userId: request.userId._id,
    type: "join_request",
    title: req.body.accept ? "Membership request accepted" : "Membership request declined",
    body: req.body.accept
      ? `You are now a member of ${group.name}.`
      : `${group.name} declined your membership request.`,
    relatedGroupId: group._id,
  });
  await audit({
    actorId: req.user._id,
    action: req.body.accept ? "group.join_request_accepted" : "group.join_request_declined",
    targetType: "group",
    targetId: group._id,
    metadata: { userId: request.userId._id, joinRequestId: request._id },
  });
  return res.json({
    success: true,
    data: request,
    message: req.body.accept ? "Member accepted" : "Membership request declined",
  });
}

export async function getGroup(req, res) {
  let group = await Group.findById(req.params.id).populate("ownerId", "fullName avatarUrl");
  if (!group) return res.status(404).json({ success: false, message: "Group not found" });
  const membershipRecord = await GroupMember.findOne({
    groupId: group._id,
    userId: req.user._id,
  });
  if (membershipRecord?.status === "suspended" || membershipRecord?.rejoinBlocked) {
    return res.status(403).json({
      success: false,
      code: "GROUP_ACCESS_SUSPENDED",
      message: "Your membership was suspended and you can no longer access this group",
    });
  }
  const member = membershipRecord?.status === "active" ? membershipRecord : null;
  if (!group.isPublic && !member) return res.status(403).json({ success: false, message: "Group access denied" });

  const currentPayout = group.savingModel === "collective_goal"
    ? null
    : await ensureNextPayout(group._id);
  const groupNow = nowForGroup(group._id);
  const readiness = currentPayout
    ? await evaluatePayoutReadiness(currentPayout, { now: groupNow })
    : null;
  group = await Group.findById(req.params.id).populate("ownerId", "fullName avatarUrl");

  const [members, contributions, payouts, paidCurrentCycleUserIds] = await Promise.all([
    GroupMember.find({ groupId: group._id, status: "active" })
      .populate("userId", "fullName avatarUrl")
      .sort({ payoutPosition: 1 }),
    Contribution.find({ groupId: group._id, status: "paid" })
      .populate("userId", "fullName avatarUrl")
      .sort({ createdAt: -1 })
      .limit(20),
    Payout.find({ groupId: group._id }).populate("recipientId", "fullName avatarUrl").sort({ scheduledDate: 1 }).limit(20),
    currentPayout
      ? Contribution.distinct("userId", {
          groupId: group._id,
          cycleNumber: currentPayout.cycleNumber,
          status: "paid",
        })
      : [],
  ]);
  const paidUserIds = new Set(paidCurrentCycleUserIds.map(String));
  const expectedUserIds = new Set(
    (currentPayout?.expectedContributorIds || []).map(String)
  );
  const graceDeadline = readiness?.graceEndsAt?.getTime() || null;
  const unpaidStatus = graceDeadline !== null && groupNow.getTime() > graceDeadline
    ? "late"
    : "pending";
  const currentMembers = members.map((groupMember) => {
    const serialized = groupMember.toObject();
    if (currentPayout) {
      const userId = String(groupMember.userId?._id);
      serialized.lastContributionStatus = paidUserIds.has(userId)
        ? "paid"
        : expectedUserIds.has(userId)
          ? unpaidStatus
          : "pending";
    }
    return serialized;
  });
  const memberNames = new Map(
    currentMembers.map((groupMember) => [
      String(groupMember.userId?._id),
      groupMember.userId?.fullName || "Member",
    ])
  );
  const currentPayoutReadiness = readiness
    ? {
        payoutId: String(currentPayout._id),
        status: readiness.status,
        expectedCount: readiness.expectedCount,
        paidCount: readiness.paidCount,
        missingCount: readiness.missingCount,
        contributionAmount:
          currentPayout.contributionAmount || group.contribution.amount,
        extensionAvailable: (currentPayout.graceExtensionCount || 0) < 1,
        graceEndsAt: readiness.graceEndsAt,
        missingMembers: readiness.missingContributorIds.map((userId) => ({
          userId: String(userId),
          fullName: memberNames.get(String(userId)) || "Member",
        })),
      }
    : null;
  await expireGroupResolutions(group._id, groupNow);
  const resolution = await GroupResolution.findOne({
    groupId: group._id,
    status: "voting",
  }).sort({ createdAt: -1 });
  const currentResolution = resolution && member
    ? {
        _id: String(resolution._id),
        status: resolution.status,
        recipientId: String(resolution.recipientId),
        defaultingMembers: resolution.defaultingUserIds.map((userId) => ({
          userId: String(userId),
          fullName: memberNames.get(String(userId)) || "Member",
        })),
        eligibleVoterCount: resolution.eligibleVoterIds.length,
        requiredYesVotes: resolution.requiredYesVotes,
        yesVotes: resolution.votes.filter((vote) => vote.choice === "approve").length,
        noVotes: resolution.votes.filter((vote) => vote.choice === "reject").length,
        currentUserVote:
          resolution.votes.find(
            (vote) => String(vote.userId) === String(req.user._id)
          )?.choice || null,
        canVote:
          resolution.eligibleVoterIds.some(
            (userId) => String(userId) === String(req.user._id)
          ) &&
          !resolution.votes.some(
            (vote) => String(vote.userId) === String(req.user._id)
          ),
        recipientApprovalRequired: true,
        originalPayoutAmount: resolution.originalPayoutAmount,
        proposedPayoutAmount: resolution.proposedPayoutAmount,
        expiresAt: resolution.expiresAt,
        attemptNumber: resolution.attemptNumber || 1,
      }
    : null;
  const [unreadChatCount, currentCollectiveProposal, collectivePayoutProposals] = await Promise.all([
    getUnreadCount(group._id, member),
    group.savingModel === "collective_goal" && member
      ? getCurrentCollectiveProposal(group._id, req.user._id)
      : null,
    group.savingModel === "collective_goal" && member
      ? listCollectiveProposals(group._id, req.user._id)
      : [],
  ]);
  return res.json({
    success: true,
    data: {
      group,
      membership: member,
      members: currentMembers,
      contributions,
      payouts,
      currentPayoutReadiness,
      currentResolution,
      currentCollectiveProposal,
      collectivePayoutProposals,
      developmentSimulation: env.developmentToolsEnabled
        ? {
            enabled: true,
            simulatedNow: getSimulatedGroupTime(group._id),
          }
        : null,
      unreadChatCount,
    },
  });
}

export async function getGroupAccess(req, res) {
  const [group, member] = await Promise.all([
    Group.findById(req.params.id).select("isPublic status"),
    GroupMember.findOne({
      groupId: req.params.id,
      userId: req.user._id,
    }).select("status rejoinBlocked suspensionReason"),
  ]);
  if (!group || group.status === "archived") {
    return res.json({
      success: true,
      data: { canView: false, reason: "unavailable", membershipStatus: null },
    });
  }
  if (member?.status === "suspended" || member?.rejoinBlocked) {
    return res.json({
      success: true,
      data: {
        canView: false,
        reason: "suspended",
        membershipStatus: member.status,
      },
    });
  }
  const canView = member?.status === "active" || group.isPublic;
  return res.json({
    success: true,
    data: {
      canView,
      reason: canView ? null : "not_a_member",
      membershipStatus: member?.status || null,
    },
  });
}

export async function updateAutoContribution(req, res) {
  const member = await membership(req.params.id, req.user._id);
  if (!member) {
    return res.status(404).json({ success: false, message: "Active membership required" });
  }

  const enabled = req.body.enabled;
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ success: false, message: "Enabled must be true or false" });
  }

  let nextRunAt = null;
  if (enabled) {
    const group = await Group.findOne({ _id: req.params.id, status: "active" });
    if (!group) {
      return res.status(404).json({ success: false, message: "Active group not found" });
    }
    const payout = group.savingModel === "collective_goal"
      ? null
      : await ensureNextPayout(group._id);
    nextRunAt = payout?.scheduledDate || (
      group.savingModel === "collective_goal"
        ? scheduledGroupContribution(group.contribution, nowForGroup(group._id)).dueDate
        : null
    );
  }

  member.autoContribution.enabled = enabled;
  member.autoContribution.paymentSource = "wallet";
  member.autoContribution.enabledAt = enabled ? new Date() : null;
  member.autoContribution.nextRunAt = nextRunAt;
  member.autoContribution.reminderCycleNumber = null;
  member.autoContribution.lastAttemptAt = null;
  member.autoContribution.lastAttemptCycleNumber = null;
  member.autoContribution.lastStatus = "never";
  member.autoContribution.failureReason = "";
  await member.save();

  await audit({
    actorId: req.user._id,
    action: enabled
      ? "group.auto_contribution_enabled"
      : "group.auto_contribution_disabled",
    targetType: "group",
    targetId: req.params.id,
    metadata: { paymentSource: "wallet" },
  });

  return res.json({
    success: true,
    message: enabled ? "Auto-contribution enabled" : "Auto-contribution disabled",
    data: member.autoContribution,
  });
}

export async function updateGroup(req, res) {
  const member = await membership(req.params.id, req.user._id);
  if (!member || !["owner", "treasurer"].includes(member.role)) {
    return res.status(403).json({ success: false, message: "Owner or treasurer permission required" });
  }
  const currentGroup = await Group.findById(req.params.id).select("status totalPot");
  if (!currentGroup) return res.status(404).json({ success: false, message: "Group not found" });
  if (
    req.body.status === "setup" ||
    (currentGroup.status === "setup" && req.body.status === "active")
  ) {
    return res.status(400).json({
      success: false,
      message: "Complete roster validation through group activation",
    });
  }
  let emptyScheduledPayoutIds = [];
  if (req.body.status === "archived" && currentGroup.status !== "archived") {
    if (member.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only the group owner can archive this group",
      });
    }
    const [openPayouts, openDelinquencyCount, openResolutionCount] =
      await Promise.all([
        Payout.find({
          groupId: currentGroup._id,
          status: { $in: ["scheduled", "processing"] },
        }).select("status cycleNumber snapshotLockedAt"),
        GroupDelinquency.countDocuments({
          groupId: currentGroup._id,
          status: { $in: ["open", "extended"] },
        }),
        GroupResolution.countDocuments({
          groupId: currentGroup._id,
          status: { $in: ["voting", "approved"] },
        }),
      ]);
    const scheduledPayouts = openPayouts.filter(
      (payout) => payout.status === "scheduled"
    );
    const contributionStartedByCycle = await Promise.all(
      scheduledPayouts.map(async (payout) => ({
        payout,
        started: Boolean(
          await Contribution.exists({
            groupId: currentGroup._id,
            cycleNumber: payout.cycleNumber,
            status: { $in: ["pending", "paid", "late"] },
          })
        ),
      }))
    );
    emptyScheduledPayoutIds = contributionStartedByCycle
      .filter(({ payout, started }) =>
        isEmptyScheduledPayout({
          status: payout.status,
          snapshotLockedAt: payout.snapshotLockedAt,
          contributionStarted: started,
        })
      )
      .map(({ payout }) => payout._id);
    const openPayoutCount =
      openPayouts.filter((payout) => payout.status === "processing").length +
      contributionStartedByCycle.filter(
        ({ payout, started }) =>
          !isEmptyScheduledPayout({
            status: payout.status,
            snapshotLockedAt: payout.snapshotLockedAt,
            contributionStarted: started,
          })
      ).length;
    const blockers = getGroupArchiveBlockers({
      status: currentGroup.status,
      totalPot: currentGroup.totalPot,
      openPayoutCount,
      openDelinquencyCount,
      openResolutionCount,
    });
    if (blockers.length) {
      return res.status(409).json({
        success: false,
        code: "GROUP_ARCHIVE_BLOCKED",
        message: groupArchiveErrorMessage(blockers),
        data: { blockers },
      });
    }
  }
  const updates = {};
  if (member.role === "owner") {
    for (const key of ["name", "description", "coverImageUrl", "isPublic", "status"]) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
  }
  if (req.body.expectedMemberCount !== undefined) {
    if (member.role !== "owner" || currentGroup.status !== "setup") {
      return res.status(403).json({ success: false, message: "Group size can only be changed by the owner during setup" });
    }
    const activeMemberCount = await GroupMember.countDocuments({ groupId: req.params.id, status: "active" });
    if (
      !Number.isInteger(req.body.expectedMemberCount) ||
      req.body.expectedMemberCount < Math.max(2, activeMemberCount) ||
      req.body.expectedMemberCount > 50
    ) {
      return res.status(400).json({ success: false, message: `Expected members must be between ${Math.max(2, activeMemberCount)} and 50` });
    }
    updates.expectedMemberCount = req.body.expectedMemberCount;
  }
  if (updates.coverImageUrl !== undefined && !isHostedImageUrl(updates.coverImageUrl)) {
    return res.status(400).json({ success: false, message: "Group cover must be uploaded first" });
  }
  if (req.body.contribution !== undefined) {
    const contribution = req.body.contribution;
    if (!Number.isInteger(contribution.amount) || contribution.amount < 1) {
      return res.status(400).json({ success: false, message: "Contribution amount must be a positive integer in pesewas" });
    }
    if (!["daily", "weekly", "monthly"].includes(contribution.frequency)) {
      return res.status(400).json({ success: false, message: "Invalid contribution frequency" });
    }
    const gracePeriodDays = Number(contribution.gracePeriodDays || 0);
    const penaltyAmount = Number(contribution.penaltyAmount || 0);
    if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0 || !Number.isInteger(penaltyAmount) || penaltyAmount < 0) {
      return res.status(400).json({ success: false, message: "Grace period and penalty must be non-negative integers" });
    }
    updates["contribution.amount"] = contribution.amount;
    updates["contribution.frequency"] = contribution.frequency;
    updates["contribution.gracePeriodDays"] = gracePeriodDays;
    updates["contribution.penaltyAmount"] = penaltyAmount;
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ success: false, message: "No permitted group changes supplied" });
  }
  const group = await Group.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!group) return res.status(404).json({ success: false, message: "Group not found" });
  if (group.status === "archived" && emptyScheduledPayoutIds.length) {
    await Payout.deleteMany({
      _id: { $in: emptyScheduledPayoutIds },
      groupId: group._id,
      status: "scheduled",
      snapshotLockedAt: null,
    });
  }
  await ensureNextPayout(group._id);
  await audit({ actorId: req.user._id, action: "group.updated", targetType: "group", targetId: group._id, metadata: { fields: Object.keys(updates) } });
  return res.json({ success: true, data: group });
}

export async function joinGroup(req, res) {
  const group = await Group.findOne({ inviteCode: req.body.inviteCode?.trim().toUpperCase(), status: "active" });
  if (!group) return res.status(404).json({ success: false, message: "Invalid group invitation code" });
  let agreement;
  try {
    agreement = acceptedAgreement(group, req.body, "invite_code");
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
  let joined;
  try {
    joined = await addUserToGroup(group, req.user, req.user._id, null, agreement);
  } catch (error) {
    if (error?.code === "GROUP_REJOIN_BLOCKED") {
      return res.status(403).json({ success: false, code: error.code, message: error.message });
    }
    throw error;
  }
  return res.status(joined ? 201 : 200).json({ success: true, data: group, message: joined ? "Joined group" : "Already a member" });
}

export async function reorderRotation(req, res) {
  const member = await manageableMembership(req.params.id, req.user._id);
  if (!member || !["owner", "treasurer"].includes(member.role)) {
    return res.status(403).json({ success: false, message: "Owner or treasurer permission required" });
  }
  const order = req.body.order;
  if (
    !Array.isArray(order) ||
    !order.length ||
    order.some((id) => !mongoose.isValidObjectId(id)) ||
    new Set(order.map(String)).size !== order.length
  ) {
    return res.status(400).json({ success: false, message: "A valid rotation order is required" });
  }
  const [activeCount, totalActive] = await Promise.all([
    GroupMember.countDocuments({ groupId: req.params.id, userId: { $in: order }, status: "active" }),
    GroupMember.countDocuments({ groupId: req.params.id, status: "active" }),
  ]);
  if (activeCount !== order.length || activeCount !== totalActive) return res.status(400).json({ success: false, message: "Rotation must contain every active member exactly once" });

  if (await Payout.exists({ groupId: req.params.id, status: "processing" })) {
    return res.status(409).json({
      success: false,
      message: "A payout is currently processing. Try changing the rotation again shortly.",
    });
  }

  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ success: false, message: "Group not found" });
  if (group.savingModel === "collective_goal") {
    return res.status(409).json({ success: false, message: "Collective-goal groups do not use a payout rotation" });
  }
  const roundHasStarted =
    (group.rotation.completedRecipientIds || []).length > 0 ||
    (group.rotation.currentPositionIndex || 0) > 0;

  if (roundHasStarted) {
    group.rotation.pendingOrder = order;
  } else {
    group.rotation.order = order;
    group.rotation.pendingOrder = [];
    group.rotation.currentPositionIndex = 0;
    await GroupMember.bulkWrite(order.map((userId, payoutPosition) => ({
      updateOne: {
        filter: { groupId: req.params.id, userId },
        update: { $set: { payoutPosition } },
      },
    })));
  }
  await group.save();
  await ensureNextPayout(group._id);
  await audit({
    actorId: req.user._id,
    action: roundHasStarted ? "group.rotation_queued" : "group.rotation_reordered",
    targetType: "group",
    targetId: req.params.id,
    metadata: {
      appliesFromRound: roundHasStarted ? (group.rotation.roundNumber || 1) + 1 : group.rotation.roundNumber || 1,
    },
  });
  return res.json({
    success: true,
    data: group,
    message: roundHasStarted
      ? `Rotation saved for round ${(group.rotation.roundNumber || 1) + 1}`
      : "Rotation updated for the current round",
  });
}

export async function leaveGroup(req, res) {
  const member = await membership(req.params.id, req.user._id);
  if (!member) return res.status(404).json({ success: false, message: "Active membership not found" });
  if (member.role === "owner") return res.status(400).json({ success: false, message: "Transfer ownership before leaving the group" });
  if (await GroupDelinquency.exists({
    groupId: req.params.id,
    userId: req.user._id,
    status: "open",
  })) {
    return res.status(409).json({
      success: false,
      code: "GROUP_CONTRIBUTION_OVERDUE",
      message: "Pay the overdue contribution before leaving this group",
    });
  }
  if (await hasActiveCycleObligation(req.params.id, req.user._id)) {
    return res.status(409).json({
      success: false,
      code: "ACTIVE_GROUP_CYCLE",
      message: "You cannot leave while the current contribution cycle is active",
    });
  }
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    await GroupMember.updateOne({ _id: member._id }, { status: "left" }, { session });
    await Group.updateOne(
      { _id: req.params.id },
      {
        $inc: { memberCount: -1 },
        $pull: {
          "rotation.order": req.user._id,
          "rotation.pendingOrder": req.user._id,
        },
      },
      { session }
    );
    await ensureNextPayout(req.params.id, { session });
    await audit({ actorId: req.user._id, action: "group.left", targetType: "group", targetId: req.params.id, session });
  });
  await session.endSession();
  return res.status(204).send();
}

export async function removeMember(req, res) {
  const manager = await manageableMembership(req.params.id, req.user._id);
  if (!manager) return res.status(403).json({ success: false, message: "Group management permission required" });
  const target = await membership(req.params.id, req.params.userId);
  if (!target) return res.status(404).json({ success: false, message: "Member not found" });
  if (target.role === "owner") return res.status(400).json({ success: false, message: "The group owner cannot be removed" });
  if (await GroupDelinquency.exists({
    groupId: req.params.id,
    userId: target.userId,
    status: "open",
  })) {
    return res.status(409).json({
      success: false,
      code: "GROUP_CONTRIBUTION_OVERDUE",
      message: "This member has an overdue contribution that must be resolved first",
    });
  }
  if (await hasActiveCycleObligation(req.params.id, target.userId)) {
    return res.status(409).json({
      success: false,
      code: "ACTIVE_GROUP_CYCLE",
      message: "This member cannot be removed while the current contribution cycle is active",
    });
  }
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    await GroupMember.updateOne({ _id: target._id }, { status: "removed" }, { session });
    await Group.updateOne(
      { _id: req.params.id },
      {
        $inc: { memberCount: -1 },
        $pull: {
          "rotation.order": target.userId,
          "rotation.pendingOrder": target.userId,
        },
      },
      { session }
    );
    await ensureNextPayout(req.params.id, { session });
    await audit({ actorId: req.user._id, action: "group.member_removed", targetType: "group", targetId: req.params.id, metadata: { userId: target.userId }, session });
  });
  await session.endSession();
  return res.status(204).send();
}

export async function updateMemberRole(req, res) {
  const owner = await GroupMember.findOne({
    groupId: req.params.id,
    userId: req.user._id,
    status: "active",
    role: "owner",
  });
  if (!owner) return res.status(403).json({ success: false, message: "Only the group owner can change member roles" });
  if (!["treasurer", "moderator", "member"].includes(req.body.role)) {
    return res.status(400).json({ success: false, message: "Invalid member role" });
  }
  const member = await GroupMember.findOne({
    groupId: req.params.id,
    userId: req.params.userId,
    status: "active",
    role: { $ne: "owner" },
  });
  if (!member) return res.status(404).json({ success: false, message: "Member not found" });
  const group = await Group.findById(req.params.id).select("name status expectedMemberCount");
  if (!group) return res.status(404).json({ success: false, message: "Group not found" });
  member.role = req.body.role;
  await member.save();
  const roleLabel = req.body.role === "treasurer"
    ? "Treasurer"
    : req.body.role === "moderator"
      ? "Moderator"
      : "Member";
  await Notification.create({
    userId: member.userId,
    type: "role_changed",
    title: "Your group role changed",
    body: `Your role in ${group.name} was changed to ${roleLabel}.`,
    relatedGroupId: group._id,
  });
  await audit({
    actorId: req.user._id,
    action: "group.member_role_updated",
    targetType: "group",
    targetId: req.params.id,
    metadata: { userId: req.params.userId, role: req.body.role },
  });
  return res.json({ success: true, data: member });
}

export async function inviteMember(req, res) {
  const manager = await manageableMembership(req.params.id, req.user._id);
  if (!manager || !["owner", "treasurer"].includes(manager.role)) {
    return res.status(403).json({ success: false, message: "Owner or treasurer permission required" });
  }
  const group = await Group.findById(req.params.id).select("name status savingModel");
  if (!group) return res.status(404).json({ success: false, message: "Group not found" });
  const { email, phone, userId, payoutPosition } = req.body;
  if (!email && !phone && !userId) return res.status(400).json({ success: false, message: "A user, email, or phone is required" });
  const userLookup = [
    ...(email ? [{ email: email.toLowerCase() }] : []),
    ...(phone ? [{ phone }] : []),
  ];
  const invitedUser = userId
    ? await User.findOne({ _id: userId, isActive: true })
    : userLookup.length
      ? await User.findOne({ $or: userLookup })
      : null;
  if (userId && !invitedUser) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (invitedUser?.preferences?.allowGroupInvites === false) {
    return res.status(403).json({
      success: false,
      message: "This user is not accepting direct group invitations",
    });
  }
  if (invitedUser && await UserBlock.exists({
    $or: [
      { blockerId: invitedUser._id, blockedUserId: req.user._id },
      { blockerId: req.user._id, blockedUserId: invitedUser._id },
    ],
  })) {
    return res.status(403).json({ success: false, message: "You cannot invite this member" });
  }
  if (invitedUser && await membership(req.params.id, invitedUser._id)) {
    return res.status(409).json({ success: false, message: "User is already a group member" });
  }
  if (invitedUser && await GroupMember.exists({
    groupId: req.params.id,
    userId: invitedUser._id,
    $or: [{ status: "suspended" }, { rejoinBlocked: true }],
  })) {
    return res.status(409).json({
      success: false,
      code: "GROUP_REJOIN_BLOCKED",
      message: "This member was suspended from the group and cannot be invited again",
    });
  }
  const existingInvitation = invitedUser
    ? await GroupInvitation.findOne({ groupId: req.params.id, invitedUserId: invitedUser._id, status: "pending", expiresAt: { $gt: new Date() } })
    : null;
  if (existingInvitation) {
    return res.status(409).json({ success: false, message: "User already has a pending invitation" });
  }
  let assignedPayoutPosition = Number.isInteger(payoutPosition) ? payoutPosition : null;
  if (group.status === "setup" && group.savingModel !== "collective_goal" && invitedUser) {
    const [setupMembers, pendingInvitations] = await Promise.all([
      GroupMember.find({ groupId: group._id, status: "active" }).select("setupPayoutPosition"),
      GroupInvitation.find({
        groupId: group._id,
        status: "pending",
        invitedUserId: { $ne: null },
        expiresAt: { $gt: new Date() },
      }).select("payoutPosition"),
    ]);
    const occupied = new Set([
      ...setupMembers.map((member) => member.setupPayoutPosition),
      ...pendingInvitations.map((pending) => pending.payoutPosition),
    ].filter(Number.isInteger));
    if (!Number.isInteger(assignedPayoutPosition) || occupied.has(assignedPayoutPosition)) {
      assignedPayoutPosition = 0;
      while (occupied.has(assignedPayoutPosition)) assignedPayoutPosition += 1;
    }
  }
  if (group.savingModel === "collective_goal") assignedPayoutPosition = null;
  const invitation = await GroupInvitation.create({
    groupId: req.params.id,
    invitedBy: req.user._id,
    invitedUserId: invitedUser?._id,
    invitedEmail: email,
    invitedPhone: phone,
    payoutPosition: assignedPayoutPosition,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  if (invitedUser && invitedUser.preferences?.groupInviteNotifications !== false) {
    await Notification.create({
      userId: invitedUser._id,
      type: "invitation",
      title: `Invitation to ${group.name}`,
      body: `${req.user.fullName} invited you to join ${group.name}.`,
      relatedGroupId: group._id,
    });
  }
  return res.status(201).json({ success: true, data: invitation });
}

export async function respondToInvitation(req, res) {
  const invitation = await GroupInvitation.findOne({ _id: req.params.invitationId, invitedUserId: req.user._id, status: "pending" });
  if (!invitation || invitation.expiresAt <= new Date()) return res.status(404).json({ success: false, message: "Invitation not found or expired" });
  const group = await Group.findById(invitation.groupId);
  if (!group || !["setup", "active"].includes(group.status)) return res.status(404).json({ success: false, message: "Group is no longer available" });
  const status = req.body.accept ? "accepted" : "declined";
  if (status === "accepted") {
    let agreement;
    try {
      agreement = acceptedAgreement(group, req.body, "invitation");
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    try {
      await addUserToGroup(
        group,
        req.user,
        req.user._id,
        invitation.payoutPosition,
        agreement
      );
    } catch (error) {
      if (error?.code === "GROUP_REJOIN_BLOCKED") {
        return res.status(403).json({ success: false, code: error.code, message: error.message });
      }
      throw error;
    }
  } else if (invitation.invitedUserId) {
    await Group.updateOne(
      { _id: invitation.groupId },
      {
        $pull: {
          "rotation.order": invitation.invitedUserId,
          "rotation.pendingOrder": invitation.invitedUserId,
        },
      }
    );
  }
  invitation.status = status;
  await Promise.all([
    invitation.save(),
    Notification.updateMany(
      { userId: req.user._id, type: "invitation", relatedGroupId: group._id, isRead: false },
      { isRead: true }
    ),
  ]);
  const owner = await User.findById(group.ownerId).select("preferences.groupInviteNotifications");
  if (owner?.preferences?.groupInviteNotifications !== false) {
    await Notification.create({
      userId: group.ownerId,
      type: "invitation",
      title: `Invitation ${status}`,
      body: `${req.user.fullName} ${status} the invitation to ${group.name}.`,
      relatedGroupId: group._id,
    });
  }
  return res.json({ success: true, data: invitation, message: status === "accepted" ? "Invitation accepted" : "Invitation declined" });
}

export async function getJoinPreview(req, res) {
  const inviteCode = String(req.query.inviteCode || "").trim().toUpperCase();
  const group = await Group.findOne({
    inviteCode,
    status: "active",
  }).select("name type memberCount contribution isPublic");
  if (!group) {
    return res.status(404).json({
      success: false,
      message: "Invalid or expired group invitation link",
    });
  }
  return res.json({
    success: true,
    data: {
      group,
      agreementVersion: GROUP_AGREEMENT_VERSION,
    },
  });
}
