import { AnimatedLoader } from "@/components/ui/AnimatedLoader";
import { apiService, type ApiGroupLedger } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const C = {
  primary: "#0B4D3E",
  primaryDark: "#07372C",
  background: "#F5F7F6",
  surface: "#FFFFFF",
  soft: "#E5F2ED",
  border: "#DFE7E3",
  text: "#12211C",
  muted: "#697873",
  success: "#16835D",
  warning: "#A46716",
  warningSoft: "#FFF3DE",
  error: "#C0392B",
  errorSoft: "#FBEAE8",
  white: "#FFFFFF",
};

type LedgerCycle = ApiGroupLedger["cycles"][number];

function money(value: number) {
  return `GH₵ ${(value / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function initials(name = "Member") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function cycleStatus(cycle: LedgerCycle) {
  if (cycle.payout.closureReason === "resolution_deadlock") {
    return { label: "Refunded", color: C.warning, background: C.warningSoft };
  }
  if (cycle.payout.status === "completed") {
    return { label: "Completed", color: C.success, background: C.soft };
  }
  if (cycle.payout.status === "failed") {
    return { label: "Failed", color: C.error, background: C.errorSoft };
  }
  if (cycle.payout.fundingStatus === "overdue") {
    return { label: "Overdue", color: C.error, background: C.errorSoft };
  }
  if (cycle.payout.fundingStatus === "ready") {
    return { label: "Ready", color: C.primary, background: C.soft };
  }
  return { label: "Collecting", color: C.warning, background: C.warningSoft };
}

function shareStatement(groupName: string, cycle: LedgerCycle) {
  const paid = cycle.members.filter(
    (member) => member.status === "paid" || member.status === "refunded"
  ).length;
  const lines = [
    `${groupName} · Cycle ${cycle.cycleNumber}`,
    `Round ${cycle.rotationRound}`,
    `Scheduled: ${formatDate(cycle.scheduledDate)}`,
    `Recipient: ${cycle.recipient?.fullName || "Not assigned"}`,
    `Contributions: ${paid}/${cycle.members.length}`,
    `Collected: ${money(cycle.collectedAmount)}`,
    `Payout: ${money(cycle.payout.actualAmount)} (${cycleStatus(cycle).label})`,
    cycle.resolution
      ? `Resolution: ${cycle.resolution.status} (${cycle.resolution.yesVotes} approve, ${cycle.resolution.noVotes} reject)`
      : null,
    "",
    "Generated from KasaFund's group cycle ledger.",
  ].filter(Boolean);
  return Share.share({ message: lines.join("\n"), title: `${groupName} cycle statement` });
}

function MemberPayment({ member }: { member: LedgerCycle["members"][number] }) {
  const status = member.status === "paid"
    ? { icon: "checkmark" as const, color: C.success, background: C.soft, label: "Paid" }
    : member.status === "refunded"
      ? { icon: "return-down-back" as const, color: C.warning, background: C.warningSoft, label: "Refunded" }
    : member.status === "defaulted"
      ? { icon: "close" as const, color: C.error, background: C.errorSoft, label: "Defaulted" }
      : { icon: "time-outline" as const, color: C.warning, background: C.warningSoft, label: "Pending" };
  const name = member.user?.fullName || "Former member";

  return (
    <View style={styles.memberRow}>
      {member.user?.avatarUrl ? (
        <Image source={{ uri: member.user.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{initials(name)}</Text>
        </View>
      )}
      <View style={styles.memberCopy}>
        <Text numberOfLines={1} style={styles.memberName}>{name}</Text>
        <Text style={styles.memberMeta}>
          {member.status === "paid"
            ? `${formatDate(member.paidAt, true)} · ${member.paymentMethod?.replace("_", " ")}`
            : member.status === "refunded"
              ? `Returned ${formatDate(member.refundedAt, true)}`
            : member.delinquencyStatus === "paid"
              ? "Debt later repaid"
              : status.label}
        </Text>
      </View>
      <View style={styles.memberAmountWrap}>
        <Text style={styles.memberAmount}>{money(member.amount)}</Text>
        <View style={[styles.memberStatus, { backgroundColor: status.background }]}>
          <Ionicons name={status.icon} size={11} color={status.color} />
          <Text style={[styles.memberStatusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
    </View>
  );
}

function CycleCard({
  cycle,
  expanded,
  groupName,
  onToggle,
}: {
  cycle: LedgerCycle;
  expanded: boolean;
  groupName: string;
  onToggle: () => void;
}) {
  const status = cycleStatus(cycle);
  const paidCount = cycle.members.filter(
    (member) => member.status === "paid" || member.status === "refunded"
  ).length;
  const progress = cycle.members.length ? paidCount / cycle.members.length : 0;

  return (
    <View style={styles.cycleCard}>
      <TouchableOpacity activeOpacity={0.82} onPress={onToggle} style={styles.cycleHeader}>
        <View style={styles.cycleNumber}>
          <Text style={styles.cycleNumberLabel}>CYCLE</Text>
          <Text style={styles.cycleNumberValue}>{cycle.cycleNumber}</Text>
        </View>
        <View style={styles.cycleHeaderCopy}>
          <Text style={styles.cycleTitle}>Round {cycle.rotationRound}</Text>
          <Text style={styles.cycleDate}>{formatDate(cycle.scheduledDate)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={C.muted}
          style={styles.chevron}
        />
      </TouchableOpacity>

      <View style={styles.cycleProgressRow}>
        <Text style={styles.progressLabel}>
          {paidCount} of {cycle.members.length} contributed
        </Text>
        <Text style={styles.progressAmount}>{money(cycle.collectedAmount)}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
      </View>

      {expanded && (
        <View style={styles.expanded}>
          <View style={styles.recipientRow}>
            <View style={styles.recipientIcon}>
              <Ionicons name="person-outline" size={18} color={C.primary} />
            </View>
            <View style={styles.memberCopy}>
              <Text style={styles.detailLabel}>PAYOUT RECIPIENT</Text>
              <Text style={styles.detailValue}>{cycle.recipient?.fullName || "Not assigned"}</Text>
            </View>
            <View style={styles.recipientAmount}>
              <Text style={styles.detailLabel}>PAYOUT</Text>
              <Text style={styles.payoutAmount}>{money(cycle.payout.actualAmount)}</Text>
            </View>
          </View>

          <View style={styles.financialGrid}>
            <View style={styles.financialCell}>
              <Text style={styles.detailLabel}>EXPECTED</Text>
              <Text style={styles.financialValue}>{money(cycle.expectedAmount)}</Text>
            </View>
            <View style={styles.financialCell}>
              <Text style={styles.detailLabel}>COLLECTED</Text>
              <Text style={[styles.financialValue, { color: C.success }]}>
                {money(cycle.collectedAmount)}
              </Text>
            </View>
            <View style={[styles.financialCell, styles.financialCellLast]}>
              <Text style={styles.detailLabel}>SHORTAGE</Text>
              <Text style={[styles.financialValue, cycle.shortageAmount > 0 && { color: C.error }]}>
                {money(cycle.shortageAmount)}
              </Text>
            </View>
          </View>

          {!!cycle.resolution && (
            <View style={styles.resolutionCard}>
              <View style={styles.resolutionIcon}>
                <Ionicons name="people-outline" size={18} color={C.warning} />
              </View>
              <View style={styles.memberCopy}>
                <Text style={styles.resolutionTitle}>Group resolution · {cycle.resolution.status}</Text>
                <Text style={styles.resolutionMeta}>
                  {cycle.resolution.yesVotes} approved · {cycle.resolution.noVotes} rejected · {cycle.resolution.requiredYesVotes} required
                </Text>
              </View>
            </View>
          )}

          <View style={styles.membersHeader}>
            <Text style={styles.membersTitle}>Member contributions</Text>
            <Text style={styles.membersCount}>{cycle.members.length} expected</Text>
          </View>
          {cycle.members.map((member, index) => (
            <MemberPayment
              key={`${member.user?._id || "former"}-${index}`}
              member={member}
            />
          ))}

          <View style={styles.auditRow}>
            <Ionicons name="shield-checkmark-outline" size={15} color={C.muted} />
            <Text style={styles.auditText}>
              {cycle.payout.closureReason === "resolution_deadlock"
                ? `Cycle closed and refunded ${formatDate(cycle.payout.closedAt, true)}`
                : cycle.payout.paidAt
                ? `Payout recorded ${formatDate(cycle.payout.paidAt, true)}`
                : `Grace deadline ${formatDate(cycle.graceEndsAt, true)}`}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => void shareStatement(groupName, cycle)}
            style={styles.shareButton}
          >
            <Ionicons name="share-outline" size={17} color={C.primary} />
            <Text style={styles.shareButtonText}>Share cycle statement</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function GroupLedgerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ledger, setLedger] = useState<ApiGroupLedger | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLedger = useCallback(async (refresh = false) => {
    if (!id) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await apiService.getGroupLedger(id);
      setLedger(response.data);
      setExpandedId((current) => current || response.data.cycles[0]?._id || null);
    } catch (error) {
      Alert.alert(
        "Couldn’t load cycle ledger",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={21} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Cycle ledger</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>{ledger?.group.name || "Group records"}</Text>
        </View>
        <View style={styles.verifiedLedger}>
          <Ionicons name="shield-checkmark" size={19} color={C.primary} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}><AnimatedLoader accessibilityLabel="Loading cycle ledger" /></View>
      ) : ledger ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              onRefresh={() => void loadLedger(true)}
              refreshing={refreshing}
              tintColor={C.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryEyebrow}>GROUP FINANCIAL RECORD</Text>
            <Text style={styles.summaryValue}>{money(ledger.summary.totalCollected)}</Text>
            <Text style={styles.summaryLabel}>total contributions recorded</Text>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>{ledger.summary.totalCycles}</Text>
                <Text style={styles.summaryStatLabel}>Cycles</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>{ledger.summary.completedCycles}</Text>
                <Text style={styles.summaryStatLabel}>Completed</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatMoney}>{money(ledger.summary.totalPaidOut)}</Text>
                <Text style={styles.summaryStatLabel}>Paid out</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Cycle statements</Text>
              <Text style={styles.sectionSubtitle}>Newest cycle first</Text>
            </View>
            <View style={styles.readOnlyBadge}>
              <Ionicons name="lock-closed-outline" size={12} color={C.muted} />
              <Text style={styles.readOnlyText}>Read only</Text>
            </View>
          </View>

          {ledger.cycles.length ? (
            ledger.cycles.map((cycle) => (
              <CycleCard
                cycle={cycle}
                expanded={expandedId === cycle._id}
                groupName={ledger.group.name}
                key={cycle._id}
                onToggle={() => setExpandedId((current) => current === cycle._id ? null : cycle._id)}
              />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={24} color={C.primary} />
              </View>
              <Text style={styles.emptyTitle}>No cycle records yet</Text>
              <Text style={styles.emptyText}>
                The first statement will appear when this group’s initial payout cycle is scheduled.
              </Text>
            </View>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: C.background, flex: 1 },
  header: { alignItems: "center", borderBottomColor: C.border, borderBottomWidth: 1, flexDirection: "row", paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: C.surface, borderColor: C.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  headerCopy: { flex: 1, marginHorizontal: 12 },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  headerSubtitle: { color: C.muted, fontSize: 10, marginTop: 2 },
  verifiedLedger: { alignItems: "center", backgroundColor: C.soft, borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  loader: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { paddingBottom: 48, paddingHorizontal: 18, paddingTop: 18 },
  summaryCard: { backgroundColor: C.primaryDark, borderRadius: 22, marginBottom: 25, overflow: "hidden", padding: 20 },
  summaryEyebrow: { color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  summaryValue: { color: C.white, fontSize: 29, fontWeight: "800", letterSpacing: -0.7, marginTop: 9 },
  summaryLabel: { color: "rgba(255,255,255,0.65)", fontSize: 10, marginTop: 3 },
  summaryDivider: { backgroundColor: "rgba(255,255,255,0.12)", height: 1, marginVertical: 18 },
  summaryStats: { flexDirection: "row" },
  summaryStat: { flex: 1 },
  summaryStatValue: { color: C.white, fontSize: 18, fontWeight: "800" },
  summaryStatMoney: { color: C.white, fontSize: 13, fontWeight: "800", marginTop: 3 },
  summaryStatLabel: { color: "rgba(255,255,255,0.55)", fontSize: 9, marginTop: 3 },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  sectionSubtitle: { color: C.muted, fontSize: 10, marginTop: 3 },
  readOnlyBadge: { alignItems: "center", backgroundColor: C.surface, borderColor: C.border, borderRadius: 12, borderWidth: 1, flexDirection: "row", paddingHorizontal: 9, paddingVertical: 6 },
  readOnlyText: { color: C.muted, fontSize: 9, fontWeight: "700", marginLeft: 4 },
  cycleCard: { backgroundColor: C.surface, borderColor: C.border, borderRadius: 18, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  cycleHeader: { alignItems: "center", flexDirection: "row", padding: 14 },
  cycleNumber: { alignItems: "center", backgroundColor: C.soft, borderRadius: 11, height: 44, justifyContent: "center", marginRight: 10, width: 44 },
  cycleNumberLabel: { color: C.primary, fontSize: 7, fontWeight: "800", letterSpacing: 0.6 },
  cycleNumberValue: { color: C.primaryDark, fontSize: 16, fontWeight: "800" },
  cycleHeaderCopy: { flex: 1 },
  cycleTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  cycleDate: { color: C.muted, fontSize: 9, marginTop: 3 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 8, fontWeight: "800" },
  chevron: { marginLeft: 7 },
  cycleProgressRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 },
  progressLabel: { color: C.muted, fontSize: 9 },
  progressAmount: { color: C.text, fontSize: 10, fontWeight: "800" },
  progressTrack: { backgroundColor: C.border, borderRadius: 2, height: 4, marginHorizontal: 14, marginVertical: 11, overflow: "hidden" },
  progressFill: { backgroundColor: C.success, borderRadius: 2, height: 4 },
  expanded: { borderTopColor: C.border, borderTopWidth: 1, padding: 14 },
  recipientRow: { alignItems: "center", flexDirection: "row" },
  recipientIcon: { alignItems: "center", backgroundColor: C.soft, borderRadius: 11, height: 40, justifyContent: "center", marginRight: 10, width: 40 },
  recipientAmount: { alignItems: "flex-end" },
  detailLabel: { color: C.muted, fontSize: 7, fontWeight: "800", letterSpacing: 0.5 },
  detailValue: { color: C.text, fontSize: 12, fontWeight: "800", marginTop: 3 },
  payoutAmount: { color: C.primary, fontSize: 13, fontWeight: "800", marginTop: 3 },
  financialGrid: { backgroundColor: C.background, borderRadius: 13, flexDirection: "row", marginTop: 14, paddingVertical: 12 },
  financialCell: { borderRightColor: C.border, borderRightWidth: 1, flex: 1, paddingHorizontal: 10 },
  financialCellLast: { borderRightWidth: 0 },
  financialValue: { color: C.text, fontSize: 10, fontWeight: "800", marginTop: 4 },
  resolutionCard: { alignItems: "center", backgroundColor: C.warningSoft, borderRadius: 13, flexDirection: "row", marginTop: 12, padding: 11 },
  resolutionIcon: { alignItems: "center", backgroundColor: C.surface, borderRadius: 10, height: 36, justifyContent: "center", marginRight: 9, width: 36 },
  resolutionTitle: { color: C.warning, fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
  resolutionMeta: { color: C.muted, fontSize: 8, marginTop: 3 },
  membersHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 5, marginTop: 17 },
  membersTitle: { color: C.text, fontSize: 12, fontWeight: "800" },
  membersCount: { color: C.muted, fontSize: 8 },
  memberRow: { alignItems: "center", borderBottomColor: C.border, borderBottomWidth: 1, flexDirection: "row", paddingVertical: 10 },
  avatar: { borderRadius: 16, height: 32, marginRight: 8, width: 32 },
  avatarFallback: { alignItems: "center", backgroundColor: C.soft, justifyContent: "center" },
  avatarText: { color: C.primary, fontSize: 9, fontWeight: "800" },
  memberCopy: { flex: 1 },
  memberName: { color: C.text, fontSize: 10, fontWeight: "700" },
  memberMeta: { color: C.muted, fontSize: 8, marginTop: 3, textTransform: "capitalize" },
  memberAmountWrap: { alignItems: "flex-end" },
  memberAmount: { color: C.text, fontSize: 9, fontWeight: "800" },
  memberStatus: { alignItems: "center", borderRadius: 8, flexDirection: "row", marginTop: 4, paddingHorizontal: 5, paddingVertical: 3 },
  memberStatusText: { fontSize: 7, fontWeight: "800", marginLeft: 2 },
  auditRow: { alignItems: "center", flexDirection: "row", marginTop: 12 },
  auditText: { color: C.muted, fontSize: 8, marginLeft: 5 },
  shareButton: { alignItems: "center", borderColor: C.border, borderRadius: 11, borderWidth: 1, flexDirection: "row", justifyContent: "center", marginTop: 13, paddingVertical: 10 },
  shareButtonText: { color: C.primary, fontSize: 10, fontWeight: "800", marginLeft: 6 },
  emptyCard: { alignItems: "center", backgroundColor: C.surface, borderColor: C.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 30, paddingVertical: 34 },
  emptyIcon: { alignItems: "center", backgroundColor: C.soft, borderRadius: 17, height: 54, justifyContent: "center", marginBottom: 12, width: 54 },
  emptyTitle: { color: C.text, fontSize: 14, fontWeight: "800" },
  emptyText: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 5, textAlign: "center" },
});
