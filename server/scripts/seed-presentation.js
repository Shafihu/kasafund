import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { Campaign } from "../src/models/Campaign.js";
import { CampaignComment } from "../src/models/CampaignComment.js";
import { CampaignUpdate } from "../src/models/CampaignUpdate.js";
import { Contribution } from "../src/models/Contribution.js";
import { DebtPayment } from "../src/models/DebtPayment.js";
import { Donation } from "../src/models/Donation.js";
import { Group } from "../src/models/Group.js";
import { GroupDelinquency } from "../src/models/GroupDelinquency.js";
import { GroupInvitation } from "../src/models/GroupInvitation.js";
import { GroupJoinRequest } from "../src/models/GroupJoinRequest.js";
import { GroupMember } from "../src/models/GroupMember.js";
import { GroupMessage } from "../src/models/GroupMessage.js";
import { GroupResolution } from "../src/models/GroupResolution.js";
import { Notification } from "../src/models/Notification.js";
import { Payout } from "../src/models/Payout.js";
import { SavingsPot } from "../src/models/SavingsPot.js";
import { SavingsTransaction } from "../src/models/SavingsTransaction.js";
import { User } from "../src/models/User.js";
import { UserAchievement } from "../src/models/UserAchievement.js";
import { UserBlock } from "../src/models/UserBlock.js";
import { UserReport } from "../src/models/UserReport.js";
import { WalletTransaction } from "../src/models/WalletTransaction.js";

const NAMESPACE = "kasafund-presentation-v1";
const DEMO_PASSWORD = process.env.PRESENTATION_DEMO_PASSWORD || "KasaFundDemo2026!";
const PRESENTATION_MONGO_URI = process.env.PRESENTATION_MONGODB_URI || env.mongoUri;
const DAY = 86_400_000;

function id(key) {
  return new mongoose.Types.ObjectId(
    crypto.createHash("sha256").update(`${NAMESPACE}:${key}`).digest("hex").slice(0, 24)
  );
}

function days(value) {
  return new Date(Date.now() + value * DAY);
}

function assertSafeDatabase() {
  if (!PRESENTATION_MONGO_URI) {
    throw new Error("PRESENTATION_MONGODB_URI or MONGODB_URI must be set");
  }
  if (env.nodeEnv === "production") {
    throw new Error("Presentation seeding is disabled when NODE_ENV=production");
  }
  const databaseName = PRESENTATION_MONGO_URI.split("?")[0].split("/").at(-1) || "";
  const allowedName = /(presentation|demo)/i.test(databaseName);
  const explicitlyAllowed = process.env.ALLOW_PRESENTATION_SEED === "true";
  if (!allowedName && !explicitlyAllowed) {
    throw new Error(
      `Refusing to seed database "${databaseName || "(unnamed)"}". ` +
      "Use a database name containing presentation/demo, or set ALLOW_PRESENTATION_SEED=true."
    );
  }
}

const people = [
  ["abena", "Abena Mensah", "Small-business owner and community organiser in Accra.", 125000],
  ["kwame", "Kwame Asante", "Operations lead who believes consistency builds strong communities.", 72000],
  ["esi", "Esi Owusu", "Makola trader and long-time susu organiser.", 98000],
  ["kojo", "Kojo Boateng", "Teacher, father and neighbourhood volunteer.", 46500],
  ["adwoa", "Adwoa Nyarko", "Student nurse committed to serving her community.", 18000],
  ["nana", "Nana Yeboah", "Photographer and creative entrepreneur based in Osu.", 83000],
  ["akosua", "Akosua Frimpong", "Caterer building a dependable family business.", 61000],
  ["kofi", "Kofi Addo", "Software engineer and advocate for transparent community finance.", 112000],
  ["efua", "Efua Osei", "Fashion designer working with young apprentices.", 54000],
  ["yaw", "Yaw Amankwah", "Community development coordinator from Kpando.", 39000],
  ["mabel", "Mabel Tetteh", "Administrator who keeps the family circle organised.", 67500],
  ["daniel", "Daniel Quaye", "Accountant and volunteer financial literacy coach.", 90500],
  ["ama", "Ama Serwaa", "New KasaFund member preparing to start her first savings journey.", 0],
];

const userIds = Object.fromEntries(people.map(([key]) => [key, id(`user:${key}`)]));
const adminId = id("user:super-admin");
const reportIds = {
  pending: id("user-report:pending-scam"),
  reviewing: id("user-report:reviewing-harassment"),
  resolved: id("user-report:resolved-impersonation"),
  campaign: id("campaign-report:misleading-shop"),
};

const groupSpecs = [
  {
    key: "makola", name: "Makola Traders Weekly Susu", type: "cooperative",
    description: "A dependable weekly susu for traders growing their stock and supporting one another.",
    owner: "esi", members: ["esi", "abena", "kwame", "akosua", "efua", "mabel"],
    amount: 20000, frequency: "weekly", completedCycles: 5, currentPaid: 5, public: false,
    cover: "https://images.unsplash.com/photo-1601598851547-4302969d0614?auto=format&fit=crop&w=1200&q=80",
  },
  {
    key: "family", name: "Mensah Family Support Circle", type: "family",
    description: "Monthly support for school costs, health needs and important family milestones.",
    owner: "abena", members: ["abena", "kwame", "kojo", "adwoa", "akosua", "efua", "yaw", "mabel"],
    amount: 10000, frequency: "monthly", completedCycles: 2, currentPaid: 5, public: false,
    cover: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=80",
  },
  {
    key: "professionals", name: "Young Professionals Circle", type: "susu",
    description: "A monthly savings rotation for career goals, equipment and professional development.",
    owner: "daniel", members: ["daniel", "abena", "kwame", "esi", "kofi"],
    amount: 50000, frequency: "monthly", completedCycles: 1, currentPaid: 3, public: false,
    cover: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=80",
  },
  {
    key: "creatives", name: "Accra Creatives Susu", type: "cooperative",
    description: "A public circle helping photographers, designers and makers invest in better tools.",
    owner: "nana", members: ["nana", "akosua", "efua", "yaw"],
    amount: 15000, frequency: "weekly", completedCycles: 2, currentPaid: 4, public: true,
    cover: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80",
  },
];

const groupIds = Object.fromEntries(groupSpecs.map((group) => [group.key, id(`group:${group.key}`)]));

const campaignSpecs = [
  {
    key: "nursing", creator: "adwoa", title: "Help Adwoa Complete Nursing School", category: "school_fees",
    description: "Adwoa has completed three years of nursing training and needs support for her final tuition, clinical materials and licensing fees. Every contribution brings her closer to serving patients in an underserved community.",
    goal: 4500000, deadline: 48, public: true, status: "active",
    cover: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80",
    donations: [["abena",500000,"You have worked so hard. We are proud of you."],["kwame",400000,"Keep going, Adwoa!"],["esi",750000,"Your community is behind you."],["kofi",350000,"Wishing you a strong finish."],[null,640000,"A future nurse deserves our support."],["daniel",600000,"All the best in your final year."]],
  },
  {
    key: "borehole", creator: "yaw", title: "Clean Water for Kpando Zongo", category: "community",
    description: "Families currently walk long distances for reliable water. This campaign will fund a mechanised borehole, storage tank and community taps managed by a local committee.",
    goal: 8000000, deadline: 72, public: true, status: "active",
    cover: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80",
    donations: [["abena",300000,"Clean water changes everything."],["kojo",250000,"For the families and children."],["mabel",490000,"Happy to support this project."],["nana",700000,"Let us make this happen together."],[null,500000,"With love from Accra."],["kofi",800000,"A practical investment in the community."]],
  },
  {
    key: "surgery", creator: "kojo", title: "Kojo’s Emergency Surgery Fund", category: "medical",
    description: "Friends, colleagues and family came together to cover Kojo’s urgent surgery and recovery costs. The procedure was successful and he is now recovering at home.",
    goal: 1200000, deadline: -12, public: true, status: "completed",
    cover: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1200&q=80",
    donations: [["abena",300000,"Wishing you a smooth recovery."],["esi",250000,"We are all praying for you."],["kwame",180000,"Get well soon, Kojo."],["mabel",200000,"Sending strength to the family."],[null,350000,"You are not alone."]],
  },
  {
    key: "shop", creator: "abena", title: "Rebuild Abena’s Provision Shop", category: "business",
    description: "A recent electrical fire damaged the shelves and essential stock in Abena’s neighbourhood shop. Funds will replace safe wiring, shelving and the everyday goods local families rely on.",
    goal: 2500000, deadline: 35, public: true, status: "active",
    cover: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1200&q=80",
    donations: [["kwame",150000,"We will get the shop open again."],["esi",200000,"One step at a time, Abena."],[null,100000,"From a grateful customer."]],
  },
  {
    key: "apprentices", creator: "efua", title: "Sewing Machines for Three Apprentices", category: "charity",
    description: "Efua is preparing three young apprentices to graduate with their own starter sewing machines and tool kits so they can begin earning independently.",
    goal: 1800000, deadline: 60, public: false, status: "active",
    cover: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80",
    donations: [["abena",200000,"Proud to support these young women."],["nana",150000,"Creativity deserves a strong start."],["akosua",250000,"Congratulations to the apprentices."]],
  },
];

const campaignIds = Object.fromEntries(campaignSpecs.map((campaign) => [campaign.key, id(`campaign:${campaign.key}`)]));

function buildGroups() {
  const groups = [];
  const members = [];
  const contributions = [];
  const payouts = [];
  const messages = [];

  for (const spec of groupSpecs) {
    const groupId = groupIds[spec.key];
    const startOffset = spec.frequency === "weekly" ? -7 * spec.completedCycles : -31 * spec.completedCycles;
    const interval = spec.frequency === "weekly" ? 7 : 30;
    const currentCycle = spec.completedCycles + 1;
    const currentDue = days(startOffset + interval * spec.completedCycles + 3);
    const memberObjectIds = spec.members.map((key) => userIds[key]);
    const completedRecipients = spec.members.slice(0, spec.completedCycles).map((key) => userIds[key]);

    groups.push({
      _id: groupId, name: spec.name, description: spec.description, coverImageUrl: spec.cover,
      type: spec.type, ownerId: userIds[spec.owner],
      contribution: { amount: spec.amount, frequency: spec.frequency, startDate: currentDue, gracePeriodDays: 2, penaltyAmount: 1000 },
      rotation: { isEnabled: true, order: memberObjectIds, pendingOrder: [], completedRecipientIds: completedRecipients, currentPositionIndex: spec.completedCycles % spec.members.length, roundNumber: 1, cycleStartedAt: days(startOffset - 2) },
      memberCount: spec.members.length, expectedMemberCount: spec.members.length,
      totalPot: spec.amount * spec.currentPaid, status: "active", inviteCode: `DEMO${spec.key.slice(0, 4).toUpperCase()}`,
      isPublic: spec.public, createdAt: days(startOffset - 60), updatedAt: days(-1),
    });

    spec.members.forEach((personKey, position) => {
      const paidCycles = spec.completedCycles + (position < spec.currentPaid ? 1 : 0);
      members.push({
        _id: id(`member:${spec.key}:${personKey}`), groupId, userId: userIds[personKey],
        role: personKey === spec.owner ? "owner" : position === 1 ? "treasurer" : "member",
        status: "active", joinedAt: days(startOffset - 55 + position), payoutPosition: position,
        setupPayoutPosition: position, lastContributionStatus: position < spec.currentPaid ? "paid" : "pending",
        totalContributed: paidCycles * spec.amount, chatLastReadAt: personKey === "abena" ? days(-2) : days(0),
        agreement: { version: "2026-01", acceptedAt: days(startOffset - 55 + position), source: position === 0 ? "group_creation" : "invitation", termsSnapshot: { contributionAmount: spec.amount, contributionFrequency: spec.frequency, gracePeriodDays: 2, penaltyAmount: 1000, acceleratedDebt: true, resolutionVoting: true } },
      });
    });

    for (let cycle = 1; cycle <= currentCycle; cycle += 1) {
      const dueDate = cycle === currentCycle ? currentDue : days(startOffset + interval * (cycle - 1));
      const contributors = cycle === currentCycle ? spec.members.slice(0, spec.currentPaid) : spec.members;
      contributors.forEach((personKey, position) => {
        contributions.push({
          _id: id(`contribution:${spec.key}:${cycle}:${personKey}`), groupId, userId: userIds[personKey],
          amount: spec.amount, cycleNumber: cycle, dueDate, paidAt: new Date(dueDate.getTime() - (position % 3) * DAY),
          status: "paid", paymentMethod: position % 2 ? "mobile_money" : "wallet",
          paystackReference: `demo-contribution-${spec.key}-${cycle}-${personKey}`, createdAt: new Date(dueDate.getTime() - 2 * DAY),
        });
      });
    }

    for (let cycle = 1; cycle <= spec.completedCycles; cycle += 1) {
      const dueDate = days(startOffset + interval * (cycle - 1));
      payouts.push({
        _id: id(`payout:${spec.key}:${cycle}`), groupId, recipientId: userIds[spec.members[cycle - 1]],
        cycleNumber: cycle, rotationRound: 1, amount: spec.amount * spec.members.length,
        scheduledDate: dueDate, contributionAmount: spec.amount, expectedContributorIds: memberObjectIds,
        snapshotLockedAt: new Date(dueDate.getTime() - 2 * DAY), graceEndsAt: new Date(dueDate.getTime() + 2 * DAY),
        fundingStatus: "ready", fundingStatusUpdatedAt: dueDate, paidAt: new Date(dueDate.getTime() + 2 * 60 * 60 * 1000),
        status: "completed", createdAt: new Date(dueDate.getTime() - 7 * DAY),
      });
    }
    payouts.push({
      _id: id(`payout:${spec.key}:${currentCycle}`), groupId,
      recipientId: userIds[spec.members[spec.completedCycles % spec.members.length]], cycleNumber: currentCycle,
      rotationRound: 1, amount: spec.amount * spec.members.length, scheduledDate: currentDue,
      contributionAmount: spec.amount, expectedContributorIds: memberObjectIds, snapshotLockedAt: days(-1),
      graceEndsAt: new Date(currentDue.getTime() + 2 * DAY),
      fundingStatus: spec.currentPaid === spec.members.length ? "ready" : "awaiting", fundingStatusUpdatedAt: days(-1),
      status: "scheduled", createdAt: days(-6),
    });

    const chatLines = [
      [spec.owner, `Welcome everyone. Our next contribution is due ${currentDue.toLocaleDateString("en-GH")}.`],
      [spec.members[1], "Thanks for the reminder. Mine is sorted."],
      [spec.members.at(-1), "Great work keeping the circle consistent, everyone."],
    ];
    chatLines.forEach(([sender, text], index) => messages.push({
      _id: id(`message:${spec.key}:${index}`), groupId, senderId: userIds[sender], text,
      type: "text", createdAt: days(-3 + index), updatedAt: days(-3 + index),
    }));
  }
  return { groups, members, contributions, payouts, messages };
}

function buildCampaigns() {
  const campaigns = [];
  const donations = [];
  const updates = [];
  const comments = [];
  campaignSpecs.forEach((spec, campaignIndex) => {
    const campaignId = campaignIds[spec.key];
    const createdAt = days(-24 + campaignIndex * 2);
    const total = spec.donations.reduce((sum, donation) => sum + donation[1], 0);
    campaigns.push({
      _id: campaignId, creatorId: userIds[spec.creator], title: spec.title, description: spec.description,
      category: spec.category, coverImageUrl: spec.cover, goalAmount: spec.goal, raisedAmount: total,
      donorCount: spec.donations.length, deadline: days(spec.deadline), isPublic: spec.public,
      allowAnonymousDonations: true, status: spec.status, shareSlug: `demo-${spec.key}`,
      createdAt, updatedAt: days(-1),
    });
    spec.donations.forEach(([donor, amount, message], donationIndex) => {
      const isAnonymous = donor === null;
      donations.push({
        _id: id(`donation:${spec.key}:${donationIndex}`), campaignId,
        donorId: donor ? userIds[donor] : null, isAnonymous,
        displayName: isAnonymous ? "Anonymous" : people.find(([key]) => key === donor)[1],
        amount, message, paymentMethod: donationIndex % 2 ? "mobile_money" : "wallet",
        paystackReference: `demo-donation-${spec.key}-${donationIndex}`,
        paidAt: days(-18 + donationIndex), status: "completed", createdAt: days(-18 + donationIndex),
      });
    });
    updates.push({
      _id: id(`campaign-update:${spec.key}:0`), campaignId, authorId: userIds[spec.creator],
      content: spec.status === "completed" ? "The procedure was successful. Thank you for carrying our family through a difficult week." : "Thank you for the early support. We have confirmed the budget and will keep everyone updated as we reach each milestone.",
      createdAt: days(-5),
    });
    if (spec.status !== "completed") updates.push({
      _id: id(`campaign-update:${spec.key}:1`), campaignId, authorId: userIds[spec.creator],
      content: "We reached another important milestone today. Please continue sharing the campaign with friends and family.",
      createdAt: days(-2),
    });
    [["abena", "This is a meaningful cause. Wishing you success."], ["kwame", "Shared with my circle. Keep us posted!"]]
      .forEach(([author, content], commentIndex) => comments.push({
        _id: id(`campaign-comment:${spec.key}:${commentIndex}`), campaignId,
        authorId: userIds[author], content, createdAt: days(-4 + commentIndex),
      }));
  });
  return { campaigns, donations, updates, comments };
}

async function clearPresentationData() {
  const seededUsers = [...Object.values(userIds), adminId];
  const seededGroups = Object.values(groupIds);
  const seededCampaigns = Object.values(campaignIds);
  await Promise.all([
    AuditLog.deleteMany({
      $or: [
        { actorId: { $in: seededUsers } },
        { targetId: { $in: [...seededUsers, ...seededGroups, ...seededCampaigns] } },
      ],
    }),
    CampaignComment.deleteMany({ campaignId: { $in: seededCampaigns } }),
    CampaignUpdate.deleteMany({ campaignId: { $in: seededCampaigns } }),
    Donation.deleteMany({ campaignId: { $in: seededCampaigns } }),
    Notification.deleteMany({ userId: { $in: seededUsers } }),
    UserAchievement.deleteMany({ userId: { $in: seededUsers } }),
    WalletTransaction.deleteMany({ userId: { $in: seededUsers } }),
    SavingsTransaction.deleteMany({ userId: { $in: seededUsers } }),
    SavingsPot.deleteMany({ userId: { $in: seededUsers } }),
    DebtPayment.deleteMany({
      $or: [
        { groupId: { $in: seededGroups } },
        { userId: { $in: seededUsers } },
        { creditorUserId: { $in: seededUsers } },
      ],
    }),
    GroupDelinquency.deleteMany({ groupId: { $in: seededGroups } }),
    GroupResolution.deleteMany({ groupId: { $in: seededGroups } }),
    GroupInvitation.deleteMany({ groupId: { $in: seededGroups } }),
    GroupJoinRequest.deleteMany({ groupId: { $in: seededGroups } }),
    GroupMessage.deleteMany({ groupId: { $in: seededGroups } }),
    Contribution.deleteMany({ groupId: { $in: seededGroups } }),
    Payout.deleteMany({ groupId: { $in: seededGroups } }),
    GroupMember.deleteMany({ groupId: { $in: seededGroups } }),
    UserBlock.deleteMany({
      $or: [
        { blockerId: { $in: seededUsers } },
        { blockedUserId: { $in: seededUsers } },
      ],
    }),
    UserReport.deleteMany({
      $or: [
        { reporterId: { $in: seededUsers } },
        { reportedUserId: { $in: seededUsers } },
      ],
    }),
  ]);
  await Promise.all([
    Campaign.deleteMany({ _id: { $in: seededCampaigns } }),
    Group.deleteMany({ _id: { $in: seededGroups } }),
    User.deleteMany({ _id: { $in: seededUsers } }),
  ]);
}

async function seed() {
  assertSafeDatabase();
  await mongoose.connect(PRESENTATION_MONGO_URI);
  await clearPresentationData();
  if (process.argv.includes("--reset")) {
    console.log("Presentation records removed.");
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = people.map(([key, fullName, bio, walletBalance], index) => {
    const identityStatus = key === "ama"
      ? "not_started"
      : key === "adwoa"
        ? "in_review"
        : "verified";
    return {
      _id: userIds[key], fullName, email: `${key}@demo.kasafund.app`,
      phone: `+23320000${String(index + 101).padStart(3, "0")}`, passwordHash,
      avatarUrl: `https://api.dicebear.com/9.x/notionists/png?seed=${encodeURIComponent(fullName)}&size=300`,
      bio, role: "user", isEmailVerified: true, emailVerified: true, isPhoneVerified: true,
      emailVerifiedAt: days(-420 + index), phoneVerifiedAt: days(-410 + index), walletBalance,
      preferences: { country: "GH", currency: "GHS", onboardingCompleted: true, publicProfile: true, showOnLeaderboard: true },
      identityVerification: {
        provider: "didit",
        status: identityStatus,
        documentType: identityStatus === "not_started" ? "" : "Ghana Card",
        issuingCountry: identityStatus === "not_started" ? "" : "GHA",
        verifiedAt: identityStatus === "verified" ? days(-380 + index * 3) : null,
        submittedAt: identityStatus === "not_started" ? null : days(-381 + index * 3),
        lastCheckedAt: identityStatus === "not_started" ? null : days(-1),
      },
      isActive: true, lastLoginAt: days(index === 0 ? -1 : -index), createdAt: days(-450 + index * 7), updatedAt: days(-1),
    };
  });
  await User.insertMany(users);
  await User.create({
    _id: adminId,
    fullName: "KasaFund Administrator",
    email: "admin@demo.kasafund.app",
    phone: "+233200009999",
    passwordHash,
    role: "super_admin",
    isEmailVerified: true,
    emailVerified: true,
    isPhoneVerified: true,
    emailVerifiedAt: days(-500),
    phoneVerifiedAt: days(-495),
    identityVerification: {
      provider: "didit",
      status: "verified",
      documentType: "Ghana Card",
      issuingCountry: "GHA",
      verifiedAt: days(-500),
      submittedAt: days(-501),
      lastCheckedAt: days(-1),
    },
    isActive: true,
    lastLoginAt: days(-1),
    createdAt: days(-520),
    updatedAt: days(-1),
  });

  const groupData = buildGroups();
  await Group.insertMany(groupData.groups);
  await GroupMember.insertMany(groupData.members);
  await Contribution.insertMany(groupData.contributions);
  await Payout.insertMany(groupData.payouts);
  await GroupMessage.insertMany(groupData.messages);

  const campaignData = buildCampaigns();
  await Campaign.insertMany(campaignData.campaigns);
  await Donation.insertMany(campaignData.donations);
  await CampaignUpdate.insertMany(campaignData.updates);
  await CampaignComment.insertMany(campaignData.comments);

  const abenaId = userIds.abena;
  const potId = id("savings-pot:shop-expansion");
  await SavingsPot.create({
    _id: potId, userId: abenaId, name: "Shop expansion", targetAmount: 600000,
    currentAmount: 235000, contributionAmount: 25000, frequency: "weekly",
    nextContributionAt: days(4), targetDate: days(120), mode: "flexible", status: "active",
    autoSaveEnabled: false, createdAt: days(-80), updatedAt: days(-3),
  });
  await SavingsTransaction.insertMany([
    { _id: id("savings-tx:1"), potId, userId: abenaId, type: "deposit", source: "wallet", amount: 100000, balanceAfter: 100000, reference: "demo-savings-1", status: "completed", createdAt: days(-70) },
    { _id: id("savings-tx:2"), potId, userId: abenaId, type: "deposit", source: "wallet", amount: 75000, balanceAfter: 175000, reference: "demo-savings-2", status: "completed", createdAt: days(-40) },
    { _id: id("savings-tx:3"), potId, userId: abenaId, type: "deposit", source: "wallet", amount: 60000, balanceAfter: 235000, reference: "demo-savings-3", status: "completed", createdAt: days(-10) },
  ]);

  await WalletTransaction.insertMany([
    { _id: id("wallet:1"), userId: abenaId, type: "deposit", amount: 300000, status: "completed", reference: "demo-wallet-deposit-1", channel: "mobile_money", completedAt: days(-30), createdAt: days(-30), updatedAt: days(-30) },
    { _id: id("wallet:2"), userId: abenaId, type: "contribution", amount: 20000, status: "completed", reference: "demo-wallet-contribution-1", relatedGroupId: groupIds.makola, channel: "wallet", completedAt: days(-7), createdAt: days(-7), updatedAt: days(-7) },
    { _id: id("wallet:3"), userId: abenaId, type: "payout", amount: 250000, status: "completed", reference: "demo-wallet-payout-1", relatedGroupId: groupIds.professionals, transferMode: "mock", completedAt: days(-18), createdAt: days(-18), updatedAt: days(-18) },
    { _id: id("wallet:4"), userId: abenaId, type: "savings_deposit", amount: 60000, status: "completed", reference: "demo-wallet-savings-1", relatedSavingsPotId: potId, channel: "wallet", completedAt: days(-10), createdAt: days(-10), updatedAt: days(-10) },
  ]);

  const achievements = people.flatMap(([key], index) => {
    const base = [];
    if (key !== "adwoa" && key !== "ama") {
      base.push({ badgeId: "verified_member", title: "Verified Member", description: "Completed identity verification", points: 100 });
    }
    if (key !== "ama") {
      base.push({ badgeId: "first_contribution", title: "First Step", description: "Made a first successful group contribution", points: 25 });
    }
    if ([0, 1, 2, 5, 7, 11].includes(index)) base.push({ badgeId: "consistent_contributor", title: "Consistent Contributor", description: "Completed 5 group contributions", points: 100 });
    return base.map((badge, badgeIndex) => ({
      _id: id(`achievement:${key}:${badge.badgeId}`), userId: userIds[key], ...badge,
      earnedAt: days(-120 + index * 3 + badgeIndex), presentedAt: days(-110 + index * 3 + badgeIndex),
      createdAt: days(-120), updatedAt: days(-110),
    }));
  });
  await UserAchievement.insertMany(achievements);

  await Notification.insertMany([
    { _id: id("notification:1"), userId: abenaId, type: "donation_received", title: "New support for your campaign", body: "Esi donated GHS 2,000 to Rebuild Abena’s Provision Shop.", relatedCampaignId: campaignIds.shop, isRead: false, createdAt: days(-1) },
    { _id: id("notification:2"), userId: abenaId, type: "payment_due", title: "Family contribution due soon", body: "Your GHS 100 contribution to Mensah Family Support Circle is due soon.", relatedGroupId: groupIds.family, isRead: false, createdAt: days(-1) },
    { _id: id("notification:3"), userId: abenaId, type: "campaign_update", title: "Help Adwoa Complete Nursing School", body: "Adwoa posted a new campaign update.", relatedCampaignId: campaignIds.nursing, isRead: false, createdAt: days(-2) },
    { _id: id("notification:4"), userId: abenaId, type: "payout_completed", title: "Payout received", body: "Your GHS 2,500 payout from Young Professionals Circle was completed.", relatedGroupId: groupIds.professionals, isRead: true, createdAt: days(-18) },
    { _id: id("notification:report-resolved"), userId: userIds.efua, type: "report_update", title: "Your report has been reviewed", body: "We reviewed the profile concern and confirmed that the account information has been corrected. Thank you for helping keep KasaFund trustworthy.", relatedUserId: userIds.kofi, isRead: true, createdAt: days(-4) },
  ]);

  await UserReport.insertMany([
    {
      _id: reportIds.campaign,
      reporterId: userIds.mabel,
      targetType: "campaign",
      reportedCampaignId: campaignIds.shop,
      reason: "misleading",
      details: "The campaign says all funds will replace shop equipment, but a recent shared message describes a different use. Please verify the stated budget with the organizer.",
      status: "pending",
      createdAt: days(-1),
      updatedAt: days(-1),
    },
    {
      _id: reportIds.pending,
      reporterId: userIds.abena,
      reportedUserId: userIds.nana,
      targetType: "member",
      reason: "scam",
      details: "The member sent me a private request to transfer money outside KasaFund and said it was required to keep my place in a savings group.",
      status: "pending",
      createdAt: days(-1),
      updatedAt: days(-1),
    },
    {
      _id: reportIds.reviewing,
      reporterId: userIds.kojo,
      reportedUserId: userIds.yaw,
      targetType: "member",
      reason: "harassment",
      details: "I received repeated insulting messages after declining an invitation. I asked the member to stop, but another message arrived the next day.",
      status: "reviewing",
      assignedTo: adminId,
      reviewStartedAt: days(-2),
      internalNotes: [{ authorId: adminId, body: "Confirmed the reporter and reported member shared one group. Reviewing the relevant message timeline before deciding the outcome.", createdAt: days(-2) }],
      createdAt: days(-3),
      updatedAt: days(-2),
    },
    {
      _id: reportIds.resolved,
      reporterId: userIds.efua,
      reportedUserId: userIds.kofi,
      targetType: "member",
      reason: "impersonation",
      details: "The profile used a business name and logo that looked like another local organisation.",
      status: "resolved",
      assignedTo: adminId,
      reviewStartedAt: days(-6),
      resolutionSummary: "We reviewed the profile concern and confirmed that the account information has been corrected. Thank you for helping keep KasaFund trustworthy.",
      resolvedAt: days(-4),
      resolvedBy: adminId,
      internalNotes: [{ authorId: adminId, body: "Compared the profile information with the organisation's public contact details and requested corrected account information.", createdAt: days(-5) }],
      decisions: [{ action: "resolved", summary: "We reviewed the profile concern and confirmed that the account information has been corrected. Thank you for helping keep KasaFund trustworthy.", authorId: adminId, createdAt: days(-4) }],
      createdAt: days(-7),
      updatedAt: days(-4),
    },
  ]);

  await AuditLog.insertMany([
    { _id: id("audit:report-review-started"), actorId: adminId, action: "admin.user_report_start_review", targetType: "user_report", targetId: reportIds.reviewing, metadata: { previousStatus: "pending", status: "reviewing", reportReason: "harassment" }, createdAt: days(-2) },
    { _id: id("audit:report-resolved"), actorId: adminId, action: "admin.user_report_resolve", targetType: "user_report", targetId: reportIds.resolved, metadata: { previousStatus: "reviewing", status: "resolved", reportReason: "impersonation" }, createdAt: days(-4) },
  ]);

  console.log("Presentation data seeded successfully.");
  console.log(`Login: abena@demo.kasafund.app`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log(`Unverified login: ama@demo.kasafund.app`);
  console.log(`Admin login: admin@demo.kasafund.app`);
  console.log(`Users: ${users.length}, groups: ${groupData.groups.length}, campaigns: ${campaignData.campaigns.length}`);
}

seed()
  .catch((error) => {
    console.error("Presentation seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
