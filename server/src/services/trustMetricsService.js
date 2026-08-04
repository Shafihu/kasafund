import { Contribution } from "../models/Contribution.js";
import { GroupMember } from "../models/GroupMember.js";
import { Payout } from "../models/Payout.js";
import { User } from "../models/User.js";
import { UserAchievement } from "../models/UserAchievement.js";

const DAY_MS = 86_400_000;

function percentage(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

function trustLevel(score) {
  if (score >= 90) return "exceptional";
  if (score >= 75) return "trusted";
  if (score >= 55) return "reliable";
  if (score >= 30) return "building";
  return "new";
}

export function rewardSummary(points) {
  const tiers = [
    { id: "starter", minimum: 0 },
    { id: "bronze", minimum: 100 },
    { id: "silver", minimum: 300 },
    { id: "gold", minimum: 600 },
    { id: "platinum", minimum: 1000 },
  ];
  const currentIndex = [...tiers].reverse().findIndex((tier) => points >= tier.minimum);
  const tierIndex = tiers.length - currentIndex - 1;
  const current = tiers[tierIndex];
  const next = tiers[tierIndex + 1] || null;
  const progressPercent = next
    ? Math.round(((points - current.minimum) / (next.minimum - current.minimum)) * 100)
    : 100;
  return {
    points,
    tier: current.id,
    nextTier: next?.id || null,
    pointsToNextTier: next ? next.minimum - points : 0,
    tierProgressPercent: Math.max(0, Math.min(progressPercent, 100)),
  };
}

export async function calculateTrustMetrics(user) {
  const now = new Date();
  const memberships = await GroupMember.find({ userId: user._id, status: "active" })
    .populate("groupId", "contribution.gracePeriodDays")
    .select("groupId joinedAt")
    .lean();
  const groupIds = memberships.map((membership) => membership.groupId?._id).filter(Boolean);

  const [paidContributions, duePayouts, completedPayouts] = await Promise.all([
    Contribution.find({ userId: user._id, status: "paid" })
      .select("groupId cycleNumber dueDate paidAt")
      .sort({ paidAt: 1 })
      .lean(),
    groupIds.length
      ? Payout.find({ groupId: { $in: groupIds }, scheduledDate: { $lte: now } })
          .select("groupId cycleNumber scheduledDate")
          .lean()
      : [],
    Payout.find({ recipientId: user._id, status: "completed" })
      .select("paidAt")
      .sort({ paidAt: 1 })
      .lean(),
  ]);

  const membershipByGroup = new Map(
    memberships.map((membership) => [String(membership.groupId?._id), membership])
  );
  const eligiblePayouts = duePayouts.filter((payout) => {
    const membership = membershipByGroup.get(String(payout.groupId));
    return membership && new Date(membership.joinedAt) <= new Date(payout.scheduledDate);
  });
  const paidByCycle = new Map(
    paidContributions.map((contribution) => [
      `${String(contribution.groupId)}:${contribution.cycleNumber}`,
      contribution,
    ])
  );

  let paidExpectedContributions = 0;
  let onTimeContributions = 0;
  const onTimeDates = [];
  for (const payout of eligiblePayouts) {
    const contribution = paidByCycle.get(`${String(payout.groupId)}:${payout.cycleNumber}`);
    if (!contribution) continue;
    paidExpectedContributions += 1;
    const membership = membershipByGroup.get(String(payout.groupId));
    const graceDays = membership?.groupId?.contribution?.gracePeriodDays || 0;
    const deadline = new Date(payout.scheduledDate).getTime() + graceDays * DAY_MS;
    if (contribution.paidAt && new Date(contribution.paidAt).getTime() <= deadline) {
      onTimeContributions += 1;
      onTimeDates.push(contribution.paidAt);
    }
  }

  const expectedContributions = eligiblePayouts.length;
  const reliabilityPercent = percentage(paidExpectedContributions, expectedContributions);
  const onTimePercent = percentage(onTimeContributions, paidExpectedContributions);
  const accountAgeDays = Math.max(0, Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / DAY_MS));
  const historyConfidence = Math.min(expectedContributions / 8, 1);
  const identityVerified = user.identityVerification?.status === "verified";

  const score = Math.round(
    (identityVerified ? 25 : 0) +
    45 * ((reliabilityPercent || 0) / 100) * historyConfidence +
    10 * ((onTimePercent || 0) / 100) * historyConfidence +
    10 * Math.min(accountAgeDays / 365, 1) +
    5 * Math.min(paidContributions.length / 10, 1) +
    5 * Math.min(completedPayouts.length / 3, 1)
  );

  const trustMetrics = {
    score: Math.min(score, 100),
    level: trustLevel(score),
    identityVerified,
    accountAgeDays,
    activeGroupCount: memberships.length,
    successfulContributions: paidContributions.length,
    expectedContributions,
    contributionReliabilityPercent: reliabilityPercent,
    onTimeContributionPercent: onTimePercent,
    completedPayouts: completedPayouts.length,
    calculatedAt: now,
  };

  const badgeCandidates = [
    {
      id: "verified_member",
      title: "Verified Member",
      description: "Completed identity verification",
      points: 100,
      earned: identityVerified,
      earnedAt: user.identityVerification?.verifiedAt || now,
    },
    {
      id: "first_contribution",
      title: "First Step",
      description: "Made a first successful group contribution",
      points: 25,
      earned: paidContributions.length >= 1,
      earnedAt: paidContributions[0]?.paidAt,
    },
    {
      id: "consistent_contributor",
      title: "Consistent Contributor",
      description: "Completed 5 group contributions",
      points: 100,
      earned: paidContributions.length >= 5,
      earnedAt: paidContributions[4]?.paidAt,
    },
    {
      id: "contribution_champion",
      title: "Contribution Champion",
      description: "Completed 20 group contributions",
      points: 200,
      earned: paidContributions.length >= 20,
      earnedAt: paidContributions[19]?.paidAt,
    },
    {
      id: "on_time_star",
      title: "On-time Star",
      description: "Made 5 contributions within their deadlines",
      points: 100,
      earned: onTimeContributions >= 5,
      earnedAt: onTimeDates[4],
    },
    {
      id: "reliability_pro",
      title: "Reliability Pro",
      description: "Maintained at least 90% reliability across 8 due cycles",
      points: 200,
      earned: expectedContributions >= 8 && (reliabilityPercent || 0) >= 90,
      earnedAt: eligiblePayouts.at(-1)?.scheduledDate,
    },
    {
      id: "first_payout",
      title: "Payout Milestone",
      description: "Completed a first group payout",
      points: 75,
      earned: completedPayouts.length >= 1,
      earnedAt: completedPayouts[0]?.paidAt,
    },
    {
      id: "payout_veteran",
      title: "Payout Veteran",
      description: "Completed 3 group payouts",
      points: 150,
      earned: completedPayouts.length >= 3,
      earnedAt: completedPayouts[2]?.paidAt,
    },
    {
      id: "long_term_member",
      title: "KasaFund Veteran",
      description: "Maintained an account for at least one year",
      points: 150,
      earned: accountAgeDays >= 365,
      earnedAt: new Date(new Date(user.createdAt).getTime() + 365 * DAY_MS),
    },
  ];
  const badges = badgeCandidates
    .filter((badge) => badge.earned)
    .map(({ earned: _earned, ...badge }) => badge);
  const rewards = rewardSummary(badges.reduce((total, badge) => total + badge.points, 0));

  return { trustMetrics, achievements: { ...rewards, badges } };
}

export async function syncUserAchievements(userOrId) {
  const user = userOrId?.createdAt
    ? userOrId
    : await User.findById(userOrId)
        .select("createdAt identityVerification.status identityVerification.verifiedAt")
        .lean();
  if (!user) return null;

  const calculated = await calculateTrustMetrics(user);
  if (calculated.achievements.badges.length) {
    try {
      await UserAchievement.bulkWrite(
        calculated.achievements.badges.map((badge) => ({
          updateOne: {
            filter: { userId: user._id, badgeId: badge.id },
            update: {
              $setOnInsert: {
                userId: user._id,
                badgeId: badge.id,
                title: badge.title,
                description: badge.description,
                points: badge.points,
                earnedAt: badge.earnedAt,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    } catch (error) {
      // Concurrent payment/app-resume checks may attempt the same unique award.
      if (error?.code !== 11000) throw error;
    }
  }

  const persisted = await UserAchievement.find({ userId: user._id })
    .select("badgeId title description points earnedAt")
    .sort({ earnedAt: 1 })
    .lean();
  const badges = persisted.map((badge) => ({
    id: badge.badgeId,
    title: badge.title,
    description: badge.description,
    points: badge.points,
    earnedAt: badge.earnedAt,
  }));
  const rewards = rewardSummary(badges.reduce((total, badge) => total + badge.points, 0));
  return {
    trustMetrics: calculated.trustMetrics,
    achievements: { ...rewards, badges },
  };
}
