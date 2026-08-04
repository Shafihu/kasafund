import AsyncStorage from "@react-native-async-storage/async-storage";
import { showKycRequired } from "@/stores/useKycGateStore";
import { requestAchievementCheck } from "@/services/achievementEvents";

// Base API configuration
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://172.20.10.3:5050/api";

export const GROUP_AGREEMENT_VERSION = "2026-07-01";

// Types for API requests and responses
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface UserPreferences {
  notifications: boolean;
  darkMode: boolean;
  biometricLogin: boolean;
  analytics: boolean;
  autoBackup: boolean;
  locationServices: boolean;
  language: string;
  country: string;
  currency: string;
  hideWalletBalance: boolean;
  gamifiedSavings: boolean;
  contributionReminders: boolean;
  payoutNotifications: boolean;
  groupInviteNotifications: boolean;
  campaignNotifications: boolean;
  donationNotifications: boolean;
  anonymousDonationsByDefault: boolean;
  allowGroupInvites: boolean;
  publicProfile: boolean;
  showProfileBio: boolean;
  showSharedGroups: boolean;
  showOnLeaderboard: boolean;
  onboardingCompleted: boolean;
}

export interface ApiUser {
  _id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  profileImage?: string;
  bio?: string;
  role?: "user" | "super_admin";
  emailVerified?: boolean;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  identityVerification?: IdentityVerificationStatus;
  paystackCustomerCode?: string;
  walletBalance?: number;
  notificationPrefs?: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  preferences?: UserPreferences;
  createdAt: string;
  updatedAt: string;
  isActive?: boolean;
  lastLoginAt?: string;
}

export type IdentityVerificationState =
  | "not_started"
  | "in_progress"
  | "in_review"
  | "verified"
  | "declined"
  | "expired"
  | "resubmission_required";

export interface IdentityVerificationStatus {
  provider: "didit";
  status: IdentityVerificationState;
  documentType?: string;
  issuingCountry?: string;
  failureReason?: string;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  lastCheckedAt?: string | null;
  alreadyVerified?: boolean;
  sessionUrl?: string;
}

export interface AuthResponse {
  data: {
    user: ApiUser;
    token: string;
    emailVerification?: {
      delivery: "email" | "console" | "unavailable";
      devCode?: string;
    };
  };
  message: string;
  success: boolean;
}

export interface WhatsAppLinkStatus {
  linked: boolean;
  phoneLast4: string;
  linkedAt: string | null;
  configured: boolean;
  businessPhone: string;
}

export interface WhatsAppLinkCode extends WhatsAppLinkStatus {
  code: string;
  linkMessage: string;
  expiresAt: string;
  deepLink: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  phoneNumber?: string;
  profileImage?: string;
  bio?: string;
  preferences?: Partial<UserPreferences>;
  notificationPrefs?: Partial<NonNullable<ApiUser["notificationPrefs"]>>;
}

export type ImageUploadPurpose = "profile" | "group" | "campaign";

export interface LocalImageAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  file?: Blob;
}

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export interface ScanAnalysisRequest {
  image: FormData;
  description?: string;
}

export interface ScanAnalysisResponse {
  id: string;
  userId: string;
  imageUrl: string;
  condition: string;
  confidence: number;
  severity: string;
  description: string;
  symptoms: string[];
  recommendations: {
    title: string;
    description: string;
    icon: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface ScanHistoryResponse {
  scans: ScanAnalysisResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

export type GroupType = "susu" | "family" | "church" | "cooperative" | "other";
export type ContributionFrequency = "daily" | "weekly" | "monthly";

export interface CreateGroupRequest {
  name: string;
  description?: string;
  coverImageUrl?: string;
  type: GroupType;
  contribution: {
    amount: number;
    frequency: ContributionFrequency;
    startDate?: string;
    gracePeriodDays?: number;
    penaltyAmount?: number;
  };
  rotation?: { isEnabled: boolean };
  expectedMemberCount: number;
  creatorPayoutPosition: number;
  isPublic?: boolean;
  agreementAccepted: boolean;
  agreementVersion: string;
}

export interface CreateCampaignRequest {
  title: string;
  description: string;
  category: string;
  coverImageUrl?: string;
  goalAmount: number;
  deadline: string;
  isPublic: boolean;
  allowAnonymousDonations: boolean;
}

export interface UpdateCampaignRequest {
  title?: string;
  description?: string;
  category?: CampaignCategory;
  coverImageUrl?: string;
  isPublic?: boolean;
  allowAnonymousDonations?: boolean;
}

export type CampaignCategory =
  | "medical"
  | "funeral"
  | "wedding"
  | "school_fees"
  | "charity"
  | "community"
  | "disaster_relief"
  | "business"
  | "other";

export interface ApiCampaign {
  _id: string;
  creatorId: { _id: string; fullName: string; avatarUrl?: string };
  title: string;
  description: string;
  category: CampaignCategory;
  coverImageUrl?: string;
  goalAmount: number;
  raisedAmount: number;
  donorCount: number;
  deadline: string;
  isPublic: boolean;
  allowAnonymousDonations: boolean;
  status: "active" | "completed" | "closed" | "flagged";
  shareSlug: string;
  createdAt: string;
}

export interface ApiCampaignDetail {
  campaign: ApiCampaign;
  updates: {
    _id: string;
    authorId: { _id: string; fullName: string; avatarUrl?: string };
    content: string;
    createdAt: string;
  }[];
  comments: {
    _id: string;
    authorId: { _id: string; fullName: string; avatarUrl?: string };
    content: string;
    createdAt: string;
  }[];
  donations: {
    _id: string;
    isAnonymous: boolean;
    displayName: string;
    amount: number;
    message?: string;
    createdAt: string;
  }[];
}

export interface ApiCampaignUpdate {
  _id: string;
  campaignId: string;
  authorId: { _id: string; fullName: string; avatarUrl?: string };
  content: string;
  createdAt: string;
}

export interface ApiDonatedCampaign {
  _id: string;
  amount: number;
  createdAt: string;
  campaignId: ApiCampaign;
}

export interface ApiRecordResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiGroup {
  _id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  type: GroupType;
  memberCount: number;
  totalPot: number;
  status: "setup" | "active" | "paused" | "completed" | "archived";
  expectedMemberCount: number;
  inviteCode?: string;
  isPublic?: boolean;
  unreadChatCount?: number;
  joinRequestStatus?: "pending" | "declined" | "agreement_required" | null;
  contribution: {
    amount: number;
    frequency: ContributionFrequency;
    startDate: string;
    gracePeriodDays?: number;
    penaltyAmount?: number;
  };
  rotation?: {
    isEnabled: boolean;
    order: string[];
    pendingOrder?: string[];
    completedRecipientIds?: string[];
    currentPositionIndex: number;
    roundNumber?: number;
    cycleStartedAt?: string | null;
  };
}

export interface DirectoryUser {
  _id: string;
  fullName: string;
  avatarUrl?: string;
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  points: number;
  earnedAt: string;
}

export interface PendingAchievement extends AchievementBadge {
  achievementId: string;
}

export interface PublicUserProfile {
  user: {
    _id: string;
    fullName: string;
    profileImage?: string;
    bio?: string;
    joinedAt: string;
    isIdentityVerified: boolean;
  };
  sharedGroups: {
    _id: string;
    name: string;
    type: GroupType;
    coverImageUrl?: string;
  }[];
  sharedGroupCount: number;
  isOwnProfile: boolean;
  viewerHasBlocked: boolean;
  visibility: {
    bio: boolean;
    sharedGroups: boolean;
  };
  trustMetrics: {
    score: number;
    level: "new" | "building" | "reliable" | "trusted" | "exceptional";
    identityVerified: boolean;
    accountAgeDays: number;
    activeGroupCount: number | null;
    successfulContributions: number;
    expectedContributions: number;
    contributionReliabilityPercent: number | null;
    onTimeContributionPercent: number | null;
    completedPayouts: number;
    calculatedAt: string;
  };
  achievements: {
    points: number;
    tier: KasaPointTier;
    nextTier: "bronze" | "silver" | "gold" | "platinum" | null;
    pointsToNextTier: number;
    tierProgressPercent: number;
    badges: AchievementBadge[];
  };
}

export type KasaPointTier = "starter" | "bronze" | "silver" | "gold" | "platinum";

export type LeaderboardPeriod = "weekly" | "monthly" | "all";

export interface KasaPointsLeaderboard {
  period: LeaderboardPeriod;
  entries: {
    rank: number;
    userId: string;
    fullName: string;
    avatarUrl?: string;
    identityVerified: boolean;
    points: number;
    tier: KasaPointTier;
  }[];
  viewer: {
    participating: boolean;
    rank: number | null;
    points: number;
    tier: KasaPointTier;
  };
}

export interface ApiGroupInvitation {
  _id: string;
  groupId: ApiGroup;
  invitedBy: {
    _id: string;
    fullName: string;
    avatarUrl?: string;
  };
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface ApiGroupJoinRequest {
  _id: string;
  groupId: { _id: string; name: string };
  userId: {
    _id: string;
    fullName: string;
    avatarUrl?: string;
  };
  status: "pending" | "accepted" | "declined";
  reviewedAt?: string | null;
  agreement?: {
    version: string;
    acceptedAt: string | null;
  };
  createdAt: string;
}

export interface ApiNotification {
  _id: string;
  type:
    | "payment_due"
    | "payment_confirmed"
    | "payout_scheduled"
    | "payout_completed"
    | "campaign_update"
    | "campaign_moderation"
    | "report_update"
    | "donation_received"
    | "invitation"
    | "role_changed"
    | "penalty_applied"
    | "identity_verification"
    | "savings_update"
    | "resolution_created"
    | "resolution_completed"
    | "join_request"
    | "debt_repayment"
    | "contribution_refunded";
  title: string;
  body: string;
  relatedGroupId?: string;
  relatedCampaignId?: string;
  relatedSavingsPotId?: string;
  relatedUserId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ApiGroupDetail {
  group: ApiGroup & {
    ownerId: { _id: string; fullName: string; avatarUrl?: string };
    coverImageUrl?: string;
  };
  membership: {
    _id: string;
    role: "owner" | "treasurer" | "moderator" | "member";
    status: "active" | "removed" | "left";
    autoContribution: AutoContributionSettings;
  } | null;
  members: {
    _id: string;
    userId: { _id: string; fullName: string; avatarUrl?: string };
    role: "owner" | "treasurer" | "moderator" | "member";
    lastContributionStatus: "paid" | "pending" | "late";
    payoutPosition: number | null;
  }[];
  contributions: {
    _id: string;
    userId: { _id: string; fullName: string; avatarUrl?: string };
    amount: number;
    paidAt?: string;
    createdAt: string;
    paymentMethod: "mobile_money" | "card" | "bank_transfer" | "wallet";
  }[];
  payouts: {
    _id: string;
    recipientId: { _id: string; fullName: string; avatarUrl?: string };
    amount: number;
    cycleNumber: number;
    rotationRound: number;
    scheduledDate: string;
    paidAt?: string;
    status: "scheduled" | "processing" | "completed" | "failed";
    fundingStatus?: "awaiting" | "ready" | "overdue";
  }[];
  currentPayoutReadiness: {
    payoutId: string;
    status: "awaiting" | "ready" | "overdue";
    expectedCount: number;
    paidCount: number;
    missingCount: number;
    contributionAmount: number;
    extensionAvailable: boolean;
    graceEndsAt: string | null;
    missingMembers: { userId: string; fullName: string }[];
  } | null;
  developmentSimulation: {
    enabled: true;
    simulatedNow: string | null;
  } | null;
  currentResolution: {
    _id: string;
    status: "voting";
    recipientId: string;
    defaultingMembers: { userId: string; fullName: string }[];
    eligibleVoterCount: number;
    requiredYesVotes: number;
    yesVotes: number;
    noVotes: number;
    currentUserVote: "approve" | "reject" | null;
    canVote: boolean;
    recipientApprovalRequired: true;
    originalPayoutAmount: number;
    proposedPayoutAmount: number;
    expiresAt: string;
    attemptNumber: number;
  } | null;
  unreadChatCount: number;
}

export interface ApiGroupLedger {
  group: {
    _id: string;
    name: string;
    status: ApiGroup["status"];
    contributionAmount: number;
    frequency: ContributionFrequency;
  };
  summary: {
    totalCycles: number;
    completedCycles: number;
    totalCollected: number;
    totalPaidOut: number;
  };
  cycles: {
    _id: string;
    cycleNumber: number;
    rotationRound: number;
    scheduledDate: string;
    graceEndsAt?: string | null;
    contributionAmount: number;
    expectedAmount: number;
    collectedAmount: number;
    shortageAmount: number;
    recipient: { _id: string; fullName: string; avatarUrl?: string } | null;
    payout: {
      status: "scheduled" | "processing" | "completed" | "failed";
      fundingStatus: "awaiting" | "ready" | "overdue";
      scheduledAmount: number;
      actualAmount: number;
      paidAt?: string | null;
      closedAt?: string | null;
      closureReason: "" | "resolution_deadlock";
    };
    members: {
      user: { _id: string; fullName: string; avatarUrl?: string } | null;
      status: "paid" | "pending" | "defaulted" | "refunded";
      amount: number;
      paidAt?: string | null;
      refundedAt?: string | null;
      paymentMethod: "mobile_money" | "card" | "bank_transfer" | "wallet" | null;
      delinquencyStatus: "open" | "paid" | "waived" | "extended" | null;
    }[];
    resolution: {
      _id: string;
      status: "voting" | "approved" | "rejected" | "executed" | "failed" | "expired";
      attemptNumber: number;
      originalPayoutAmount: number;
      proposedPayoutAmount: number;
      yesVotes: number;
      noVotes: number;
      requiredYesVotes: number;
      decidedAt?: string | null;
      createdBy: { _id: string; fullName: string } | null;
    } | null;
  }[];
}

export interface PayoutSimulationState {
  simulatedNow: string | null;
  effectiveNow: string;
  payout: {
    _id: string;
    cycleNumber: number;
    scheduledDate: string;
    graceEndsAt: string;
    status: "scheduled" | "processing" | "completed" | "failed";
    fundingStatus: "awaiting" | "ready" | "overdue";
    expectedCount: number;
    paidCount: number;
    missingCount: number;
  } | null;
}

export interface ApiGroupMessage {
  _id: string;
  groupId: string;
  sender: { _id: string; fullName?: string; avatarUrl?: string };
  text: string;
  type: "text" | "system";
  deletedAt?: string | null;
  createdAt: string;
}

export interface ApiPageResponse<T> {
  success: boolean;
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface DashboardData {
  walletBalance: number;
  unreadNotificationCount: number;
  dueSoon: {
    id: string;
    groupId: string;
    groupName: string;
    amount: number;
    frequency: ContributionFrequency;
    cycleNumber: number;
    dueDate: string;
    status: "pending" | "paid" | "late" | "failed";
  }[];
  groups: {
    id: string;
    name: string;
    type: GroupType;
    status: "active" | "paused" | "completed" | "archived";
    coverImageUrl?: string;
    progress: number;
    memberNames: string[];
    memberCount: number;
    totalPot: number;
    contributionAmount: number;
    frequency: ContributionFrequency;
    nextPayoutDate: string | null;
  }[];
  recentActivity: {
    id: string;
    type: "contribution" | "payout";
    groupId?: string;
    description: string;
    amount: number;
    occurredAt: string;
    status: "pending" | "paid" | "late" | "failed" | "scheduled" | "completed";
  }[];
}

export type WalletTransactionStatus =
  | "initialized"
  | "pending"
  | "completed"
  | "failed"
  | "reversed";

export interface AutoContributionSettings {
  enabled: boolean;
  paymentSource: "wallet";
  enabledAt?: string | null;
  nextRunAt?: string | null;
  lastAttemptAt?: string | null;
  lastAttemptCycleNumber?: number | null;
  lastStatus: "never" | "paid" | "already_paid" | "insufficient_balance" | "failed";
  failureReason?: string;
}

export interface ApiWalletTransaction {
  _id: string;
  type:
    | "deposit"
    | "withdrawal"
    | "payout"
    | "contribution"
    | "contribution_refund"
    | "savings_deposit"
    | "savings_withdrawal"
    | "debt_repayment"
    | "debt_recovery";
  amount: number;
  currency: "GHS";
  status: WalletTransactionStatus;
  reference: string;
  relatedGroupId?: string | null;
  groupName?: string;
  relatedSavingsPotId?: string | null;
  savingsPotName?: string;
  channel?: string;
  transferMode?: "live" | "mock";
  destination?: {
    providerCode?: string;
    providerName?: string;
    accountLast4?: string;
  };
  failureReason?: string;
  completedAt?: string;
  createdAt: string;
}

export interface SavingsPot {
  _id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  contributionAmount: number;
  frequency: "daily" | "weekly" | "monthly";
  nextContributionAt: string;
  targetDate: string;
  mode: "flexible" | "locked";
  status: "active" | "paused" | "completed" | "closed";
  autoSaveEnabled: boolean;
  lastAutoSaveStatus: "never" | "paid" | "insufficient_balance" | "failed";
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsTransaction {
  _id: string;
  type: "deposit" | "withdrawal";
  source: "wallet" | "automatic";
  amount: number;
  balanceAfter: number;
  status: "completed" | "failed";
  createdAt: string;
}

export interface WalletSummary {
  balance: number;
  currency: "GHS";
  transactions: ApiWalletTransaction[];
}

export interface WalletDepositInitialization {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
}

export interface GroupDebt {
  _id: string;
  group: {
    _id: string;
    name: string;
    coverImageUrl?: string;
  };
  creditor: {
    _id: string;
    fullName: string;
    avatarUrl?: string;
  };
  creditors: {
    user: {
      _id: string;
      fullName: string;
      avatarUrl?: string;
    };
    amount: number;
  }[];
  cycleNumber: number;
  amountDue: number;
  dueDate: string;
  createdAt: string;
}

export interface GroupDebtSummary {
  totalAmount: number;
  debts: GroupDebt[];
}

export interface AccountStanding {
  level: "good" | "caution" | "restricted";
  canCreateOrJoinGroups: boolean;
  outstandingAmount: number;
  openObligations: {
    _id: string;
    group: { _id: string; name: string; coverImageUrl?: string };
    creditor?: { _id: string; fullName: string; avatarUrl?: string } | null;
    cycleNumber: number;
    amountDue: number;
    dueDate: string;
    liabilityType: "cycle_default" | "post_payout_debt";
  }[];
  suspendedGroups: {
    _id: string;
    group: { _id: string; name: string; coverImageUrl?: string };
    suspendedAt?: string | null;
    reason: "" | "contribution_default" | "manual";
    rejoinBlocked: boolean;
  }[];
  repaymentHistory: {
    _id: string;
    group: { _id: string; name: string };
    creditor: { _id: string; fullName: string };
    amount: number;
    paymentMethod: "mobile_money" | "card" | "wallet";
    paidAt: string;
  }[];
}

export interface DebtPayment {
  _id: string;
  delinquencyId: string;
  groupId: string;
  amount: number;
  paymentMethod: "mobile_money" | "card" | "wallet";
  reference: string;
  status: "pending" | "paid" | "failed";
  paidAt?: string;
  createdAt: string;
}

export interface DebtPaymentInitialization {
  payment: DebtPayment;
  paymentType: "paystack" | "wallet";
  reference: string;
  authorizationUrl?: string;
}

export interface PayoutProvider {
  code: string;
  name: string;
}

export interface WalletWithdrawalResult {
  transaction: ApiWalletTransaction;
  requiresOtp: boolean;
  transferCode?: string;
  mocked: boolean;
}

export interface ApiContribution {
  _id: string;
  groupId: string;
  userId: string;
  amount: number;
  cycleNumber: number;
  dueDate: string;
  paidAt?: string;
  status: "pending" | "paid" | "late" | "failed" | "refunded";
  refundedAt?: string;
  paymentMethod: "mobile_money" | "card" | "bank_transfer" | "wallet";
  paystackReference: string;
  createdAt: string;
}

export interface ContributionPaymentInitialization {
  contribution: ApiContribution;
  paymentType: "paystack" | "wallet";
  reference: string;
  authorizationUrl?: string;
}

export interface ApiDonation {
  _id: string;
  campaignId: string;
  donorId: string;
  isAnonymous: boolean;
  displayName: string;
  amount: number;
  message?: string;
  paymentMethod: "mobile_money" | "card" | "bank_transfer" | "wallet";
  paystackReference: string;
  status: "pending" | "completed" | "failed" | "refunded";
  paidAt?: string;
  createdAt: string;
}

export interface DonationPaymentInitialization {
  donation: ApiDonation;
  paymentType: "paystack" | "wallet";
  reference: string;
  authorizationUrl?: string;
}

// API Service Class
class ApiService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem("@KasaFund:authToken");
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  }

  private async setAuthToken(token: string | undefined): Promise<void> {
    try {
      if (token) {
        await AsyncStorage.setItem("@KasaFund:authToken", token);
      } else {
        console.warn("No token provided to setAuthToken");
      }
    } catch (error) {
      console.error("Error setting auth token:", error);
    }
  }

  private async removeAuthToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem("@KasaFund:authToken");
    } catch (error) {
      console.error("Error removing auth token:", error);
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    const url = `${this.baseURL}${endpoint}`;

    const isFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    const headers: HeadersInit = {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const responseText = await response.text();
        let errorData: { action?: string; code?: string; message?: string } = {};

        try {
          errorData = responseText ? JSON.parse(responseText) : {};
        } catch {
          errorData = { message: responseText || `HTTP ${response.status}` };
        }

        if (errorData.code === "KYC_REQUIRED") {
          showKycRequired(errorData.action);
        } else if (response.status === 401) {
          await this.removeAuthToken();
        } else if (response.status === 404) {
          console.log(
            "ℹ️ Endpoint not implemented:",
            response.status,
            errorData.message
          );
        } else {
          console.error("❌ API Error:", response.status, errorData);
        }

        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      if (response.status === 204) return undefined as T;
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      throw error;
    }
  }

  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    console.log("🔐 Attempting login with:", credentials.email);
    const response = await this.makeRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    await this.setAuthToken(response.data.token);
    return response;
  }

  async signup(userData: SignupRequest): Promise<AuthResponse> {
    console.log("📝 Attempting signup with:", userData.email);
    const response = await this.makeRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });

    await this.setAuthToken(response.data.token);
    return response;
  }

  async googleLogin(credentials: GoogleLoginRequest): Promise<AuthResponse> {
    const response = await this.makeRequest<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    await this.setAuthToken(response.data.token);
    return response;
  }

  async verifyEmail(code: string): Promise<{
    success: boolean;
    message: string;
    data: { user: ApiUser };
  }> {
    return await this.makeRequest("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }

  async resendEmailVerification(): Promise<{
    success: boolean;
    message: string;
    data?: { emailVerification?: AuthResponse["data"]["emailVerification"] };
  }> {
    return await this.makeRequest("/auth/email/resend", { method: "POST" });
  }

  async logout(): Promise<void> {
    try {
      await this.makeRequest("/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      await this.removeAuthToken();
    }
  }

  async getProfile(): Promise<AuthResponse["data"]["user"]> {
    return await this.makeRequest<AuthResponse["data"]["user"]>(
      "/auth/profile"
    );
  }

  async getWhatsAppLinkStatus(): Promise<WhatsAppLinkStatus> {
    const response = await this.makeRequest<{
      success: boolean;
      data: WhatsAppLinkStatus;
    }>("/whatsapp/link");
    return response.data;
  }

  async createWhatsAppLinkCode(): Promise<WhatsAppLinkCode> {
    const response = await this.makeRequest<{
      success: boolean;
      data: WhatsAppLinkCode;
    }>("/whatsapp/link/code", { method: "POST" });
    return response.data;
  }

  async unlinkWhatsApp(): Promise<void> {
    await this.makeRequest("/whatsapp/link", { method: "DELETE" });
  }

  async updateProfile(
    updates: UpdateProfileRequest
  ): Promise<AuthResponse["data"]["user"]> {
    console.log("📝 Attempting profile update with:", updates);
    const response = await this.makeRequest<AuthResponse["data"]["user"]>(
      "/auth/profile",
      {
        method: "PUT",
        body: JSON.stringify(updates),
      }
    );
    console.log("📝 Profile update response:", response);
    return response;
  }

  async uploadImage(
    asset: LocalImageAsset,
    purpose: ImageUploadPurpose
  ): Promise<ApiRecordResponse<UploadedImage>> {
    const formData = new FormData();
    formData.append("purpose", purpose);
    const file = asset.file || ({
      uri: asset.uri,
      type: asset.mimeType || "image/jpeg",
      name: asset.fileName || `${purpose}-${Date.now()}.jpg`,
    } as unknown as Blob);
    formData.append("image", file);
    return this.makeRequest<ApiRecordResponse<UploadedImage>>("/uploads/image", {
      method: "POST",
      body: formData,
    });
  }

  async changePassword(passwords: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.makeRequest<{ success: boolean; message: string }>(
      "/auth/password",
      {
        method: "PATCH",
        body: JSON.stringify(passwords),
      }
    );
  }

  async deleteProfileImage(): Promise<void> {
    console.log("🗑️ Deleting profile image...");
    await this.makeRequest("/auth/profile/image", {
      method: "DELETE",
    });
    console.log("🗑️ Profile image deleted successfully");
  }

  async startIdentityVerification(): Promise<ApiRecordResponse<IdentityVerificationStatus>> {
    return this.makeRequest<ApiRecordResponse<IdentityVerificationStatus>>("/kyc/session", {
      method: "POST",
    });
  }

  async getIdentityVerificationStatus(): Promise<ApiRecordResponse<IdentityVerificationStatus>> {
    return this.makeRequest<ApiRecordResponse<IdentityVerificationStatus>>("/kyc/status");
  }

  async createGroup(group: CreateGroupRequest) {
    return this.makeRequest<ApiRecordResponse<ApiGroup>>(
      "/groups",
      { method: "POST", body: JSON.stringify(group) }
    );
  }

  async createCampaign(campaign: CreateCampaignRequest) {
    return this.makeRequest<ApiRecordResponse<Record<string, unknown>>>(
      "/campaigns",
      { method: "POST", body: JSON.stringify(campaign) }
    );
  }

  async updateCampaign(campaignId: string, updates: UpdateCampaignRequest) {
    return this.makeRequest<ApiRecordResponse<ApiCampaign>>(
      `/campaigns/${campaignId}`,
      { method: "PATCH", body: JSON.stringify(updates) }
    );
  }

  async addCampaignUpdate(campaignId: string, content: string) {
    return this.makeRequest<ApiRecordResponse<ApiCampaignUpdate>>(
      `/campaigns/${campaignId}/updates`,
      { method: "POST", body: JSON.stringify({ content }) }
    );
  }

  async getCampaign(campaignIdOrSlug: string) {
    return this.makeRequest<ApiRecordResponse<ApiCampaignDetail>>(
      `/campaigns/${campaignIdOrSlug}`
    );
  }

  async getCampaigns(mine = false) {
    return this.makeRequest<ApiPageResponse<ApiCampaign>>(
      `/campaigns${mine ? "?mine=true" : ""}`
    );
  }

  async getDonatedCampaigns() {
    return this.makeRequest<ApiPageResponse<ApiDonatedCampaign>>("/campaigns/donated");
  }

  async startDonation(
    campaignId: string,
    donation: {
      amount: number;
      isAnonymous: boolean;
      message?: string;
      paymentMethod: "mobile_money" | "card" | "wallet";
      callbackUrl?: string;
    }
  ) {
    return this.makeRequest<ApiRecordResponse<DonationPaymentInitialization>>(
      `/campaigns/${campaignId}/donations`,
      { method: "POST", body: JSON.stringify(donation) }
    );
  }

  async verifyDonation(campaignId: string, reference: string) {
    return this.makeRequest<ApiRecordResponse<ApiDonation>>(
      `/campaigns/${campaignId}/donations/${encodeURIComponent(reference)}/verify`,
      { method: "POST" }
    );
  }

  async getDashboard() {
    return this.makeRequest<ApiRecordResponse<DashboardData>>("/dashboard");
  }

  async getWallet() {
    return this.makeRequest<ApiRecordResponse<WalletSummary>>("/payments/wallet");
  }

  async getGroupDebts() {
    return this.makeRequest<ApiRecordResponse<GroupDebtSummary>>("/payments/debts");
  }

  async startDebtRepayment(
    debtId: string,
    payment: {
      paymentMethod: "mobile_money" | "card" | "wallet";
      callbackUrl?: string;
    }
  ) {
    return this.makeRequest<ApiRecordResponse<DebtPaymentInitialization>>(
      `/payments/debts/${debtId}/repay`,
      { method: "POST", body: JSON.stringify(payment) }
    );
  }

  async verifyDebtRepayment(debtId: string, reference: string) {
    return this.makeRequest<ApiRecordResponse<DebtPayment>>(
      `/payments/debts/${debtId}/repayments/${encodeURIComponent(reference)}/verify`,
      { method: "POST" }
    );
  }

  async getSavingsPots() {
    return this.makeRequest<ApiRecordResponse<SavingsPot[]>>("/savings");
  }

  async getSavingsPot(potId: string) {
    return this.makeRequest<
      ApiRecordResponse<{ pot: SavingsPot; transactions: SavingsTransaction[] }>
    >(`/savings/${potId}`);
  }

  async createSavingsPot(input: {
    name: string;
    targetAmount: number;
    contributionAmount: number;
    frequency: SavingsPot["frequency"];
    targetDate: string;
    mode: SavingsPot["mode"];
    autoSaveEnabled: boolean;
  }) {
    return this.makeRequest<ApiRecordResponse<SavingsPot>>("/savings", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateSavingsPot(
    potId: string,
    updates: { autoSaveEnabled?: boolean; status?: "active" | "paused" }
  ) {
    return this.makeRequest<ApiRecordResponse<SavingsPot>>(`/savings/${potId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async depositToSavings(potId: string, amount: number) {
    return this.makeRequest<
      ApiRecordResponse<{ pot: SavingsPot; walletBalance: number }>
    >(`/savings/${potId}/deposits`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  async withdrawSavings(potId: string, amount: number) {
    return this.makeRequest<
      ApiRecordResponse<{ pot: SavingsPot; walletBalance: number }>
    >(`/savings/${potId}/withdrawals`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  async initializeWalletDeposit(amount: number, callbackUrl?: string) {
    return this.makeRequest<ApiRecordResponse<WalletDepositInitialization>>(
      "/payments/wallet/deposits",
      { method: "POST", body: JSON.stringify({ amount, callbackUrl }) }
    );
  }

  async verifyWalletDeposit(reference: string) {
    return this.makeRequest<ApiRecordResponse<ApiWalletTransaction>>(
      `/payments/wallet/deposits/${encodeURIComponent(reference)}/verify`,
      { method: "POST" }
    );
  }

  async getPayoutProviders() {
    return this.makeRequest<ApiRecordResponse<PayoutProvider[]>>(
      "/payments/wallet/payout-providers"
    );
  }

  async createWalletWithdrawal(withdrawal: {
    amount: number;
    accountNumber: string;
    providerCode: string;
    providerName: string;
  }) {
    return this.makeRequest<ApiRecordResponse<WalletWithdrawalResult>>(
      "/payments/wallet/withdrawals",
      { method: "POST", body: JSON.stringify(withdrawal) }
    );
  }

  async finalizeWalletWithdrawal(reference: string, otp: string) {
    return this.makeRequest<ApiRecordResponse<ApiWalletTransaction>>(
      `/payments/wallet/withdrawals/${encodeURIComponent(reference)}/finalize`,
      { method: "POST", body: JSON.stringify({ otp }) }
    );
  }

  async discoverGroups() {
    return this.makeRequest<ApiPageResponse<ApiGroup>>("/groups/discover");
  }

  async getMyGroups() {
    return this.makeRequest<ApiPageResponse<ApiGroup>>("/groups");
  }

  async getGroup(groupId: string) {
    return this.makeRequest<ApiRecordResponse<ApiGroupDetail>>(
      `/groups/${groupId}`
    );
  }

  async getGroupLedger(groupId: string) {
    return this.makeRequest<ApiRecordResponse<ApiGroupLedger>>(
      `/groups/${groupId}/ledger`
    );
  }

  async getGroupMessages(groupId: string, before?: string) {
    const query = before ? `?before=${encodeURIComponent(before)}` : "";
    return this.makeRequest<ApiRecordResponse<ApiGroupMessage[]>>(
      `/groups/${groupId}/messages${query}`
    );
  }

  async markGroupChatRead(groupId: string) {
    return this.makeRequest<ApiRecordResponse<{ unreadCount: number }>>(
      `/groups/${groupId}/messages/read`,
      { method: "POST" }
    );
  }

  async getGroupChatUnreadCount(groupId: string) {
    return this.makeRequest<ApiRecordResponse<{ unreadCount: number }>>(
      `/groups/${groupId}/messages/unread`
    );
  }

  async deleteGroupMessage(groupId: string, messageId: string) {
    return this.makeRequest<ApiRecordResponse<ApiGroupMessage>>(
      `/groups/${groupId}/messages/${messageId}`,
      { method: "DELETE" }
    );
  }

  async updateAutoContribution(groupId: string, enabled: boolean) {
    return this.makeRequest<ApiRecordResponse<AutoContributionSettings>>(
      `/groups/${groupId}/auto-contribution`,
      { method: "PATCH", body: JSON.stringify({ enabled }) }
    );
  }

  async extendPayoutGrace(groupId: string, payoutId: string, days: number) {
    return this.makeRequest<ApiRecordResponse<ApiGroupDetail["payouts"][number]>>(
      `/groups/${groupId}/payouts/${payoutId}/extend-grace`,
      { method: "POST", body: JSON.stringify({ days }) }
    );
  }

  async setPayoutSimulationStage(
    groupId: string,
    stage:
      | "before_due"
      | "due"
      | "grace"
      | "overdue"
      | "resolution_expired"
      | "reset"
  ) {
    return this.makeRequest<ApiRecordResponse<PayoutSimulationState>>(
      `/dev/groups/${groupId}/payout-simulation/time`,
      { method: "POST", body: JSON.stringify({ stage }) }
    );
  }

  async runPayoutSimulation(
    groupId: string,
    processor: "auto_contributions" | "payout" | "all" = "all"
  ) {
    return this.makeRequest<ApiRecordResponse<{
      autoContributions: {
        userId: string;
        processed: boolean;
        reason: string | null;
      }[];
      expiredResolutions: number;
      deadlockClosed: boolean;
      payout: {
        processed: boolean;
        reason: string | null;
        missingCount: number;
      } | null;
      state: PayoutSimulationState;
    }>>(
      `/dev/groups/${groupId}/payout-simulation/run`,
      {
        method: "POST",
        body: JSON.stringify({ processor, confirm: true }),
      }
    );
  }

  async createGroupResolution(groupId: string) {
    return this.makeRequest<ApiRecordResponse<{ _id: string; status: string }>>(
      `/groups/${groupId}/resolutions`,
      { method: "POST", body: JSON.stringify({}) }
    );
  }

  async voteOnGroupResolution(
    groupId: string,
    resolutionId: string,
    choice: "approve" | "reject"
  ) {
    return this.makeRequest<ApiRecordResponse<{
      resolution: { _id: string; status: string };
      yesVotes: number;
      noVotes: number;
      recipientVote: "approve" | "reject" | null;
      payoutProcessed: boolean;
    }>>(
      `/groups/${groupId}/resolutions/${resolutionId}/vote`,
      { method: "POST", body: JSON.stringify({ choice }) }
    );
  }

  async startGroupContribution(
    groupId: string,
    payment: {
      paymentMethod: "mobile_money" | "card" | "wallet";
      callbackUrl?: string;
    }
  ) {
    const response = await this.makeRequest<ApiRecordResponse<ContributionPaymentInitialization>>(
      `/groups/${groupId}/contributions`,
      { method: "POST", body: JSON.stringify(payment) }
    );
    requestAchievementCheck();
    return response;
  }

  async verifyGroupContribution(groupId: string, reference: string) {
    const response = await this.makeRequest<ApiRecordResponse<ApiContribution>>(
      `/groups/${groupId}/contributions/${encodeURIComponent(reference)}/verify`,
      { method: "POST" }
    );
    requestAchievementCheck();
    return response;
  }

  async getPendingAchievement() {
    return this.makeRequest<ApiRecordResponse<PendingAchievement | null>>(
      "/users/me/achievements/pending"
    );
  }

  async getAccountStanding() {
    return this.makeRequest<ApiRecordResponse<AccountStanding>>("/users/me/standing");
  }

  async getKasaPointsLeaderboard(period: LeaderboardPeriod = "weekly") {
    return this.makeRequest<ApiRecordResponse<KasaPointsLeaderboard>>(
      `/users/leaderboard?period=${period}`
    );
  }

  async markAchievementPresented(achievementId: string) {
    return this.makeRequest<void>(
      `/users/me/achievements/${encodeURIComponent(achievementId)}/presented`,
      { method: "PATCH" }
    );
  }

  async updateGroup(
    groupId: string,
    updates: {
      name?: string;
      description?: string;
      coverImageUrl?: string;
      isPublic?: boolean;
      status?: ApiGroup["status"];
      expectedMemberCount?: number;
      contribution?: {
        amount: number;
        frequency: ContributionFrequency;
        gracePeriodDays: number;
        penaltyAmount: number;
      };
    }
  ) {
    return this.makeRequest<ApiRecordResponse<ApiGroup>>(`/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async reorderGroupRotation(groupId: string, order: string[]) {
    return this.makeRequest<ApiRecordResponse<ApiGroup>>(`/groups/${groupId}/rotation`, {
      method: "PUT",
      body: JSON.stringify({ order }),
    });
  }

  async activateGroup(groupId: string, order: string[]) {
    return this.makeRequest<ApiRecordResponse<ApiGroup>>(`/groups/${groupId}/activate`, {
      method: "POST",
      body: JSON.stringify({ order }),
    });
  }

  async leaveGroup(groupId: string) {
    return this.makeRequest<void>(`/groups/${groupId}/members/me`, {
      method: "DELETE",
    });
  }

  async updateGroupMemberRole(
    groupId: string,
    userId: string,
    role: "treasurer" | "moderator" | "member"
  ) {
    return this.makeRequest<ApiRecordResponse<Record<string, unknown>>>(
      `/groups/${groupId}/members/${userId}/role`,
      { method: "PATCH", body: JSON.stringify({ role }) }
    );
  }

  async getUserDirectory(search = "") {
    const query = search.trim()
      ? `?search=${encodeURIComponent(search.trim())}`
      : "";
    return this.makeRequest<ApiRecordResponse<DirectoryUser[]>>(
      `/users/directory${query}`
    );
  }

  async getPublicUserProfile(userId: string) {
    return this.makeRequest<ApiRecordResponse<PublicUserProfile>>(
      `/users/${encodeURIComponent(userId)}`
    );
  }

  async reportUser(
    userId: string,
    report: {
      reason: "scam" | "harassment" | "impersonation" | "inappropriate" | "other";
      details?: string;
    }
  ) {
    return this.makeRequest<ApiRecordResponse<{ _id: string; status: string }>>(
      `/users/${encodeURIComponent(userId)}/report`,
      { method: "POST", body: JSON.stringify(report) }
    );
  }

  async reportCampaign(
    campaignId: string,
    report: {
      reason: "scam" | "misleading" | "inappropriate" | "prohibited" | "other";
      details: string;
    }
  ) {
    return this.makeRequest<ApiRecordResponse<{ _id: string; status: string }>>(
      `/campaigns/${encodeURIComponent(campaignId)}/report`,
      { method: "POST", body: JSON.stringify(report) }
    );
  }

  async blockUser(userId: string) {
    return this.makeRequest<ApiRecordResponse<never>>(
      `/users/${encodeURIComponent(userId)}/block`,
      { method: "POST" }
    );
  }

  async unblockUser(userId: string) {
    return this.makeRequest<ApiRecordResponse<never>>(
      `/users/${encodeURIComponent(userId)}/block`,
      { method: "DELETE" }
    );
  }

  async inviteGroupMember(
    groupId: string,
    invitation: { userId: string; payoutPosition: number }
  ) {
    return this.makeRequest<ApiRecordResponse<ApiGroupInvitation>>(
      `/groups/${groupId}/invitations`,
      { method: "POST", body: JSON.stringify(invitation) }
    );
  }

  async getGroupJoinPreview(inviteCode: string) {
    return this.makeRequest<
      ApiRecordResponse<{
        group: ApiGroup;
        agreementVersion: string;
      }>
    >(`/groups/join-preview?inviteCode=${encodeURIComponent(inviteCode)}`);
  }

  async joinGroupByCode(inviteCode: string, agreementAccepted: boolean) {
    return this.makeRequest<ApiRecordResponse<ApiGroup>>("/groups/join", {
      method: "POST",
      body: JSON.stringify({
        inviteCode,
        agreementAccepted,
        agreementVersion: GROUP_AGREEMENT_VERSION,
      }),
    });
  }

  async getGroupInvitations() {
    return this.makeRequest<ApiRecordResponse<ApiGroupInvitation[]>>(
      "/groups/invitations"
    );
  }

  async joinPublicGroup(groupId: string, agreementAccepted: boolean) {
    return this.makeRequest<ApiRecordResponse<ApiGroupJoinRequest>>(`/groups/${groupId}/join`, {
      method: "POST",
      body: JSON.stringify({
        agreementAccepted,
        agreementVersion: GROUP_AGREEMENT_VERSION,
      }),
    });
  }

  async getGroupAccess(groupId: string) {
    return this.makeRequest<
      ApiRecordResponse<{
        canView: boolean;
        reason: "suspended" | "unavailable" | "not_a_member" | null;
        membershipStatus: "active" | "suspended" | "removed" | "left" | null;
      }>
    >(`/groups/${groupId}/access`);
  }

  async getGroupJoinRequest(groupId: string, userId: string) {
    return this.makeRequest<ApiRecordResponse<ApiGroupJoinRequest>>(
      `/groups/${groupId}/join-requests/${userId}`
    );
  }

  async respondToGroupJoinRequest(groupId: string, userId: string, accept: boolean) {
    return this.makeRequest<ApiRecordResponse<ApiGroupJoinRequest>>(
      `/groups/${groupId}/join-requests/${userId}/respond`,
      { method: "POST", body: JSON.stringify({ accept }) }
    );
  }

  async respondToGroupInvitation(
    invitationId: string,
    accept: boolean,
    agreementAccepted = false
  ) {
    return this.makeRequest<ApiRecordResponse<ApiGroupInvitation>>(
      `/groups/invitations/${invitationId}/respond`,
      {
        method: "POST",
        body: JSON.stringify({
          accept,
          ...(accept
            ? {
                agreementAccepted,
                agreementVersion: GROUP_AGREEMENT_VERSION,
              }
            : {}),
        }),
      }
    );
  }

  async getNotifications(unreadOnly = false) {
    return this.makeRequest<ApiPageResponse<ApiNotification>>(
      `/notifications${unreadOnly ? "?unread=true" : ""}`
    );
  }

  async markNotificationRead(notificationId: string) {
    return this.makeRequest<ApiRecordResponse<ApiNotification>>(
      `/notifications/${notificationId}/read`,
      { method: "PATCH" }
    );
  }

  async markAllNotificationsRead() {
    return this.makeRequest<void>("/notifications/read-all", { method: "PATCH" });
  }

  // Scan analysis endpoints
  async analyzeScan(
    imageFile: File,
    description?: string
  ): Promise<ScanAnalysisResponse> {
    const formData = new FormData();
    formData.append("image", imageFile);
    if (description) {
      formData.append("description", description);
    }

    return await this.makeRequest<ScanAnalysisResponse>("/scans/analyze", {
      method: "POST",
      headers: {}, // Let browser set Content-Type for FormData
      body: formData,
    });
  }

  async saveScan(
    scanData: Omit<
      ScanAnalysisResponse,
      "id" | "userId" | "createdAt" | "updatedAt"
    >
  ): Promise<ScanAnalysisResponse> {
    return await this.makeRequest<ScanAnalysisResponse>("/scans", {
      method: "POST",
      body: JSON.stringify(scanData),
    });
  }

  async getScanHistory(
    page: number = 1,
    limit: number = 20
  ): Promise<ScanHistoryResponse> {
    return await this.makeRequest<ScanHistoryResponse>(
      `/scans/history?page=${page}&limit=${limit}`
    );
  }

  async getScanById(id: string): Promise<ScanAnalysisResponse> {
    return await this.makeRequest<ScanAnalysisResponse>(`/scans/${id}`);
  }

  async deleteScan(id: string): Promise<void> {
    await this.makeRequest(`/scans/${id}`, {
      method: "DELETE",
    });
  }

  // Utility methods
  async hasAuthToken(): Promise<boolean> {
    return Boolean(await this.getAuthToken());
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return false;

    try {
      await this.getProfile();
      return true;
    } catch {
      await this.removeAuthToken();
      return false;
    }
  }

  async refreshToken(): Promise<void> {
    try {
      const response = await this.makeRequest<{ token: string }>(
        "/auth/refresh",
        {
          method: "POST",
        }
      );
      await this.setAuthToken(response.token);
    } catch (error) {
      await this.removeAuthToken();
      throw error;
    }
  }
}

// Create singleton instance
export const apiService = new ApiService();

// Hook for easy API service access
export const useApiService = () => apiService;
