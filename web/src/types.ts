export type KycStatus =
  | "not_started"
  | "in_progress"
  | "in_review"
  | "verified"
  | "declined"
  | "expired"
  | "resubmission_required";

export type AdminUser = {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: "user" | "super_admin";
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified?: boolean;
  walletBalance?: number;
  bio?: string;
  identityVerification?: {
    provider?: "didit";
    status?: KycStatus;
    documentType?: string;
    issuingCountry?: string;
    failureReason?: string;
    submittedAt?: string;
    verifiedAt?: string;
    lastCheckedAt?: string;
  };
  createdAt: string;
  lastLoginAt?: string;
};

export type Overview = {
  metrics: {
    users: number;
    activeGroups: number;
    activeCampaigns: number;
    moneyMoved: number;
  };
  attention: {
    kycInReview: number;
    kycNotStarted: number;
    overduePayouts: number;
    flaggedCampaigns: number;
    openReports: number;
  };
  kyc: Record<string, number>;
  recentUsers: AdminUser[];
};

export type AuthSession = { token: string; user: AdminUser };

export type MemberDetail = {
  user: AdminUser;
  metrics: {
    groups: number;
    contributions: number;
    contributedAmount: number;
    donations: number;
    donatedAmount: number;
    activeSavingsPots: number;
    openDelinquencies: number;
    openReports: number;
  };
  memberships: Array<{
    _id: string;
    role: string;
    joinedAt: string;
    lastContributionStatus: string;
    totalContributed: number;
    groupId?: {
      _id: string;
      name: string;
      type: string;
      status: string;
      contribution?: { amount: number; frequency: string };
    };
  }>;
  campaigns: Array<{
    _id: string;
    title: string;
    status: string;
    raisedAmount: number;
    goalAmount: number;
    deadline: string;
  }>;
  recentTransactions: Array<{
    _id: string;
    type: string;
    amount: number;
    currency: string;
    status: string;
    channel?: string;
    completedAt?: string;
    createdAt: string;
  }>;
  canReconcileKyc: boolean;
};

export type AdminGroup = {
  _id: string;
  name: string;
  type: string;
  coverImageUrl?: string;
  status: "setup" | "active" | "paused" | "completed" | "archived";
  memberCount: number;
  expectedMemberCount: number;
  totalPot: number;
  contribution: { amount: number; frequency: string; startDate?: string; gracePeriodDays?: number; penaltyAmount?: number };
  isPublic: boolean;
  ownerId?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl">;
  attentionCount: number;
  nextPayoutDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type GroupDetail = {
  group: AdminGroup & { description?: string };
  metrics: { activeMembers: number; completedPayouts: number; openDelinquencies: number; activeVotes: number };
  contributions: Record<string, { count: number; amount: number }>;
  members: Array<{
    _id: string;
    role: string;
    status: string;
    joinedAt: string;
    lastContributionStatus: string;
    totalContributed: number;
    payoutPosition?: number;
    userId?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl" | "isActive" | "identityVerification">;
  }>;
  payouts: Array<{
    _id: string;
    cycleNumber: number;
    amount: number;
    scheduledDate: string;
    fundingStatus: string;
    status: string;
    paidAt?: string;
    recipientId?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl">;
  }>;
  delinquencies: Array<{
    _id: string;
    cycleNumber: number;
    amountDue: number;
    liabilityType: string;
    dueDate: string;
    status: string;
    userId?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl">;
  }>;
  resolutions: Array<{
    _id: string;
    status: string;
    requiredYesVotes: number;
    originalPayoutAmount: number;
    proposedPayoutAmount: number;
    attemptNumber: number;
    votes: Array<{ choice: "approve" | "reject" }>;
    expiresAt: string;
  }>;
};

export type AdminCampaign = {
  _id: string;
  title: string;
  category: string;
  coverImageUrl?: string;
  goalAmount: number;
  raisedAmount: number;
  donorCount: number;
  deadline: string;
  isPublic: boolean;
  status: "active" | "completed" | "closed" | "flagged";
  creatorId?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl" | "identityVerification">;
  createdAt: string;
  updatedAt: string;
};

export type CampaignDetail = {
  campaign: AdminCampaign & {
    description: string;
    allowAnonymousDonations: boolean;
    shareSlug: string;
    moderation?: {
      previousStatus?: "active" | null;
      flagReason?: string;
      flaggedAt?: string;
      flaggedBy?: Pick<AdminUser, "_id" | "fullName">;
      restoreReason?: string;
      restoredAt?: string;
      restoredBy?: Pick<AdminUser, "_id" | "fullName">;
    };
  };
  metrics: { progress: number; comments: number; completedDonations: number; failedDonations: number };
  donationStats: Record<string, { count: number; amount: number }>;
  donations: Array<{
    _id: string;
    isAnonymous: boolean;
    displayName: string;
    amount: number;
    message?: string;
    paymentMethod: string;
    paidAt?: string;
    status: string;
    createdAt: string;
    donorId?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl">;
  }>;
  updates: Array<{ _id: string; content: string; createdAt: string; authorId?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl"> }>;
};

export type AuditTargetType = "group" | "campaign" | "user" | "user_report" | "wallet_transaction" | "savings_pot";

export type AuditEntry = {
  _id: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  target: { _id: string; type: AuditTargetType; label: string };
  actorId?: Pick<AdminUser, "_id" | "fullName" | "email" | "avatarUrl" | "role">;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";
export type ReportReason = "scam" | "harassment" | "impersonation" | "misleading" | "inappropriate" | "prohibited" | "other";
export type ReportTargetType = "member" | "campaign";

export type ReportPerson = Pick<AdminUser, "_id" | "fullName" | "email" | "avatarUrl" | "isActive" | "createdAt" | "identityVerification">;

export type AdminReport = {
  _id: string;
  targetType: ReportTargetType;
  reporterId?: ReportPerson;
  reportedUserId?: ReportPerson;
  reportedCampaignId?: Pick<AdminCampaign, "_id" | "title" | "category" | "coverImageUrl" | "status" | "createdAt"> & {
    creatorId?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl">;
  };
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  assignedTo?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl"> | null;
  reviewStartedAt?: string;
  resolutionSummary?: string;
  resolvedAt?: string;
  resolvedBy?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl"> | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportDetail = AdminReport & {
  internalNotes: Array<{
    _id: string;
    authorId?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl">;
    body: string;
    createdAt: string;
  }>;
  decisions: Array<{
    _id: string;
    action: "resolved" | "dismissed" | "reopened";
    summary: string;
    authorId?: Pick<AdminUser, "_id" | "fullName" | "avatarUrl">;
    createdAt: string;
  }>;
};

export type ReportCounts = Record<ReportStatus, number> & { open: number };
