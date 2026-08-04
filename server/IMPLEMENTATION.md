USERS
{
  _id: ObjectId,
  fullName: String,
  email: String,          // unique index
  phone: String,           // unique index, used for Mobile Money
  passwordHash: String,
  avatarUrl: String,
  isEmailVerified: Boolean,
  isPhoneVerified: Boolean,
  role: "user" | "super_admin",   // platform-level role, not group role
  paystackCustomerCode: String,   // for saved payment methods
  walletBalance: Number,          // in minor units (pesewas), future feature
  notificationPrefs: {
    push: Boolean,
    email: Boolean,
    sms: Boolean
  },
  createdAt: Date,
  updatedAt: Date
}

GROUPS
{
  _id: ObjectId,
  name: String,
  description: String,
  coverImageUrl: String,
  type: "susu" | "family" | "church" | "cooperative" | "other",
  ownerId: ObjectId,           // ref users

  contribution: {
    amount: Number,             // minor units
    frequency: "daily" | "weekly" | "monthly",
    startDate: Date,
    gracePeriodDays: Number,
    penaltyAmount: Number
  },

  rotation: {
    isEnabled: Boolean,          // false for pure fundraising-style groups
    order: [ObjectId],           // ordered array of userIds — the payout sequence
    currentPositionIndex: Number,// pointer into `order`
    cycleStartedAt: Date
  },

  memberCount: Number,           // denormalized, kept in sync on join/leave
  totalPot: Number,              // denormalized running total, minor units
  status: "active" | "paused" | "completed" | "archived",
  inviteCode: String,            // unique short code
  isPublic: Boolean,              // shows in Discover

  createdAt: Date,
  updatedAt: Date
}

GROUP_MEMBERS
{
  _id: ObjectId,
  groupId: ObjectId,      // ref groups, indexed
  userId: ObjectId,       // ref users, indexed
  role: "owner" | "treasurer" | "moderator" | "member",
  status: "active" | "removed" | "left",
  joinedAt: Date,
  payoutPosition: Number,        // redundant with groups.rotation.order but fast to query per-member
  lastContributionStatus: "paid" | "pending" | "late",  // denormalized for card rendering
  totalContributed: Number       // running total, minor units
}

CONTRIBUTIONS
{
  _id: ObjectId,
  groupId: ObjectId,       // indexed
  userId: ObjectId,        // indexed
  amount: Number,           // minor units
  cycleNumber: Number,       // which rotation cycle this belongs to
  dueDate: Date,
  paidAt: Date,
  status: "pending" | "paid" | "late" | "failed",
  paymentMethod: "mobile_money" | "card" | "bank_transfer",
  paystackReference: String, // unique — see idempotency note below
  receiptUrl: String,
  createdAt: Date
}

PAYOUTS
{
  _id: ObjectId,
  groupId: ObjectId,        // indexed
  recipientId: ObjectId,     // ref users
  cycleNumber: Number,
  amount: Number,             // minor units
  scheduledDate: Date,
  paidAt: Date,
  status: "scheduled" | "completed" | "failed",
  createdAt: Date
}

CAMPAIGNS
{
  _id: ObjectId,
  creatorId: ObjectId,        // indexed
  title: String,
  description: String,
  category: "medical" | "funeral" | "wedding" | "school_fees" | "charity" |
             "community" | "disaster_relief" | "business" | "other",
  coverImageUrl: String,
  goalAmount: Number,          // minor units
  raisedAmount: Number,         // denormalized running total
  donorCount: Number,            // denormalized
  deadline: Date,
  isPublic: Boolean,
  allowAnonymousDonations: Boolean,
  status: "active" | "completed" | "closed" | "flagged",
  shareSlug: String,             // unique, for /c/abc123 short links
  createdAt: Date,
  updatedAt: Date
}

DONATIONS
{
  _id: ObjectId,
  campaignId: ObjectId,       // indexed
  donorId: ObjectId,           // ref users, null if anonymous
  isAnonymous: Boolean,
  displayName: String,          // "Anonymous" or donor's chosen name
  amount: Number,                // minor units
  message: String,
  paymentMethod: "mobile_money" | "card" | "bank_transfer",
  paystackReference: String,    // unique
  status: "pending" | "completed" | "failed" | "refunded",
  createdAt: Date
}

campaign_updates and campaign_comments
Split out rather than embedded arrays inside campaigns, because both grow unboundedly on a popular campaign and you don't want to load 400 comments every time you fetch a campaign for the detail screen.
js// campaign_updates
{
  _id: ObjectId,
  campaignId: ObjectId,   // indexed
  authorId: ObjectId,
  content: String,
  createdAt: Date
}

// campaign_comments
{
  _id: ObjectId,
  campaignId: ObjectId,   // indexed
  authorId: ObjectId,
  content: String,
  createdAt: Date
}

NOTIFICATIONS
{
  _id: ObjectId,
  userId: ObjectId,          // indexed
  type: "payment_due" | "payment_confirmed" | "payout_scheduled" |
         "campaign_update" | "invitation" | "penalty_applied",
  title: String,
  body: String,
  relatedGroupId: ObjectId,     // optional, nullable
  relatedCampaignId: ObjectId,  // optional, nullable
  isRead: Boolean,
  createdAt: Date
}

{
  _id: ObjectId,
  groupId: ObjectId,        // indexed
  invitedBy: ObjectId,
  invitedUserId: ObjectId,    // nullable if invited by phone/email before signup
  invitedPhone: String,
  invitedEmail: String,
  status: "pending" | "accepted" | "declined" | "expired",
  createdAt: Date,
  expiresAt: Date
}

AUDIT_LOGS
{
  _id: ObjectId,
  actorId: ObjectId,
  action: String,             // "group.member_removed", "payout.approved", etc
  targetType: "group" | "campaign" | "user",
  targetId: ObjectId,
  metadata: Object,            // flexible payload for the specific action
  createdAt: Date
}

1. Rotation order — array of ObjectIds, not embedded member docs.
Keeping rotation.order as a plain array of userIds inside groups, separate from the full group_members docs, means reordering during your drag-to-reorder step is a single cheap array update — you're not rewriting embedded member subdocuments. currentPositionIndex tells you whose turn is next without a query.
2. Paystack idempotency — unique index on paystackReference.
Payment webhooks get retried by Paystack, and your app might also double-fire a confirmation call. Without a unique index on that reference field, a retried webhook creates a duplicate contributions document and double-credits someone's payment status. Structure your webhook handler as an upsert keyed on paystackReference, not a blind insert.
3. Denormalized counters (totalPot, raisedAmount, donorCount, memberCount).
MongoDB has no cheap JOIN + SUM. Rather than aggregating contributions every time the Home tab or a group card renders, maintain running totals directly on groups and campaigns, updated atomically with $inc inside the same transaction that creates the contributions/donations document. This is the standard tradeoff for read-heavy dashboard apps — you accept a bit of write complexity for cheap reads everywhere else.
Indexes worth setting explicitly
jsdb.group_members.createIndex({ groupId: 1, userId: 1 }, { unique: true })
db.contributions.createIndex({ paystackReference: 1 }, { unique: true, sparse: true })
db.donations.createIndex({ paystackReference: 1 }, { unique: true, sparse: true })
db.contributions.createIndex({ groupId: 1, cycleNumber: 1 })
db.notifications.createIndex({ userId: 1, isRead: 1, createdAt: -1 })
db.campaigns.createIndex({ shareSlug: 1 }, { unique: true })
db.groups.createIndex({ inviteCode: 1 }, { unique: true })