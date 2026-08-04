import { Contribution } from "../models/Contribution.js";
import { GroupMember } from "../models/GroupMember.js";
import { Payout } from "../models/Payout.js";
import { env } from "../config/env.js";

const faqAnswers = [
  {
    patterns: [/\bwhat is kasafund\b/i, /\babout kasafund\b/i],
    answer:
      "KasaFund helps people manage trusted susu groups, personal savings pots, fundraising campaigns, wallet activity, contributions, and payout rotations in one place.",
  },
  {
    patterns: [/\bwhat is susu\b/i, /\bhow does susu\b/i],
    answer:
      "A susu group is a rotating savings arrangement. Members contribute an agreed amount on schedule, and the collected pot is paid to members according to the accepted rotation order.",
  },
  {
    patterns: [/\bhow.*payout\b/i, /\bpayout.*work\b/i],
    answer:
      "KasaFund processes a scheduled group payout when the required contributions are available. If funding is incomplete, the grace and resolution rules agreed by the group apply.",
  },
  {
    patterns: [/\bwhy.*kyc\b/i, /\bidentity verification\b/i],
    answer:
      "KYC protects members and financial activity by confirming a user’s identity. KasaFund requires it before joining groups or making transactions.",
  },
  {
    patterns: [/\bfundrais/i, /\bcampaign\b/i],
    answer:
      "KasaFund campaigns let organizers raise money for a clear goal, share updates, and receive contributions through the supported payment flow.",
  },
];

export function classifyAccountIntent(text) {
  if (/\b(wallet|balance|money available)\b/i.test(text)) return "wallet";
  if (/\b(kyc|identity|verification status|verified)\b/i.test(text)) return "kyc";
  if (/\b(my groups?|groups? am i|group memberships?)\b/i.test(text)) return "groups";
  if (/\b(due|next contribution|contribution date|pay next)\b/i.test(text)) {
    return "due";
  }
  return null;
}

function formatMoney(pesewas) {
  return new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number(pesewas) || 0) / 100);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeZone: "Africa/Accra",
  }).format(new Date(date));
}

export async function answerAccountQuestion(user, intent) {
  if (intent === "wallet") {
    return `Your available KasaFund wallet balance is GHS ${formatMoney(
      user.walletBalance
    )}. For your security, deposits, withdrawals, and transfers must be completed inside the KasaFund app.`;
  }

  if (intent === "kyc") {
    const status = user.identityVerification?.status || "not_started";
    const labels = {
      not_started: "not started",
      in_progress: "in progress",
      in_review: "under review",
      verified: "verified",
      declined: "declined",
      expired: "expired",
      resubmission_required: "waiting for resubmission",
    };
    return `Your KasaFund identity verification is currently ${
      labels[status] || status
    }. Open Profile → Account settings → Identity verification for details.`;
  }

  const memberships = await GroupMember.find({
    userId: user._id,
    status: "active",
  })
    .populate("groupId", "name contribution status")
    .sort({ joinedAt: -1 })
    .limit(10);

  if (intent === "groups") {
    const groups = memberships.filter((membership) => membership.groupId);
    if (!groups.length) {
      return "You are not currently an active member of any KasaFund group.";
    }
    const lines = groups.map(
      (membership) =>
        `• ${membership.groupId.name} — GHS ${formatMoney(
          membership.groupId.contribution.amount
        )} ${membership.groupId.contribution.frequency}`
    );
    return `Your active groups:\n${lines.join("\n")}`;
  }

  if (intent === "due") {
    const pendingContribution = await Contribution.findOne({
      userId: user._id,
      status: { $in: ["pending", "late"] },
    })
      .populate("groupId", "name")
      .sort({ dueDate: 1 });

    if (pendingContribution) {
      return `Your next contribution is GHS ${formatMoney(
        pendingContribution.amount
      )} for ${pendingContribution.groupId?.name || "your group"}, due ${formatDate(
        pendingContribution.dueDate
      )}. Pay securely inside KasaFund.`;
    }

    const groupIds = memberships.map((membership) => membership.groupId?._id).filter(Boolean);
    const nextPayout = await Payout.findOne({
      groupId: { $in: groupIds },
      expectedContributorIds: user._id,
      status: "scheduled",
    })
      .populate("groupId", "name contribution")
      .sort({ scheduledDate: 1 });

    if (nextPayout) {
      return `Your next expected contribution is GHS ${formatMoney(
        nextPayout.contributionAmount || nextPayout.groupId?.contribution?.amount
      )} for ${nextPayout.groupId?.name || "your group"}, due ${formatDate(
        nextPayout.scheduledDate
      )}.`;
    }

    return "You do not have an upcoming group contribution scheduled right now.";
  }

  return "I couldn’t identify that account request. Try “wallet balance”, “my groups”, “KYC status”, or “next contribution”.";
}

function staticFaqAnswer(question) {
  return faqAnswers.find((entry) =>
    entry.patterns.some((pattern) => pattern.test(question))
  )?.answer;
}

export async function answerKasaFundQuestion(question) {
  const staticAnswer = staticFaqAnswer(question);
  if (staticAnswer) return staticAnswer;

  if (!env.geminiApiKey) {
    return "I can help with KasaFund groups, susu contributions, payouts, fundraising, wallets, KYC, and account questions. Try asking “How do susu payouts work?”";
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        env.geminiModel
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "You are Kasa, KasaFund's concise WhatsApp support assistant. Only answer questions about KasaFund, susu and rotating savings, group contributions and payouts, personal savings pots, fundraising, KYC, wallet concepts, and safe use of the app. Never claim to move money, expose account data, give legal guarantees, or invent KasaFund policies. Direct transactions and sensitive changes to the KasaFund app. If unrelated, politely say you only support KasaFund topics. Keep answers under 700 characters and suitable for Ghanaian users.",
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text: question.slice(0, 1000) }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 220,
          },
        }),
      }
    );

    if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
    const data = await response.json();
    const answer = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();
    return (
      answer ||
      "I can help with KasaFund groups, contributions, payouts, wallets, fundraising, and KYC."
    );
  } catch (error) {
    console.error("Kasa assistant AI fallback:", error.message);
    return "I’m having trouble answering that right now. I can still help with wallet balance, KYC status, your groups, next contributions, and common KasaFund questions.";
  }
}

export function assistantMenu() {
  return [
    "Hi, I’m Kasa 👋🏾 — KasaFund’s WhatsApp assistant.",
    "",
    "You can ask:",
    "• What is KasaFund?",
    "• How do susu payouts work?",
    "• What is my wallet balance?",
    "• When is my next contribution?",
    "• What is my KYC status?",
    "",
    "Account answers require secure linking from the KasaFund app.",
  ].join("\n");
}
