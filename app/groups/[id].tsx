import { ThemedText } from "@/components/themed-text";
import { AutoContributionModal } from "@/components/groups/AutoContributionModal";
import { KasaButton, KasaCard, KasaSectionHeader, KasaStateView, KasaStatusBadge } from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { useKycGate } from "@/hooks/useKycGate";
import { AnimatedLoader } from "@/components/ui/AnimatedLoader";
import { apiService, type ApiGroupDetail, type ApiGroupMessage, type AutoContributionSettings, type DirectoryUser } from "@/services/apiService";
import { createChatSocket } from "@/services/chatSocket";
import { useAuthStore } from "@/stores/useAuthStore";
import { consumeGroupRefresh } from "@/utils/group-refresh";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

const COLORS = {
  primary: kasaColors.brand,
  primaryDark: kasaColors.brandStrong,
  accent: kasaColors.accent,
  background: "#FFFFFF",
  surface: "#F6F8F7",
  border: kasaColors.border,
  text: kasaColors.text,
  textMuted: kasaColors.textMuted,
  placeholder: "#9AA8A3",
  success: kasaColors.success,
  successSurface: kasaColors.successSoft,
  warning: kasaColors.warning,
  warningSurface: kasaColors.warningSoft,
  error: kasaColors.danger,
  errorSurface: kasaColors.dangerSoft,
};

type TabKey = "overview" | "members" | "contributions" | "payouts" | "settings";

type MemberStatus = "paid" | "pending" | "late";

type MemberRow = {
  id: string;
  userId?: string;
  name: string;
  avatar?: string;
  role: "owner" | "treasurer" | "member";
  status: MemberStatus;
  payoutPosition: number;
};

type ContributionRow = {
  id: string;
  memberName: string;
  amount: string;
  date: string;
  method: string;
};

type PayoutRow = {
  id: string;
  memberName: string;
  amount: string;
  date: string;
  status: "completed" | "upcoming" | "failed";
};

type GroupDetailData = {
  id?: string;
  name: string;
  type: string;
  savingModel?: ApiGroupDetail["group"]["savingModel"];
  collectiveGoal?: ApiGroupDetail["group"]["collectiveGoal"];
  collectiveProposal?: ApiGroupDetail["currentCollectiveProposal"];
  collectivePayouts?: ApiGroupDetail["collectivePayoutProposals"];
  coverColor: string;
  coverImageUrl?: string;
  potAmount: string;
  goalAmount: string;
  progress: number;
  nextPayoutDate: string;
  nextPayoutMember: string;
  payoutReadiness?: ApiGroupDetail["currentPayoutReadiness"];
  resolution?: ApiGroupDetail["currentResolution"];
  contributionAmount: string;
  frequency: string;
  memberCount: number;
  expectedMemberCount: number;
  status: ApiGroupDetail["group"]["status"];
  inviteCode?: string;
  unreadChatCount?: number;
  developmentSimulation?: ApiGroupDetail["developmentSimulation"];
  members: MemberRow[];
  contributions: ContributionRow[];
  payouts: PayoutRow[];
};

// TEMP: mock "database" keyed by group id — matches the ids used in
// (tabs)/groups.tsx (MY_GROUPS). Replace this whole map with your real
// fetch (API call / store lookup) once wired up: e.g.
//   const { data: group } = useGroupQuery(id)
const GROUPS_BY_ID: Record<string, GroupDetailData> = {
  "1": {
    name: "Family Susu",
    type: "Susu · Weekly",
    coverColor: "#0B4D3E",
    potAmount: "GH₵ 3,600",
    goalAmount: "GH₵ 5,000",
    progress: 0.72,
    nextPayoutDate: "Jul 24",
    nextPayoutMember: "Kwabena Boadi",
    contributionAmount: "GH₵ 200",
    frequency: "Weekly",
    memberCount: 8,
    expectedMemberCount: 8,
    status: "active",
    members: [
      { id: "1", name: "You", avatar: "https://i.pravatar.cc/100?img=1", role: "owner", status: "paid", payoutPosition: 3 },
      { id: "2", name: "Kwabena Boadi", avatar: "https://i.pravatar.cc/100?img=2", role: "treasurer", status: "paid", payoutPosition: 1 },
      { id: "3", name: "Efua Mensah", avatar: "https://i.pravatar.cc/100?img=3", role: "member", status: "pending", payoutPosition: 2 },
      { id: "4", name: "Kofi Antwi", avatar: "https://i.pravatar.cc/100?img=4", role: "member", status: "late", payoutPosition: 4 },
      { id: "5", name: "Abena Owusu", avatar: "https://i.pravatar.cc/100?img=5", role: "member", status: "paid", payoutPosition: 5 },
    ],
    contributions: [
      { id: "c1", memberName: "Kwabena Boadi", amount: "GH₵ 200", date: "Jul 17", method: "Mobile Money" },
      { id: "c2", memberName: "You", amount: "GH₵ 200", date: "Jul 17", method: "Card" },
      { id: "c3", memberName: "Abena Owusu", amount: "GH₵ 200", date: "Jul 16", method: "Mobile Money" },
      { id: "c4", memberName: "Efua Mensah", amount: "GH₵ 200", date: "Jul 10", method: "Mobile Money" },
    ],
    payouts: [
      { id: "p1", memberName: "Kwabena Boadi", amount: "GH₵ 1,600", date: "Jul 3", status: "completed" },
      { id: "p2", memberName: "Efua Mensah", amount: "GH₵ 1,600", date: "Jul 24", status: "upcoming" },
      { id: "p3", memberName: "You", amount: "GH₵ 1,600", date: "Aug 14", status: "upcoming" },
    ],
  },
  "2": {
    name: "Church Building Fund",
    type: "Cooperative · Monthly",
    coverColor: "#8A5E2B",
    potAmount: "GH₵ 12,000",
    goalAmount: "GH₵ 30,000",
    progress: 0.45,
    nextPayoutDate: "Aug 3",
    nextPayoutMember: "Kofi Antwi",
    contributionAmount: "GH₵ 500",
    frequency: "Monthly",
    memberCount: 24,
    expectedMemberCount: 24,
    status: "active",
    members: [
      { id: "1", name: "You", avatar: "https://i.pravatar.cc/100?img=1", role: "member", status: "paid", payoutPosition: 6 },
      { id: "6", name: "Kofi Antwi", avatar: "https://i.pravatar.cc/100?img=6", role: "owner", status: "paid", payoutPosition: 1 },
    ],
    contributions: [
      { id: "c1", memberName: "Kofi Antwi", amount: "GH₵ 500", date: "Jul 5", method: "Bank Transfer" },
      { id: "c2", memberName: "You", amount: "GH₵ 500", date: "Jul 4", method: "Mobile Money" },
    ],
    payouts: [
      { id: "p1", memberName: "Kofi Antwi", amount: "GH₵ 12,000", date: "Jun 1", status: "completed" },
      { id: "p2", memberName: "You", amount: "GH₵ 12,000", date: "Aug 3", status: "upcoming" },
    ],
  },
  "3": {
    name: "Office Susu Club",
    type: "Susu · Monthly",
    coverColor: "#5B4A8A",
    potAmount: "GH₵ 6,000",
    goalAmount: "GH₵ 24,000",
    progress: 0.2,
    nextPayoutDate: "Jul 21",
    nextPayoutMember: "You",
    contributionAmount: "GH₵ 500",
    frequency: "Monthly",
    memberCount: 12,
    expectedMemberCount: 12,
    status: "active",
    members: [
      { id: "1", name: "You", avatar: "https://i.pravatar.cc/100?img=1", role: "member", status: "late", payoutPosition: 2 },
      { id: "7", name: "Abena Owusu", avatar: "https://i.pravatar.cc/100?img=7", role: "owner", status: "paid", payoutPosition: 1 },
    ],
    contributions: [
      { id: "c1", memberName: "Abena Owusu", amount: "GH₵ 500", date: "Jun 21", method: "Mobile Money" },
    ],
    payouts: [
      { id: "p1", memberName: "Abena Owusu", amount: "GH₵ 6,000", date: "Jun 21", status: "completed" },
      { id: "p2", memberName: "You", amount: "GH₵ 6,000", date: "Jul 21", status: "upcoming" },
    ],
  },
};

function formatMoney(amountInPesewas: number) {
  return `GH₵ ${(amountInPesewas / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
  });
}

function formatPaymentMethod(method: string) {
  return method
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapGroupDetail(data: ApiGroupDetail): GroupDetailData {
  const { group } = data;
  const target = group.contribution.amount * Math.max(group.memberCount, 1);
  const nextPayout = data.payouts.find((payout) => payout.status === "scheduled");
  const coverColor = {
    susu: "#0B4D3E",
    family: "#8A5E2B",
    church: "#5B4A8A",
    cooperative: "#2B5B8A",
    other: "#576460",
  }[group.type];

  return {
    id: group._id,
    name: group.name,
    type: `${group.type} · ${group.contribution.frequency}`,
    savingModel: group.savingModel || "rotational",
    collectiveGoal: group.collectiveGoal,
    collectiveProposal: data.currentCollectiveProposal,
    collectivePayouts: data.collectivePayoutProposals || [],
    coverColor,
    coverImageUrl: group.coverImageUrl,
    potAmount: formatMoney(group.totalPot),
    goalAmount: formatMoney(group.collectiveGoal?.targetAmount || target),
    progress: group.collectiveGoal?.targetAmount
      ? Math.min(group.collectiveGoal.totalSaved / group.collectiveGoal.targetAmount, 1)
      : target ? Math.min(group.totalPot / target, 1) : 0,
    nextPayoutDate: formatDate(nextPayout?.scheduledDate),
    nextPayoutMember: nextPayout?.recipientId?.fullName || "Not assigned",
    payoutReadiness: data.currentPayoutReadiness,
    resolution: data.currentResolution,
    contributionAmount: formatMoney(
      data.currentPayoutReadiness?.contributionAmount ||
        group.contribution.amount
    ),
    frequency: group.contribution.frequency,
    memberCount: group.memberCount,
    expectedMemberCount: group.expectedMemberCount,
    status: group.status,
    inviteCode: group.inviteCode,
    unreadChatCount: data.unreadChatCount || 0,
    developmentSimulation: data.developmentSimulation,
    members: data.members.map((member) => ({
      id: member._id,
      userId: member.userId?._id || "",
      name: member.userId?.fullName || "Member",
      avatar: member.userId?.avatarUrl,
      role: member.role === "moderator" ? "member" : member.role,
      status: member.lastContributionStatus,
      payoutPosition: (member.payoutPosition ?? 0) + 1,
    })),
    contributions: data.contributions.map((contribution) => ({
      id: contribution._id,
      memberName: contribution.userId?.fullName || "Member",
      amount: formatMoney(contribution.amount),
      date: formatDate(contribution.paidAt || contribution.createdAt),
      method: formatPaymentMethod(contribution.paymentMethod),
    })),
    payouts: data.payouts.map((payout) => ({
      id: payout._id,
      memberName: payout.recipientId?.fullName || "Member",
      amount: formatMoney(payout.amount),
      date: formatDate(payout.paidAt || payout.scheduledDate),
      status:
        payout.status === "scheduled" || payout.status === "processing"
          ? "upcoming"
          : payout.status,
    })),
  };
}

function ProgressRing({ progress, size = 88 }: { progress: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.25)" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringLabelWrap}>
        <Text style={styles.ringLabelValue}>{Math.round(progress * 100)}%</Text>
      </View>
    </View>
  );
}

function StatusPill({ status }: { status: MemberStatus }) {
  const configs: Record<MemberStatus, { label: string; tone: "success" | "warning" | "danger" }> = {
    paid: { label: "Paid", tone: "success" },
    pending: { label: "Pending", tone: "warning" },
    late: { label: "Late", tone: "danger" },
  };
  const config = configs[status];
  return <KasaStatusBadge compact label={config.label} tone={config.tone} />;
}

function InviteMembersModal({
  visible,
  groupId,
  existingUserIds,
  nextPayoutPosition,
  onClose,
  onInvited,
}: {
  visible: boolean;
  groupId: string;
  existingUserIds: string[];
  nextPayoutPosition: number;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoadingUsers(true);
        const response = await apiService.getUserDirectory(query);
        if (active) {
          setUsers(response.data.filter((user) => !existingUserIds.includes(user._id)));
        }
      } catch (error) {
        if (active) {
          Alert.alert("Could not load members", error instanceof Error ? error.message : "Please try again.");
        }
      } finally {
        if (active) setLoadingUsers(false);
      }
    }, query ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [existingUserIds, query, visible]);

  const close = () => {
    if (sending) return;
    setQuery("");
    setSelectedIds([]);
    onClose();
  };

  const sendInvitations = async () => {
    if (!selectedIds.length || sending) return;
    setSending(true);
    const results = await Promise.allSettled(
      selectedIds.map((userId, index) =>
        apiService.inviteGroupMember(groupId, {
          userId,
          payoutPosition: nextPayoutPosition + index,
        })
      )
    );
    setSending(false);
    const sent = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - sent;
    if (sent) {
      close();
      onInvited();
    }
    Alert.alert(
      sent ? "Invitations sent" : "Could not send invitations",
      failed
        ? `${sent} sent and ${failed} failed. The failed users may already have pending invitations.`
        : `${sent} ${sent === 1 ? "person has" : "people have"} been invited.`
    );
  };

  return (
    <Modal animationType="slide" onRequestClose={close} presentationStyle="pageSheet" visible={visible}>
      <View style={styles.inviteModalContainer}>
        <View style={styles.inviteModalHeader}>
          <View>
            <Text style={styles.inviteModalTitle}>Invite more members</Text>
            <Text style={styles.inviteModalSubtitle}>Select registered KasaFund users.</Text>
          </View>
          <TouchableOpacity disabled={sending} hitSlop={8} onPress={close} style={styles.modalCloseButton}>
            <Ionicons name="close" size={21} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.memberSearch}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Search by name or email"
            placeholderTextColor={COLORS.placeholder}
            style={styles.memberSearchInput}
            value={query}
          />
        </View>

        {loadingUsers ? (
          <View style={styles.inviteEmptyState}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.inviteList} keyboardShouldPersistTaps="handled">
            {users.map((user) => {
              const selected = selectedIds.includes(user._id);
              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  key={user._id}
                  onPress={() =>
                    setSelectedIds((current) =>
                      selected
                        ? current.filter((userId) => userId !== user._id)
                        : [...current, user._id]
                    )
                  }
                  style={[styles.inviteUserRow, selected && styles.inviteUserRowSelected]}
                >
                  {user.avatarUrl ? (
                    <ExpoImage cachePolicy="memory-disk" contentFit="cover" source={{ uri: user.avatarUrl }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
                      <Text style={styles.memberAvatarInitial}>{user.fullName.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={[styles.freqLabel, { flex: 1 }]}>{user.fullName}</Text>
                  <View style={[styles.inviteCheckbox, selected && styles.inviteCheckboxSelected]}>
                    {selected && <Ionicons name="checkmark" size={14} color={COLORS.background} />}
                  </View>
                </TouchableOpacity>
              );
            })}
            {!users.length && (
              <View style={styles.inviteEmptyState}>
                <Ionicons name="people-outline" size={27} color={COLORS.placeholder} />
                <Text style={styles.freqSublabel}>No available users found.</Text>
              </View>
            )}
          </ScrollView>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!selectedIds.length || sending}
          onPress={sendInvitations}
          style={[styles.sendInviteButton, (!selectedIds.length || sending) && styles.sendInviteButtonDisabled]}
        >
          {sending ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.sendInviteButtonText}>
              Send {selectedIds.length || ""} invitation{selectedIds.length === 1 ? "" : "s"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

type PayoutSimulationStage =
  | "before_due"
  | "due"
  | "grace"
  | "overdue"
  | "resolution_expired";

type GroupFinancialAction =
  | "extending_deadline"
  | "opening_vote"
  | "approving_vote"
  | "rejecting_vote"
  | null;

function PayoutTestToolsModal({
  groupId,
  initialSimulatedNow,
  onChanged,
  onClose,
  visible,
}: {
  groupId: string;
  initialSimulatedNow?: string | null;
  onChanged: () => void;
  onClose: () => void;
  visible: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [selectedStage, setSelectedStage] = useState<PayoutSimulationStage | null>(null);
  const [simulatedNow, setSimulatedNow] = useState<string | null>(
    initialSimulatedNow || null
  );

  useEffect(() => {
    if (!visible) return;
    setSimulatedNow(initialSimulatedNow || null);
    setSelectedStage(null);
  }, [initialSimulatedNow, visible]);

  const changeStage = async (stage: PayoutSimulationStage | "reset") => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await apiService.setPayoutSimulationStage(groupId, stage);
      setSimulatedNow(response.data.simulatedNow);
      setSelectedStage(stage === "reset" ? null : stage);
      if (stage !== "resolution_expired") onChanged();
    } catch (simulationError) {
      Alert.alert(
        "Could not change test time",
        simulationError instanceof Error ? simulationError.message : "Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const runProcessors = () => {
    if (!simulatedNow || busy) return;
    Alert.alert(
      "Run test processors?",
      "Use a test group only. Notifications, wallet movements, and successful payouts are written to the database.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Run now",
          onPress: async () => {
            setBusy(true);
            try {
              const response = await apiService.runPayoutSimulation(groupId);
              const payout = response.data.payout;
              setSimulatedNow(response.data.state.simulatedNow);
              onChanged();
              Alert.alert(
                payout?.processed
                  ? "Payout processed"
                  : response.data.deadlockClosed
                    ? "Cycle closed safely"
                  : response.data.expiredResolutions
                    ? "Vote expired"
                    : "Processors finished",
                response.data.deadlockClosed
                  ? "The final vote expired. Paid contributions were returned to member wallets, defaulters were suspended, and the group moved to a clean cycle."
                  : response.data.expiredResolutions
                  ? "The unfinished resolution vote expired. Management can now propose a fresh vote."
                  : payout?.processed
                  ? "The scheduled payout completed at the simulated time."
                  : payout?.reason === "missing_contributions"
                    ? `Payout delayed by ${payout.missingCount} missing ${
                        payout.missingCount === 1 ? "contribution" : "contributions"
                      }.`
                    : payout?.reason === "within_grace_period"
                      ? "The payout is correctly waiting during the grace period."
                      : payout?.reason || "No payout was ready to process."
              );
            } catch (simulationError) {
              Alert.alert(
                "Test run failed",
                simulationError instanceof Error ? simulationError.message : "Please try again."
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const stages: {
    key: PayoutSimulationStage;
    label: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "before_due", label: "Before due", description: "One hour before", icon: "hourglass-outline" },
    { key: "due", label: "Due now", description: "Contribution time", icon: "alarm-outline" },
    { key: "grace", label: "In grace", description: "Waiting safely", icon: "time-outline" },
    { key: "overdue", label: "Overdue", description: "Deadline passed", icon: "alert-circle-outline" },
    { key: "resolution_expired", label: "Vote expired", description: "24-hour vote ended", icon: "timer-outline" },
  ];

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View style={styles.testToolsContainer}>
        <View style={styles.inviteModalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inviteModalTitle}>Payout test tools</Text>
            <Text style={styles.inviteModalSubtitle}>
              Time travel applies only to this group and resets with the server.
            </Text>
          </View>
          <TouchableOpacity
            disabled={busy}
            hitSlop={8}
            onPress={onClose}
            style={styles.modalCloseButton}
          >
            <Ionicons name="close" size={21} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.testWarning}>
          <Ionicons name="flask-outline" size={20} color="#6D4BC3" />
          <Text style={styles.testWarningText}>
            Use a disposable test group. Running processors writes real test records.
          </Text>
        </View>

        <Text style={styles.sectionHeading}>Choose timeline stage</Text>
        <View style={styles.testStageGrid}>
          {stages.map((stage) => {
            const selected = selectedStage === stage.key;
            return (
              <TouchableOpacity
                activeOpacity={0.82}
                disabled={busy}
                key={stage.key}
                onPress={() => void changeStage(stage.key)}
                style={[styles.testStageCard, selected && styles.testStageCardSelected]}
              >
                <View style={[styles.testStageIcon, selected && styles.testStageIconSelected]}>
                  <Ionicons
                    name={stage.icon}
                    size={21}
                    color={selected ? COLORS.background : "#6D4BC3"}
                  />
                </View>
                <Text style={styles.testStageTitle}>{stage.label}</Text>
                <Text style={styles.testStageDescription}>{stage.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.testClockCard}>
          <View>
            <Text style={styles.statLabel}>Effective test time</Text>
            <Text style={styles.testClockValue}>
              {simulatedNow
                ? new Date(simulatedNow).toLocaleString("en-GH")
                : "Real clock"}
            </Text>
          </View>
          {!!simulatedNow && (
            <TouchableOpacity
              disabled={busy}
              onPress={() => void changeStage("reset")}
              style={styles.resetClockButton}
            >
              <Text style={styles.resetClockText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!simulatedNow || busy}
          onPress={runProcessors}
          style={[
            styles.runProcessorsButton,
            (!simulatedNow || busy) && styles.runProcessorsButtonDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <>
              <Ionicons name="play" size={18} color={COLORS.background} />
              <Text style={styles.runProcessorsButtonText}>Run processors now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ---------- Tabs ----------

function OverviewTab({
  group,
  isOwner,
  isActivating,
  canExtendGrace,
  canManageResolution,
  onCreateResolution,
  onExtendGrace,
  onVote,
  onActivate,
  onInvite,
  onOpenCollectivePayout,
  financialAction,
}: {
  group: GroupDetailData;
  isOwner: boolean;
  isActivating: boolean;
  canExtendGrace: boolean;
  canManageResolution: boolean;
  onCreateResolution: () => void;
  onExtendGrace: () => void;
  onVote: (choice: "approve" | "reject") => void;
  onActivate: () => void;
  onInvite: () => void;
  onOpenCollectivePayout: () => void;
  financialAction: GroupFinancialAction;
}) {
  const readiness = group.payoutReadiness;
  const resolution = group.resolution;
  const financialActionPending = financialAction !== null;
  const payoutStatus = readiness?.status === "overdue"
    ? {
        icon: "alert-circle-outline" as const,
        title: "Payout delayed",
        detail: `${readiness.missingCount} overdue ${
          readiness.missingCount === 1 ? "contribution" : "contributions"
        }`,
        color: COLORS.error,
        background: COLORS.errorSurface,
      }
    : readiness?.status === "ready"
      ? {
          icon: "checkmark-circle-outline" as const,
          title: "Payout fully funded",
          detail: `${readiness.paidCount} of ${readiness.expectedCount} contributions received`,
          color: COLORS.success,
          background: COLORS.successSurface,
        }
      : {
          icon: "time-outline" as const,
          title: readiness
            ? `Waiting for ${readiness.missingCount} ${
                readiness.missingCount === 1 ? "member" : "members"
              }`
            : "Payout scheduled",
          detail: readiness?.graceEndsAt
            ? `Grace period ends ${formatDate(readiness.graceEndsAt)}`
            : `Goes to ${group.nextPayoutMember}`,
          color: COLORS.warning,
          background: COLORS.warningSurface,
        };

  return (
    <View style={styles.tabContent}>
      {group.status === "setup" && (
        <KasaCard style={styles.setupCard}>
          <View style={styles.setupCardHeader}>
            <View style={styles.setupIcon}>
              <Ionicons name="options-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.setupTitle}>Finish group setup</Text>
              <Text style={styles.setupSubtitle}>
                {group.memberCount} of {group.expectedMemberCount} members accepted
              </Text>
            </View>
            <View style={styles.setupBadge}>
              <Text style={styles.setupBadgeText}>Not active</Text>
            </View>
          </View>
          <View style={styles.setupProgressTrack}>
            <View
              style={[
                styles.setupProgressFill,
                { width: `${Math.min(group.memberCount / group.expectedMemberCount, 1) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.setupBody}>
            {group.savingModel === "collective_goal"
              ? "No contributions begin until the owner confirms the accepted roster and shared-goal rules."
              : "No contributions or payouts begin until the owner confirms the accepted roster and payout order."}
          </Text>
          {isOwner && (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.82}
              disabled={isActivating}
              onPress={group.memberCount >= group.expectedMemberCount ? onActivate : onInvite}
              style={styles.setupAction}
            >
              {isActivating ? (
                <AnimatedLoader accessibilityLabel="Activating group" size="compact" />
              ) : (
                <>
                  <Text style={styles.setupActionText}>
                    {group.memberCount >= group.expectedMemberCount ? "Review & activate" : "Invite members"}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.background} />
                </>
              )}
            </TouchableOpacity>
          )}
        </KasaCard>
      )}
      <View style={styles.statsRow}>
        <KasaCard style={styles.statCard}>
          <Text style={styles.statLabel}>Contribution</Text>
          <Text style={styles.statValue}>{group.contributionAmount}</Text>
          <Text style={styles.statSublabel}>{group.frequency}</Text>
        </KasaCard>
        <KasaCard style={styles.statCard}>
          <Text style={styles.statLabel}>Members</Text>
          <Text style={styles.statValue}>{group.memberCount}</Text>
          <Text style={styles.statSublabel}>active</Text>
        </KasaCard>
      </View>

      {group.savingModel === "collective_goal" && group.status !== "setup" ? (
        <KasaCard style={styles.collectiveGoalCard}>
          <View style={styles.collectiveGoalHeader}>
            <View style={styles.collectiveGoalIcon}>
              <Ionicons name={group.collectiveGoal?.status === "saving" ? "flag-outline" : "checkmark-circle-outline"} size={21} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.collectiveGoalEyebrow}>COLLECTIVE GOAL</Text>
              <Text style={styles.collectiveGoalTitle}>
                {group.collectiveGoal?.status === "saving" ? "Saving together" : group.collectiveGoal?.status === "target_reached" ? "Goal reached · decision ready" : "Goal completed"}
              </Text>
            </View>
          </View>
          <View style={styles.collectiveMoneyRow}>
            <Text style={styles.collectiveSaved}>{formatMoney(group.collectiveGoal?.totalSaved || 0)}</Text>
            <Text style={styles.collectiveTarget}> of {group.goalAmount}</Text>
          </View>
          <View style={styles.collectiveTrack}><View style={[styles.collectiveFill, { width: `${group.progress * 100}%` }]} /></View>
          <Text style={styles.collectiveAvailable}>{group.potAmount} currently available for an approved payout</Text>
          {group.collectiveProposal ? (
            <View style={styles.collectiveVoteSummary}>
              <View style={{ flex: 1 }}>
                <Text style={styles.collectiveVoteTitle}>Payout vote is open</Text>
                <Text style={styles.collectiveVoteBody}>{group.collectiveProposal.yesVotes} of {group.collectiveProposal.requiredYesVotes} approvals · {formatMoney(group.collectiveProposal.amount)}</Text>
              </View>
              {group.collectiveProposal.canVote ? <View style={styles.voteNeededBadge}><Text style={styles.voteNeededText}>Your vote</Text></View> : null}
            </View>
          ) : null}
          {group.collectiveGoal?.status !== "completed" ? (
            <TouchableOpacity accessibilityRole="button" activeOpacity={0.82} onPress={onOpenCollectivePayout} style={styles.collectiveAction}>
              <Text style={styles.collectiveActionText}>{group.collectiveProposal ? "Review payout vote" : group.collectiveGoal?.status === "target_reached" ? "Manage payout decision" : "View goal details"}</Text>
              <Ionicons name="arrow-forward" size={17} color={COLORS.background} />
            </TouchableOpacity>
          ) : null}
        </KasaCard>
      ) : null}

      {group.status !== "setup" && group.savingModel === "rotational" && <KasaCard style={[styles.nextPayoutCard, { backgroundColor: payoutStatus.background }]}>
        <View style={[styles.discoverIconWrap, { borderColor: `${payoutStatus.color}35` }]}>
          <Ionicons name={payoutStatus.icon} size={20} color={payoutStatus.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.freqLabel}>Next payout · {group.nextPayoutDate}</Text>
          <Text style={styles.freqSublabel}>Goes to {group.nextPayoutMember}</Text>
          <View style={styles.payoutFundingRow}>
            <View style={[styles.payoutFundingDot, { backgroundColor: payoutStatus.color }]} />
            <Text style={[styles.payoutFundingTitle, { color: payoutStatus.color }]}>
              {payoutStatus.title}
            </Text>
            <Text style={styles.payoutFundingDetail}>· {payoutStatus.detail}</Text>
          </View>
          {readiness?.status === "overdue" && canExtendGrace && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{
                busy: financialAction === "extending_deadline",
                disabled: financialActionPending,
              }}
              activeOpacity={0.8}
              disabled={financialActionPending}
              onPress={onExtendGrace}
              style={[
                styles.extendGraceButton,
                financialActionPending && styles.financialActionDisabled,
              ]}
            >
              {financialAction === "extending_deadline" ? (
                <>
                  <ActivityIndicator color={COLORS.primary} size="small" />
                  <Text accessibilityLiveRegion="polite" style={styles.extendGraceButtonText}>
                    Extending deadline…
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.extendGraceButtonText}>
                    {readiness.extensionAvailable
                      ? "Extend deadline once"
                      : "Deadline already extended"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {readiness?.status === "overdue" && canManageResolution && !resolution && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{
                busy: financialAction === "opening_vote",
                disabled: financialActionPending,
              }}
              activeOpacity={0.8}
              disabled={financialActionPending}
              onPress={onCreateResolution}
              style={[
                styles.proposeResolutionButton,
                financialActionPending && styles.financialActionDisabled,
              ]}
            >
              {financialAction === "opening_vote" ? (
                <>
                  <ActivityIndicator color={COLORS.background} size="small" />
                  <Text accessibilityLiveRegion="polite" style={styles.proposeResolutionButtonText}>
                    Opening vote…
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="people-outline" size={14} color={COLORS.background} />
                  <Text style={styles.proposeResolutionButtonText}>
                    Propose group resolution
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KasaCard>}

      {!!resolution && group.savingModel === "rotational" && (
        <KasaCard style={styles.resolutionCard}>
          <View style={styles.resolutionHeader}>
            <View style={styles.resolutionIcon}>
              <Ionicons name="people" size={20} color="#6D4BC3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resolutionTitle}>Group decision required</Text>
              <Text style={styles.resolutionSubtitle}>
                {resolution.attemptNumber > 1
                  ? `Vote attempt ${resolution.attemptNumber} · `
                  : ""}
                Closes {new Date(resolution.expiresAt).toLocaleString("en-GH", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
          <View style={styles.resolutionAmountRow}>
            <View>
              <Text style={styles.statLabel}>Original payout</Text>
              <Text style={styles.resolutionOldAmount}>
                {formatMoney(resolution.originalPayoutAmount)}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={COLORS.textMuted} />
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.statLabel}>Proposed payout</Text>
              <Text style={styles.resolutionNewAmount}>
                {formatMoney(resolution.proposedPayoutAmount)}
              </Text>
            </View>
          </View>
          <Text style={styles.resolutionDefaultText}>
            {resolution.defaultingMembers.map((member) => member.fullName).join(", ")}{" "}
            {resolution.defaultingMembers.length === 1 ? "will be" : "will be"} suspended.
          </Text>
          <View style={styles.voteProgressRow}>
            <Text style={styles.voteProgressText}>
              {resolution.yesVotes} of {resolution.requiredYesVotes} approvals
            </Text>
            <Text style={styles.voteProgressMuted}>
              Recipient approval required
            </Text>
          </View>
          <View style={styles.voteTrack}>
            <View
              style={[
                styles.voteFill,
                {
                  width: `${Math.min(
                    (resolution.yesVotes / resolution.requiredYesVotes) * 100,
                    100
                  )}%`,
                },
              ]}
            />
          </View>
          {resolution.canVote ? (
            <View style={styles.voteActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{
                  busy: financialAction === "rejecting_vote",
                  disabled: financialActionPending,
                }}
                activeOpacity={0.82}
                disabled={financialActionPending}
                onPress={() => onVote("reject")}
                style={[
                  styles.rejectVoteButton,
                  financialActionPending && styles.financialActionDisabled,
                ]}
              >
                {financialAction === "rejecting_vote" ? (
                  <>
                    <ActivityIndicator color={COLORS.error} size="small" />
                    <Text accessibilityLiveRegion="polite" style={styles.rejectVoteText}>
                      Submitting…
                    </Text>
                  </>
                ) : (
                  <Text style={styles.rejectVoteText}>Reject</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{
                  busy: financialAction === "approving_vote",
                  disabled: financialActionPending,
                }}
                activeOpacity={0.82}
                disabled={financialActionPending}
                onPress={() => onVote("approve")}
                style={[
                  styles.approveVoteButton,
                  financialActionPending && styles.financialActionDisabled,
                ]}
              >
                {financialAction === "approving_vote" ? (
                  <>
                    <ActivityIndicator color={COLORS.background} size="small" />
                    <Text accessibilityLiveRegion="polite" style={styles.approveVoteText}>
                      Submitting…
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark" size={17} color={COLORS.background} />
                    <Text style={styles.approveVoteText}>Approve</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.voteRecorded}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.voteRecordedText}>
                {resolution.currentUserVote
                  ? `Your vote: ${resolution.currentUserVote === "approve" ? "Approve" : "Reject"}`
                  : "You are not eligible to vote on this proposal"}
              </Text>
            </View>
          )}
        </KasaCard>
      )}

      <View style={styles.activityHeading}>
        <KasaSectionHeader title="Recent activity" />
      </View>
      <View style={{ gap: 10 }}>
        {group.contributions.slice(0, 3).map((c) => (
          <KasaCard key={c.id} style={styles.activityRow}>
            <View style={styles.activityIconWrap}>
              <Ionicons name="arrow-down-circle" size={18} color={COLORS.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.freqLabel}>{c.memberName} contributed</Text>
              <Text style={styles.freqSublabel}>{c.date} · {c.method}</Text>
            </View>
            <Text style={styles.activityAmount}>{c.amount}</Text>
          </KasaCard>
        ))}
        {!group.contributions.length ? (
          <KasaStateView
            icon="receipt-outline"
            kind="empty"
            message="Member contributions will appear here when this cycle begins."
            style={styles.activityEmpty}
            title="No activity this cycle"
          />
        ) : null}
      </View>
    </View>
  );
}

function MembersTab({
  members,
  savingModel,
  canInvite,
  canManageRoles,
  onInvite,
  onManageRole,
  onOpenProfile,
}: {
  members: MemberRow[];
  savingModel?: GroupDetailData["savingModel"];
  canInvite: boolean;
  canManageRoles: boolean;
  onInvite: () => void;
  onManageRole: (member: MemberRow) => void;
  onOpenProfile: (member: MemberRow) => void;
}) {
  return (
    <View style={styles.tabContent}>
      <View style={{ gap: 10 }}>
        {members.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              disabled={!m.userId}
              onPress={() => onOpenProfile(m)}
              style={styles.memberProfileLink}
            >
              {m.avatar ? (
                <ExpoImage cachePolicy="memory-disk" contentFit="cover" source={{ uri: m.avatar }} style={styles.memberAvatar} />
              ) : (
                <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
                  <Text style={styles.memberAvatarInitial}>
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.freqLabel}>{m.name}</Text>
                  {m.role !== "member" && (
                    <View style={styles.roleTag}>
                      <Text style={styles.roleTagText}>
                        {m.role === "owner" ? "Owner" : "Treasurer"}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.freqSublabel}>{savingModel === "collective_goal" ? "Equal voting member" : `Payout position #${m.payoutPosition}`}</Text>
              </View>
            </TouchableOpacity>
            <StatusPill status={m.status} />
            {canManageRoles && m.role !== "owner" && (
              <TouchableOpacity style={styles.memberMenuBtn} hitSlop={8} onPress={() => onManageRole(m)}>
                <Ionicons name="ellipsis-vertical" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {canInvite && (
        <TouchableOpacity style={styles.outlineButton} activeOpacity={0.85} onPress={onInvite}>
          <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
          <Text style={styles.outlineButtonText}>Invite more members</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ContributionsTab({
  contributions,
  groupStatus,
}: {
  contributions: ContributionRow[];
  groupStatus: GroupDetailData["status"];
}) {
  if (!contributions.length) {
    return (
      <View style={styles.tabContent}>
        <KasaStateView
          icon="wallet-outline"
          kind="empty"
          message={
            groupStatus === "setup"
              ? "Contributions will appear here after the owner activates the group and the first cycle begins."
              : "Completed member contributions will appear here for everyone to track."
          }
          style={styles.tabEmptyState}
          title={groupStatus === "setup" ? "Contributions haven’t started" : "No contributions yet"}
        />
      </View>
    );
  }
  return (
    <View style={styles.tabContent}>
      <View style={{ gap: 10 }}>
        {contributions.map((c) => (
          <View key={c.id} style={styles.activityRow}>
            <View style={styles.activityIconWrap}>
              <Ionicons name="arrow-down-circle" size={18} color={COLORS.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.freqLabel}>{c.memberName}</Text>
              <Text style={styles.freqSublabel}>{c.date} · {c.method}</Text>
            </View>
            <Text style={styles.activityAmount}>{c.amount}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PayoutsTab({
  payouts,
  groupStatus,
}: {
  payouts: PayoutRow[];
  groupStatus: GroupDetailData["status"];
}) {
  if (!payouts.length) {
    return (
      <View style={styles.tabContent}>
        <KasaStateView
          icon="calendar-outline"
          kind="empty"
          message={
            groupStatus === "setup"
              ? "The first payout will be scheduled after the accepted roster and payout order are confirmed."
              : "Scheduled and completed payouts will appear here as the group progresses."
          }
          style={styles.tabEmptyState}
          title={groupStatus === "setup" ? "No payout schedule yet" : "No payouts yet"}
        />
      </View>
    );
  }
  return (
    <View style={styles.tabContent}>
      <View style={{ gap: 10 }}>
        {payouts.map((p) => (
          <View key={p.id} style={styles.activityRow}>
            <View
              style={[
                styles.activityIconWrap,
                p.status === "upcoming" && { backgroundColor: COLORS.warningSurface },
                p.status === "failed" && { backgroundColor: COLORS.errorSurface },
              ]}
            >
              <Ionicons
                name={p.status === "completed" ? "checkmark-circle" : p.status === "failed" ? "close-circle" : "time-outline"}
                size={18}
                color={p.status === "completed" ? COLORS.success : p.status === "failed" ? COLORS.error : COLORS.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.freqLabel}>{p.memberName}</Text>
              <Text style={styles.freqSublabel}>
                {p.status === "completed" ? "Paid out" : p.status === "failed" ? "Failed" : "Scheduled"} · {p.date}
              </Text>
            </View>
            <Text style={styles.activityAmount}>{p.amount}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CollectiveDecisionsTab({
  proposals = [],
  onOpen,
}: {
  proposals?: NonNullable<GroupDetailData["collectivePayouts"]>;
  onOpen: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      <KasaSectionHeader title="Payout decisions" />
      {proposals.length ? proposals.map((proposal) => (
        <TouchableOpacity key={proposal._id} activeOpacity={0.82} onPress={onOpen} style={styles.collectiveHistoryRow}>
          <View style={[styles.activityIconWrap, { backgroundColor: proposal.status === "paid" ? COLORS.successSurface : proposal.status === "voting" ? "#EFEAFB" : COLORS.surface }]}>
            <Ionicons name={proposal.status === "paid" ? "checkmark" : proposal.status === "voting" ? "people-outline" : "close-outline"} size={18} color={proposal.status === "paid" ? COLORS.success : proposal.status === "voting" ? "#6D4BC3" : COLORS.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.freqLabel}>{proposal.purpose}</Text>
            <Text style={styles.freqSublabel}>{proposal.recipient?.fullName || "Member"} · {proposal.status === "paid" ? "Approved and paid" : proposal.status === "voting" ? "Voting open" : proposal.status}</Text>
          </View>
          <Text style={styles.activityAmount}>{formatMoney(proposal.amount)}</Text>
        </TouchableOpacity>
      )) : (
        <KasaStateView icon="people-outline" kind="empty" message="Approved and rejected payout proposals will appear here." title="No payout decisions yet" />
      )}
    </View>
  );
}

function SettingsTab({ role, savingModel, autoContributionEnabled, developmentSimulation, onAutoContribution, onDevelopmentTools, onEdit, onInvite, onManageRoles, onNotifications, onLeave, onArchive }: {
  role: "owner" | "treasurer" | "moderator" | "member";
  savingModel?: GroupDetailData["savingModel"];
  autoContributionEnabled: boolean;
  developmentSimulation?: ApiGroupDetail["developmentSimulation"];
  onAutoContribution: () => void;
  onDevelopmentTools: () => void;
  onEdit: (section: "details" | "contribution" | "rotation") => void;
  onInvite: () => void;
  onManageRoles: () => void;
  onNotifications: () => void;
  onLeave: () => void;
  onArchive: () => void;
}) {
  const isOwner = role === "owner";
  const isTreasurer = role === "treasurer";
  const canManageFinances = isOwner || isTreasurer;
  return (
    <View style={styles.tabContent}>
      <View style={styles.roleAccessCard}>
        <View style={styles.roleAccessIcon}>
          <Ionicons name={isOwner ? "shield-checkmark" : isTreasurer ? "wallet" : "person"} size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.freqLabel}>{isOwner ? "Owner access" : isTreasurer ? "Treasurer access" : "Member settings"}</Text>
          <Text style={styles.freqSublabel}>{isOwner ? "Full group administration" : isTreasurer ? "Contribution and payout management" : "Your personal group preferences"}</Text>
        </View>
      </View>

      {canManageFinances && (
        <>
          <Text style={styles.sectionHeading}>Group management</Text>
          <View style={{ gap: 10, marginBottom: 24 }}>
            {isOwner && (
              <TouchableOpacity style={styles.settingsRow} activeOpacity={0.85} onPress={() => onEdit("details")}>
                <Ionicons name="create-outline" size={20} color={COLORS.text} />
                <Text style={[styles.freqLabel, { flex: 1 }]}>Group details & visibility</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.settingsRow} activeOpacity={0.85} onPress={() => onEdit("contribution")}>
              <Ionicons name="options-outline" size={20} color={COLORS.text} />
              <Text style={[styles.freqLabel, { flex: 1 }]}>Contribution rules & penalties</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            {savingModel !== "collective_goal" ? <TouchableOpacity style={styles.settingsRow} activeOpacity={0.85} onPress={() => onEdit("rotation")}>
              <Ionicons name="swap-vertical-outline" size={20} color={COLORS.text} />
              <Text style={[styles.freqLabel, { flex: 1 }]}>Payout rotation order</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity> : null}
            <TouchableOpacity style={styles.settingsRow} activeOpacity={0.85} onPress={onInvite}>
              <Ionicons name="person-add-outline" size={20} color={COLORS.text} />
              <Text style={[styles.freqLabel, { flex: 1 }]}>Invite members</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity style={styles.settingsRow} activeOpacity={0.85} onPress={onManageRoles}>
                <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.text} />
                <Text style={[styles.freqLabel, { flex: 1 }]}>Manage member roles</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
            {developmentSimulation?.enabled && (
              <TouchableOpacity
                style={[styles.settingsRow, styles.developmentSettingsRow]}
                activeOpacity={0.85}
                onPress={onDevelopmentTools}
              >
                <Ionicons name="flask-outline" size={20} color="#6D4BC3" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.freqLabel}>Payout test tools</Text>
                  <Text style={styles.freqSublabel}>
                    {developmentSimulation.simulatedNow
                      ? `Time travel active · ${new Date(developmentSimulation.simulatedNow).toLocaleString("en-GH")}`
                      : "Safely simulate payout deadlines"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      <Text style={styles.sectionHeading}>{canManageFinances ? "General" : "Your settings"}</Text>
      <View style={{ gap: 10, marginBottom: 24 }}>
        <TouchableOpacity style={styles.settingsRow} activeOpacity={0.85} onPress={onAutoContribution}>
          <View style={[styles.settingsFeatureIcon, autoContributionEnabled && styles.settingsFeatureIconActive]}>
            <Ionicons name="sync" size={18} color={autoContributionEnabled ? COLORS.background : COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.freqLabel}>Auto-contribute</Text>
            <Text style={styles.freqSublabel}>
              {autoContributionEnabled ? "Pays from your wallet when due" : "Set up automatic wallet payments"}
            </Text>
          </View>
          <View style={[styles.settingsStatusPill, autoContributionEnabled && styles.settingsStatusPillActive]}>
            <Text style={[styles.settingsStatusText, autoContributionEnabled && styles.settingsStatusTextActive]}>
              {autoContributionEnabled ? "On" : "Off"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsRow} activeOpacity={0.85} onPress={onNotifications}>
          <Ionicons name="notifications-outline" size={20} color={COLORS.text} />
          <Text style={[styles.freqLabel, { flex: 1 }]}>View notifications</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionHeading, { color: COLORS.error }]}>{isOwner ? "Danger zone" : "Membership"}</Text>
      <TouchableOpacity style={[styles.settingsRow, styles.dangerRow]} activeOpacity={0.85} onPress={isOwner ? onArchive : onLeave}>
        <Ionicons name={isOwner ? "archive-outline" : "exit-outline"} size={20} color={COLORS.error} />
        <Text style={[styles.freqLabel, { flex: 1, color: COLORS.error }]}>{isOwner ? "Archive group" : "Leave group"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function ActivationReviewModal({
  busy,
  complete,
  error,
  group,
  onClose,
  onConfirm,
  onEditOrder,
  visible,
}: {
  busy: boolean;
  complete: boolean;
  error: string | null;
  group: GroupDetailData;
  onClose: () => void;
  onConfirm: () => void;
  onEditOrder: () => void;
  visible: boolean;
}) {
  const orderedMembers = [...group.members].sort(
    (a, b) => a.payoutPosition - b.payoutPosition
  );
  const firstPayoutTiming = group.frequency === "daily"
    ? "One day after activation"
    : group.frequency === "weekly"
      ? "Seven days after activation"
      : "One month after activation";

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => !busy && onClose()}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View style={styles.activationModal}>
        {complete ? (
          <View style={styles.activationSuccess}>
            <View style={styles.activationSuccessIcon}>
              <Ionicons name="checkmark" size={34} color={COLORS.background} />
            </View>
            <Text style={styles.activationSuccessTitle}>Group activated</Text>
            <Text style={styles.activationSuccessText}>
              {group.savingModel === "collective_goal"
                ? "Shared-goal contributions are scheduled and every accepted member has been notified."
                : "The first payout is scheduled and every accepted member has been notified."}
            </Text>
            <KasaButton label="Done" onPress={onClose} style={styles.activationDoneButton} />
          </View>
        ) : (
          <>
            <View style={styles.activationHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activationEyebrow}>FINAL CHECK</Text>
                <Text style={styles.activationTitle}>Review & activate</Text>
                <Text style={styles.activationSubtitle}>
                  {group.savingModel === "collective_goal"
                    ? "Confirm the roster and shared-goal rules before contributions begin."
                    : "Confirm the rules and payout order before the first cycle begins."}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close activation review"
                accessibilityRole="button"
                disabled={busy}
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.heroControlPressed]}
              >
                <Ionicons name="close" size={21} color={COLORS.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.activationContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.activationSummary}>
                <View style={styles.activationSummaryItem}>
                  <Text style={styles.activationSummaryLabel}>Contribution</Text>
                  <Text style={styles.activationSummaryValue}>{group.contributionAmount}</Text>
                </View>
                <View style={styles.activationSummaryDivider} />
                <View style={styles.activationSummaryItem}>
                  <Text style={styles.activationSummaryLabel}>Frequency</Text>
                  <Text style={[styles.activationSummaryValue, styles.activationFrequency]}>
                    {group.frequency}
                  </Text>
                </View>
                <View style={styles.activationSummaryDivider} />
                <View style={styles.activationSummaryItem}>
                  <Text style={styles.activationSummaryLabel}>Members</Text>
                  <Text style={styles.activationSummaryValue}>{group.memberCount}</Text>
                </View>
              </View>

              <View style={styles.activationScheduleRow}>
                <View style={styles.activationScheduleIcon}>
                  <Ionicons name="calendar-outline" size={19} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activationRowTitle}>{group.savingModel === "collective_goal" ? "First contribution" : "First payout"}</Text>
                  <Text style={styles.activationRowText}>{firstPayoutTiming}</Text>
                </View>
              </View>

              <View style={styles.activationSectionHeader}>
                <Text style={styles.activationSectionTitle}>{group.savingModel === "collective_goal" ? "Accepted members" : "Payout order"}</Text>
                {group.savingModel !== "collective_goal" ? <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onEditOrder}
                  style={({ pressed }) => [styles.activationEditOrder, pressed && styles.tabItemPressed]}
                >
                  <Ionicons name="pencil-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.activationEditOrderText}>Edit order</Text>
                </Pressable> : null}
              </View>
              <View style={styles.activationOrderList}>
                {orderedMembers.map((member, index) => (
                  <View key={member.id} style={styles.activationMemberRow}>
                    <View style={styles.activationPosition}>
                      <Text style={styles.activationPositionText}>{index + 1}</Text>
                    </View>
                    {member.avatar ? (
                      <ExpoImage
                        cachePolicy="memory-disk"
                        contentFit="cover"
                        source={{ uri: member.avatar }}
                        style={styles.activationAvatar}
                      />
                    ) : (
                      <View style={[styles.activationAvatar, styles.memberAvatarFallback]}>
                        <Text style={styles.memberAvatarInitial}>{member.name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activationMemberName}>{member.name}</Text>
                      <Text style={styles.activationMemberRole}>
                        {member.role === "owner" ? "Group owner" : member.role === "treasurer" ? "Treasurer" : "Member"}
                      </Text>
                    </View>
                    {group.savingModel !== "collective_goal" && index === 0 ? (
                      <View style={styles.activationFirstBadge}>
                        <Text style={styles.activationFirstBadgeText}>First payout</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>

              <View style={styles.activationNotice}>
                <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
                <Text style={styles.activationNoticeText}>
                  {group.savingModel === "collective_goal"
                    ? "Activating starts scheduled contributions. Funds remain locked until the goal is reached and a majority approves a payout."
                    : "Activating creates the first cycle. The payout order stays locked until that round finishes."}
                </Text>
              </View>

              {error ? (
                <View accessibilityLiveRegion="polite" style={styles.activationError}>
                  <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
                  <Text style={styles.activationErrorText}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.activationFooter}>
              <KasaButton
                label="Activate group"
                loading={busy}
                onPress={onConfirm}
                rightIcon={<Ionicons name="arrow-forward" size={18} color={COLORS.background} />}
              />
              <Text style={styles.activationFooterHint}>Members will be notified immediately.</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// ---------- Main screen ----------

export default function GroupDetailScreen() {
  const { guardKyc } = useKycGate();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [group, setGroup] = useState<GroupDetailData | undefined>(
    id ? GROUPS_BY_ID[id] : undefined
  );
  const [membershipRole, setMembershipRole] = useState<"owner" | "treasurer" | "moderator" | "member">("member");
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [autoContributionModalVisible, setAutoContributionModalVisible] = useState(false);
  const [payoutTestToolsVisible, setPayoutTestToolsVisible] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [activationReviewVisible, setActivationReviewVisible] = useState(false);
  const [activationComplete, setActivationComplete] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [financialAction, setFinancialAction] = useState<GroupFinancialAction>(null);
  const [contributionAmount, setContributionAmount] = useState(0);
  const [autoContribution, setAutoContribution] = useState<AutoContributionSettings>({
    enabled: false,
    paymentSource: "wallet",
    lastStatus: "never",
  });
  const loadedGroupId = useRef<string | null>(null);
  const handledReloadKey = useRef(reloadKey);

  const refreshGroupAfterFinancialAction = async () => {
    if (!id) return false;
    try {
      const response = await apiService.getGroup(id);
      setGroup(mapGroupDetail(response.data));
      setMembershipRole(response.data.membership?.role || "member");
      setIsMember(Boolean(response.data.membership));
      setContributionAmount(response.data.group.contribution.amount);
      setAutoContribution(response.data.membership?.autoContribution || {
        enabled: false,
        paymentSource: "wallet",
        lastStatus: "never",
      });
      return true;
    } catch {
      setReloadKey((value) => value + 1);
      return false;
    }
  };

  const shareGroup = async () => {
    if (!group?.inviteCode) {
      Alert.alert("Invite link unavailable", "Refresh the group and try again.");
      return;
    }
    const inviteLink = Linking.createURL("/groups/join", {
      queryParams: { code: group.inviteCode },
    });
    try {
      await Share.share({
        message: `Join ${group.name} on KasaFund: ${inviteLink}`,
      });
    } catch (shareError) {
      Alert.alert(
        "Could not share group",
        shareError instanceof Error ? shareError.message : "Please try again."
      );
    }
  };

  const openGroupSettings = (section: "details" | "contribution" | "rotation") => {
    if (!id) return;
    router.push({ pathname: "/groups/[id]/edit", params: { id, section } });
  };

  const activateGroup = () => {
    if (!id || !group || group.status !== "setup") return;
    if (group.memberCount < group.expectedMemberCount) {
      setInviteModalVisible(true);
      return;
    }
    setActivationError(null);
    setActivationComplete(false);
    setActivationReviewVisible(true);
  };

  const confirmGroupActivation = async () => {
    if (!id || !group || isActivating) return;
    const order = [...group.members]
      .sort((a, b) => a.payoutPosition - b.payoutPosition)
      .flatMap((member) => member.userId ? [member.userId] : []);
    try {
      setIsActivating(true);
      setActivationError(null);
      await apiService.activateGroup(id, order);
      setActivationComplete(true);
      setReloadKey((value) => value + 1);
    } catch (activationRequestError) {
      setActivationError(
        activationRequestError instanceof Error
          ? activationRequestError.message
          : "Please check the roster and try again."
      );
    } finally {
      setIsActivating(false);
    }
  };

  const closeActivationReview = () => {
    if (isActivating) return;
    setActivationReviewVisible(false);
    setActivationComplete(false);
    setActivationError(null);
  };

  const leaveGroup = () => {
    if (!id) return;
    Alert.alert("Leave this group?", "You will lose access to its contribution history and schedule.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave group",
        style: "destructive",
        onPress: async () => {
          try {
            await apiService.leaveGroup(id);
            router.replace("/(tabs)/groups");
          } catch (leaveError) {
            Alert.alert("Could not leave group", leaveError instanceof Error ? leaveError.message : "Please try again.");
          }
        },
      },
    ]);
  };

  const archiveGroup = () => {
    if (!id) return;
    if (group?.status === "active") {
      Alert.alert(
        "Active groups can’t be archived",
        "Pause the group and settle its balance, scheduled payouts, member debts, and active resolutions first. Your group history will remain available once it is safely archived."
      );
      return;
    }
    Alert.alert("Archive this group?", "It will be removed from group lists and members will no longer be able to open it. Contribution and payout history will be kept.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive group",
        style: "destructive",
        onPress: async () => {
          try {
            await apiService.updateGroup(id, { status: "archived" });
            router.replace("/(tabs)/groups");
          } catch (archiveError) {
            Alert.alert("Could not archive group", archiveError instanceof Error ? archiveError.message : "Please try again.");
          }
        },
      },
    ]);
  };

  const manageMemberRole = (member: MemberRow) => {
    if (!id || !member.userId) return;
    const updateRole = async (role: "treasurer" | "member") => {
      try {
        await apiService.updateGroupMemberRole(id, member.userId!, role);
        setReloadKey((value) => value + 1);
        Alert.alert("Role updated", `${member.name} is now ${role === "treasurer" ? "the group treasurer" : "a regular member"}.`);
      } catch (roleError) {
        Alert.alert("Could not update role", roleError instanceof Error ? roleError.message : "Please try again.");
      }
    };
    Alert.alert(`Manage ${member.name}`, "Choose this member’s group role.", [
      { text: "Cancel", style: "cancel" },
      { text: "Regular member", onPress: () => void updateRole("member") },
      { text: "Treasurer", onPress: () => void updateRole("treasurer") },
    ]);
  };

  const extendGracePeriod = () => {
    const readiness = group?.payoutReadiness;
    if (!id || !readiness?.payoutId || !readiness.extensionAvailable) {
      Alert.alert(
        "Extension unavailable",
        "The deadline can only be extended once during a contribution cycle."
      );
      return;
    }
    const extend = async (days: number) => {
      if (financialAction) return;
      setFinancialAction("extending_deadline");
      try {
        await apiService.extendPayoutGrace(id, readiness.payoutId, days);
        const refreshed = await refreshGroupAfterFinancialAction();
        Alert.alert(
          "Deadline extended",
          refreshed
            ? `Members have ${days} more ${days === 1 ? "day" : "days"} to contribute.`
            : `Members have ${days} more ${days === 1 ? "day" : "days"} to contribute. The group is refreshing to show the new deadline.`
        );
      } catch (extensionError) {
        Alert.alert(
          "Could not extend deadline",
          extensionError instanceof Error ? extensionError.message : "Please try again."
        );
      } finally {
        setFinancialAction(null);
      }
    };
    Alert.alert(
      "Extend contribution deadline",
      "This can only be done once for the current cycle.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "1 day", onPress: () => void extend(1) },
        { text: "3 days", onPress: () => void extend(3) },
        { text: "7 days", onPress: () => void extend(7) },
      ]
    );
  };

  const createResolution = () => {
    if (!id || financialAction) return;
    Alert.alert(
      "Propose reduced payout?",
      "Paid members will vote. If approved, the recipient receives only the collected amount and defaulting members are suspended.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start vote",
          onPress: async () => {
            if (financialAction) return;
            setFinancialAction("opening_vote");
            try {
              await apiService.createGroupResolution(id);
              const refreshed = await refreshGroupAfterFinancialAction();
              Alert.alert(
                "Voting opened",
                refreshed
                  ? "Eligible members have been notified. The resolution is now visible on the group overview."
                  : "Eligible members have been notified. The group is refreshing to show the resolution."
              );
            } catch (resolutionError) {
              Alert.alert(
                "Could not start vote",
                resolutionError instanceof Error ? resolutionError.message : "Please try again."
              );
            } finally {
              setFinancialAction(null);
            }
          },
        },
      ]
    );
  };

  const voteOnResolution = (choice: "approve" | "reject") => {
    if (!id || !group?.resolution || financialAction) return;
    Alert.alert(
      choice === "approve" ? "Approve this resolution?" : "Reject this resolution?",
      choice === "approve"
        ? "Your vote supports the reduced payout and suspension of defaulting members."
        : "A recipient rejection immediately stops this proposal.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: choice === "approve" ? "Approve" : "Reject",
          style: choice === "reject" ? "destructive" : "default",
          onPress: async () => {
            if (financialAction) return;
            setFinancialAction(
              choice === "approve" ? "approving_vote" : "rejecting_vote"
            );
            try {
              const response = await apiService.voteOnGroupResolution(
                id,
                group.resolution!._id,
                choice
              );
              if (response.data.payoutProcessed) await checkAuthStatus();
              const refreshed = await refreshGroupAfterFinancialAction();
              Alert.alert(
                response.data.payoutProcessed ? "Resolution passed" : "Vote recorded",
                response.data.payoutProcessed
                  ? refreshed
                    ? "The reduced payout has been completed and the group has been updated."
                    : "The reduced payout has been completed. The group is refreshing to show the result."
                  : refreshed
                    ? `Your ${choice === "approve" ? "approval" : "rejection"} is recorded and the voting progress is up to date.`
                    : `Your ${choice === "approve" ? "approval" : "rejection"} is recorded. The group is refreshing to show the new progress.`
              );
            } catch (voteError) {
              Alert.alert(
                "Could not record vote",
                voteError instanceof Error ? voteError.message : "Please try again."
              );
            } finally {
              setFinancialAction(null);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    setActiveTab("overview");
  }, [id]);

  useFocusEffect(useCallback(() => {
    if (!id) {
      setLoading(false);
      setError("The group link is invalid.");
      return;
    }

    const manuallyReloaded = handledReloadKey.current !== reloadKey;
    const settingsChanged = consumeGroupRefresh(id);
    handledReloadKey.current = reloadKey;
    if (loadedGroupId.current === id && !manuallyReloaded && !settingsChanged) {
      return;
    }
    loadedGroupId.current = id;

    let cancelled = false;
    if (reloadKey === 0) setGroup(GROUPS_BY_ID[id]);
    setLoading(true);
    setError(null);
    void apiService
      .getGroup(id)
      .then((response) => {
        if (cancelled) return;
        setGroup(mapGroupDetail(response.data));
        setMembershipRole(response.data.membership?.role || "member");
        setIsMember(Boolean(response.data.membership));
        setContributionAmount(response.data.group.contribution.amount);
        setAutoContribution(response.data.membership?.autoContribution || {
          enabled: false,
          paymentSource: "wallet",
          lastStatus: "never",
        });
      })
      .catch((requestError) => {
        if (cancelled) return;
        setGroup(GROUPS_BY_ID[id]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load this group."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]));

  useFocusEffect(useCallback(() => {
    if (!id || !isMember || !currentUserId) return;
    let active = true;
    let disconnect: (() => void) | undefined;

    void apiService.getGroupChatUnreadCount(id).then((response) => {
      if (active) {
        setGroup((current) => current
          ? { ...current, unreadChatCount: response.data.unreadCount }
          : current);
      }
    }).catch(() => undefined);

    void createChatSocket().then((socket) => {
      if (!active) return socket.disconnect();
      disconnect = () => socket.disconnect();
      socket.on("connect", () => {
        socket.emit("chat:join", { groupId: id, markRead: false });
      });
      socket.on("chat:message", (message: ApiGroupMessage) => {
        if (message.groupId !== id || message.sender._id === currentUserId) return;
        setGroup((current) => current
          ? { ...current, unreadChatCount: (current.unreadChatCount || 0) + 1 }
          : current);
      });
    }).catch(() => undefined);

    return () => {
      active = false;
      disconnect?.();
    };
  }, [currentUserId, id, isMember]));

  if (loading && !group) {
    return (
      <View style={styles.notFoundContainer}>
        <AnimatedLoader accessibilityLabel="Loading group" />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.notFoundContainer}>
        <KasaStateView
          actionLabel={error ? "Try again" : "Go back"}
          kind="error"
          message={error || "This group may have been removed, or the link is invalid."}
          onAction={() => {
            if (error) setReloadKey((value) => value + 1);
            else router.back();
          }}
          title="Group not found"
        />
      </View>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "members", label: "Members" },
    { key: "contributions", label: "Contributions" },
    { key: "payouts", label: group.savingModel === "collective_goal" ? "Decisions" : "Payouts" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Hero header */}
      <View style={[styles.hero, { backgroundColor: group.coverColor, paddingTop: insets.top + 10 }]}> 
        {group.coverImageUrl ? (
          <>
            <ExpoImage cachePolicy="memory-disk" contentFit="cover" source={{ uri: group.coverImageUrl }} style={styles.heroImage} />
            <View style={styles.heroImageShade} />
          </>
        ) : null}
        <View style={styles.heroTopRow}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [styles.heroIconBtn, pressed && styles.heroControlPressed]}>
            <Ionicons name="arrow-back" size={22} color={COLORS.background} />
          </Pressable>
          <View style={styles.heroActions}>
            {isMember && group.savingModel !== "collective_goal" && (
              <Pressable
                accessibilityLabel="Open cycle ledger"
                accessibilityRole="button"
                hitSlop={6}
                onPress={() =>
                  router.push({
                    pathname: "/groups/[id]/ledger",
                    params: { id },
                  })
                }
                style={({ pressed }) => [styles.heroIconBtn, pressed && styles.heroControlPressed]}
              >
                <Ionicons name="receipt-outline" size={20} color={COLORS.background} />
              </Pressable>
            )}
            {isMember && (
              <Pressable
                accessibilityLabel="Open group chat"
                accessibilityRole="button"
                hitSlop={6}
                onPress={() => {
                  setGroup((current) => current ? { ...current, unreadChatCount: 0 } : current);
                  router.push({ pathname: "/groups/[id]/chat", params: { id, groupName: group.name, role: membershipRole } });
                }}
                style={({ pressed }) => [styles.heroIconBtn, pressed && styles.heroControlPressed]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.background} />
                {!!group.unreadChatCount && (
                  <View style={styles.heroChatBadge}>
                    <Text style={styles.heroChatBadgeText}>{Math.min(group.unreadChatCount, 99)}</Text>
                  </View>
                )}
              </Pressable>
            )}
            <Pressable accessibilityLabel="Share group" accessibilityRole="button" hitSlop={6} onPress={() => void shareGroup()} style={({ pressed }) => [styles.heroIconBtn, pressed && styles.heroControlPressed]}>
              <Ionicons name="share-outline" size={20} color={COLORS.background} />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroBody}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.heroGroupName}>{group.name}</ThemedText>
            <Text style={styles.heroGroupType}>{group.type}</Text>

            <View style={styles.heroPotRow}>
              <Text style={styles.heroPotAmount}>{group.potAmount}</Text>
              <Text style={styles.heroPotGoal}> / {group.goalAmount} goal</Text>
            </View>
          </View>

          <ProgressRing progress={group.progress} />
        </View>

        {group.status === "active" && (group.savingModel !== "collective_goal" || group.collectiveGoal?.status === "saving") && <KasaButton
          label="Make a contribution"
          leftIcon={<Ionicons name="add-circle" size={18} color={COLORS.primary} />}
          onPress={() =>
            guardKyc("make a contribution", () => router.push({
              pathname: "/groups/[id]/contribute",
              params: {
                id,
                groupName: group.name,
                contributionAmount: group.contributionAmount,
                frequency: group.frequency,
              },
            }))
          }
          style={styles.contributeButton}
          variant="secondary"
        />}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                key={tab.key}
                style={({ pressed }) => [styles.tabItem, isActive && styles.tabItemActive, pressed && styles.tabItemPressed]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {activeTab === "overview" && (
          <OverviewTab
            financialAction={financialAction}
            group={group}
            isOwner={membershipRole === "owner"}
            isActivating={isActivating}
            canExtendGrace={
              membershipRole === "owner" || membershipRole === "treasurer"
            }
            canManageResolution={
              membershipRole === "owner" || membershipRole === "treasurer"
            }
            onCreateResolution={createResolution}
            onExtendGrace={extendGracePeriod}
            onVote={voteOnResolution}
            onActivate={activateGroup}
            onInvite={() => setInviteModalVisible(true)}
            onOpenCollectivePayout={() => router.push({ pathname: "/groups/[id]/collective-payout", params: { id } })}
          />
        )}
        {activeTab === "members" && (
          <MembersTab
            members={group.members}
            savingModel={group.savingModel}
            canInvite={membershipRole === "owner" || membershipRole === "treasurer"}
            canManageRoles={membershipRole === "owner"}
            onInvite={() => setInviteModalVisible(true)}
            onManageRole={manageMemberRole}
            onOpenProfile={(member) => {
              if (member.userId) router.push({ pathname: "/users/[id]", params: { id: member.userId } });
            }}
          />
        )}
        {activeTab === "contributions" && (
          <ContributionsTab contributions={group.contributions} groupStatus={group.status} />
        )}
        {activeTab === "payouts" && (group.savingModel === "collective_goal"
          ? <CollectiveDecisionsTab proposals={group.collectivePayouts} onOpen={() => router.push({ pathname: "/groups/[id]/collective-payout", params: { id } })} />
          : <PayoutsTab payouts={group.payouts} groupStatus={group.status} />)}
        {activeTab === "settings" && (
          <SettingsTab
            autoContributionEnabled={autoContribution.enabled}
            developmentSimulation={group.developmentSimulation}
            onArchive={archiveGroup}
            onAutoContribution={() => setAutoContributionModalVisible(true)}
            onDevelopmentTools={() => setPayoutTestToolsVisible(true)}
            onEdit={openGroupSettings}
            onInvite={() => setInviteModalVisible(true)}
            onLeave={leaveGroup}
            onManageRoles={() => setActiveTab("members")}
            onNotifications={() => router.push("/notifications_modal")}
            role={membershipRole}
            savingModel={group.savingModel}
          />
        )}
      </ScrollView>

      <ActivationReviewModal
        busy={isActivating}
        complete={activationComplete}
        error={activationError}
        group={group}
        onClose={closeActivationReview}
        onConfirm={() => void confirmGroupActivation()}
        onEditOrder={() => {
          closeActivationReview();
          openGroupSettings("rotation");
        }}
        visible={activationReviewVisible}
      />

      {!!id && (
        <InviteMembersModal
          existingUserIds={group.members.flatMap((member) => member.userId ? [member.userId] : [])}
          groupId={id}
          nextPayoutPosition={group.memberCount}
          onClose={() => setInviteModalVisible(false)}
          onInvited={() => setReloadKey((value) => value + 1)}
          visible={inviteModalVisible}
        />
      )}
      {!!id && (
        <AutoContributionModal
          amount={contributionAmount}
          groupId={id}
          groupName={group.name}
          initialSettings={autoContribution}
          onClose={() => setAutoContributionModalVisible(false)}
          onSaved={setAutoContribution}
          visible={autoContributionModalVisible}
        />
      )}
      {!!id && (
        <PayoutTestToolsModal
          groupId={id}
          initialSimulatedNow={group.developmentSimulation?.simulatedNow}
          onChanged={() => setReloadKey((value) => value + 1)}
          onClose={() => setPayoutTestToolsVisible(false)}
          visible={payoutTestToolsVisible}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Not found
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: COLORS.background,
  },
  notFoundTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 6,
  },
  notFoundSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  notFoundButton: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  notFoundButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.background,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 12,
  },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,27,22,0.62)",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    zIndex: 1,
  },
  heroIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroControlPressed: { backgroundColor: "rgba(255,255,255,0.24)", transform: [{ scale: 0.97 }] },
  heroActions: { flexDirection: "row", gap: 9 },
  heroChatBadge: { alignItems: "center", backgroundColor: COLORS.error, borderColor: COLORS.background, borderRadius: 9, borderWidth: 1.5, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 4, position: "absolute", right: -5, top: -5 },
  heroChatBadgeText: { color: COLORS.background, fontSize: 8, fontWeight: "800" },
  heroBody: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
    justifyContent: "space-between",
    marginBottom: 20,
  },
  heroGroupName: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.background,
    marginBottom: 4,
  },
  heroGroupType: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 14,
  },
  heroPotRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  heroPotAmount: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.background,
  },
  heroPotGoal: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  ringLabelWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ringLabelValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.background,
  },
  contributeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  contributeButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // Tab bar
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  tabBarContent: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 12,
  },
  tabItem: {
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  tabItemActive: {
    backgroundColor: COLORS.successSurface,
  },
  tabItemPressed: { opacity: 0.62 },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: "800",
  },

  // Tab content shared
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 4,
  },
  setupCard: {
    borderColor: "#CFE1DA",
    backgroundColor: "#F5FAF8",
    marginBottom: 16,
  },
  setupCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  setupIcon: {
    alignItems: "center",
    backgroundColor: COLORS.successSurface,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  setupTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  setupSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  setupBadge: {
    backgroundColor: "#FFF1CF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  setupBadgeText: {
    color: "#8A5D08",
    fontSize: 10,
    fontWeight: "800",
  },
  setupProgressTrack: {
    backgroundColor: "#DDE9E5",
    borderRadius: 999,
    height: 6,
    marginTop: 16,
    overflow: "hidden",
  },
  setupProgressFill: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: "100%",
  },
  setupBody: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  setupAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  setupActionText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: "800",
  },

  // Overview
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  statSublabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  nextPayoutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  collectiveGoalCard: { backgroundColor: "#F3F8F5", borderColor: "#D3E5DC", borderWidth: 1, padding: 16 },
  collectiveGoalHeader: { alignItems: "center", flexDirection: "row", gap: 10 },
  collectiveGoalIcon: { alignItems: "center", backgroundColor: COLORS.background, borderRadius: 11, height: 42, justifyContent: "center", width: 42 },
  collectiveGoalEyebrow: { color: COLORS.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  collectiveGoalTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800", marginTop: 2 },
  collectiveMoneyRow: { alignItems: "baseline", flexDirection: "row", marginTop: 18 },
  collectiveSaved: { color: COLORS.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  collectiveTarget: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  collectiveTrack: { backgroundColor: "#DCE9E3", borderRadius: 999, height: 7, marginTop: 10, overflow: "hidden" },
  collectiveFill: { backgroundColor: COLORS.primary, borderRadius: 999, height: "100%" },
  collectiveAvailable: { color: COLORS.textMuted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  collectiveVoteSummary: { alignItems: "center", backgroundColor: COLORS.background, borderColor: "#D3E5DC", borderRadius: 12, borderWidth: 1, flexDirection: "row", marginTop: 14, padding: 12 },
  collectiveVoteTitle: { color: COLORS.text, fontSize: 12, fontWeight: "800" },
  collectiveVoteBody: { color: COLORS.textMuted, fontSize: 10, marginTop: 3 },
  voteNeededBadge: { backgroundColor: "#F0EAFB", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  voteNeededText: { color: "#6D4BC3", fontSize: 9, fontWeight: "800" },
  collectiveAction: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 12, flexDirection: "row", justifyContent: "center", marginTop: 14, paddingVertical: 12 },
  collectiveActionText: { color: COLORS.background, fontSize: 12, fontWeight: "800", marginRight: 7 },
  discoverIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  freqLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  freqSublabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  payoutFundingRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 7,
  },
  payoutFundingDot: {
    borderRadius: 4,
    height: 7,
    marginRight: 6,
    width: 7,
  },
  payoutFundingTitle: {
    fontSize: 11,
    fontWeight: "700",
  },
  payoutFundingDetail: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginLeft: 4,
  },
  extendGraceButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  extendGraceButtonText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  proposeResolutionButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.primary,
    borderRadius: 9,
    flexDirection: "row",
    gap: 5,
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  proposeResolutionButtonText: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: "700",
  },
  resolutionCard: {
    backgroundColor: "#F7F4FF",
    borderColor: "#D9CFF5",
    borderRadius: 17,
    borderWidth: 1,
    marginBottom: 24,
    padding: 16,
  },
  resolutionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
  },
  resolutionIcon: {
    alignItems: "center",
    backgroundColor: "#EAE2FC",
    borderRadius: 11,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  resolutionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  resolutionSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  resolutionAmountRow: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    padding: 12,
  },
  resolutionOldAmount: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  resolutionNewAmount: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  resolutionDefaultText: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 11,
  },
  voteProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  voteProgressText: {
    color: "#6D4BC3",
    fontSize: 11,
    fontWeight: "800",
  },
  voteProgressMuted: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  voteTrack: {
    backgroundColor: "#E5DEF5",
    borderRadius: 4,
    height: 6,
    marginTop: 7,
    overflow: "hidden",
  },
  voteFill: {
    backgroundColor: "#6D4BC3",
    borderRadius: 4,
    height: 6,
  },
  voteActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  rejectVoteButton: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderColor: "#D9CFF5",
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 44,
  },
  rejectVoteText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: "700",
  },
  approveVoteButton: {
    alignItems: "center",
    backgroundColor: "#6D4BC3",
    borderRadius: 11,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 44,
  },
  approveVoteText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: "800",
  },
  financialActionDisabled: {
    opacity: 0.62,
  },
  voteRecorded: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 14,
  },
  voteRecordedText: {
    color: COLORS.textMuted,
    flex: 1,
    fontSize: 11,
  },

  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  collectiveHistoryRow: { alignItems: "center", backgroundColor: COLORS.background, borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 14 },
  activityHeading: { marginBottom: 12, marginTop: 4 },
  activityEmpty: { minHeight: 180 },
  tabEmptyState: { minHeight: 260 },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.successSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Members
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberProfileLink: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarFallback: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    justifyContent: "center",
  },
  memberAvatarInitial: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: "700",
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.successSurface,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.success,
  },
  memberMenuBtn: {
    padding: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },

  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginTop: 16,
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },

  activationModal: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  activationHeader: {
    alignItems: "flex-start",
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 16,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  activationEyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    marginBottom: 5,
  },
  activationTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  activationSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    maxWidth: 310,
  },
  activationContent: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  activationSummary: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  activationSummaryItem: {
    alignItems: "center",
    flex: 1,
  },
  activationSummaryDivider: {
    backgroundColor: "rgba(255,255,255,0.14)",
    width: StyleSheet.hairlineWidth,
  },
  activationSummaryLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 10,
    fontWeight: "600",
  },
  activationSummaryValue: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 5,
  },
  activationFrequency: {
    textTransform: "capitalize",
  },
  activationScheduleRow: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    padding: 14,
  },
  activationScheduleIcon: {
    alignItems: "center",
    backgroundColor: COLORS.successSurface,
    borderRadius: 11,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  activationRowTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  activationRowText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  activationSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 24,
  },
  activationSectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
  activationSectionCount: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  activationEditOrder: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 4,
  },
  activationEditOrderText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  activationOrderList: {
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  activationMemberRow: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  activationPosition: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 9,
    height: 30,
    justifyContent: "center",
    marginRight: 10,
    width: 30,
  },
  activationPositionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  activationAvatar: {
    borderRadius: 18,
    height: 36,
    marginRight: 10,
    width: 36,
  },
  activationMemberName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  activationMemberRole: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
    textTransform: "capitalize",
  },
  activationFirstBadge: {
    backgroundColor: "#FFF1CF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  activationFirstBadgeText: {
    color: "#8A5D08",
    fontSize: 9,
    fontWeight: "800",
  },
  activationNotice: {
    alignItems: "flex-start",
    backgroundColor: COLORS.successSurface,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    padding: 14,
  },
  activationNoticeText: {
    color: COLORS.textMuted,
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
  },
  activationError: {
    alignItems: "center",
    backgroundColor: COLORS.errorSurface,
    borderRadius: 12,
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
    padding: 12,
  },
  activationErrorText: {
    color: COLORS.error,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  activationFooter: {
    borderTopColor: COLORS.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  activationFooterHint: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 8,
    textAlign: "center",
  },
  activationSuccess: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  activationSuccessIcon: {
    alignItems: "center",
    backgroundColor: COLORS.success,
    borderRadius: 32,
    height: 64,
    justifyContent: "center",
    marginBottom: 18,
    width: 64,
  },
  activationSuccessTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  activationSuccessText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
    textAlign: "center",
  },
  activationDoneButton: {
    alignSelf: "center",
    marginTop: 24,
    maxWidth: 280,
  },

  inviteModalContainer: {
    backgroundColor: COLORS.background,
    flex: 1,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inviteModalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  inviteModalTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "700",
  },
  inviteModalSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  modalCloseButton: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  memberSearch: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    height: 48,
    paddingHorizontal: 13,
  },
  memberSearchInput: {
    color: COLORS.text,
    flex: 1,
    fontSize: 14,
    height: "100%",
  },
  inviteList: {
    gap: 10,
    paddingBottom: 20,
    paddingTop: 16,
  },
  inviteUserRow: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  inviteUserRowSelected: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.primary,
  },
  inviteCheckbox: {
    alignItems: "center",
    borderColor: COLORS.border,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  inviteCheckboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  inviteEmptyState: {
    alignItems: "center",
    flex: 1,
    gap: 9,
    justifyContent: "center",
    minHeight: 150,
  },
  sendInviteButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
  },
  sendInviteButtonDisabled: {
    opacity: 0.4,
  },
  sendInviteButtonText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: "700",
  },

  // Settings
  roleAccessCard: {
    alignItems: "center",
    backgroundColor: "#E8F5EE",
    borderRadius: 15,
    flexDirection: "row",
    marginBottom: 22,
    padding: 14,
  },
  roleAccessIcon: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    marginRight: 12,
    width: 42,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  developmentSettingsRow: {
    backgroundColor: "#F4F0FF",
    borderColor: "#D9CFF5",
  },
  testToolsContainer: {
    backgroundColor: COLORS.background,
    flex: 1,
    paddingBottom: 26,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  testWarning: {
    alignItems: "flex-start",
    backgroundColor: "#F4F0FF",
    borderColor: "#D9CFF5",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
    padding: 14,
  },
  testWarningText: {
    color: "#544172",
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  testStageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  testStageCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 15,
    borderWidth: 1,
    padding: 13,
    width: "48%",
  },
  testStageCardSelected: {
    backgroundColor: "#F4F0FF",
    borderColor: "#8B6FD1",
  },
  testStageIcon: {
    alignItems: "center",
    backgroundColor: "#ECE5FC",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    marginBottom: 10,
    width: 38,
  },
  testStageIconSelected: {
    backgroundColor: "#6D4BC3",
  },
  testStageTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  testStageDescription: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 3,
  },
  testClockCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    padding: 14,
  },
  testClockValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  resetClockButton: {
    backgroundColor: COLORS.errorSurface,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  resetClockText: {
    color: COLORS.error,
    fontSize: 11,
    fontWeight: "700",
  },
  runProcessorsButton: {
    alignItems: "center",
    backgroundColor: "#6D4BC3",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    height: 52,
    justifyContent: "center",
    marginTop: "auto",
  },
  runProcessorsButtonDisabled: {
    opacity: 0.45,
  },
  runProcessorsButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: "800",
  },
  settingsFeatureIcon: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  settingsFeatureIconActive: {
    backgroundColor: COLORS.primary,
  },
  settingsStatusPill: {
    backgroundColor: COLORS.background,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  settingsStatusPillActive: {
    backgroundColor: COLORS.successSurface,
  },
  settingsStatusText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  settingsStatusTextActive: {
    color: COLORS.success,
  },
  dangerRow: {
    borderColor: "#F3C9C4",
    backgroundColor: COLORS.errorSurface,
  },
});
