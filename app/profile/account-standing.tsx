import { AnimatedLoader } from "@/components/ui/AnimatedLoader";
import { apiService, type AccountStanding } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
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
  warning: "#A46716",
  warningSoft: "#FFF3DE",
  error: "#C0392B",
  errorSoft: "#FBEAE8",
};

function money(value: number) {
  return `GH₵ ${(value / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function date(value?: string | null) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS = {
  good: {
    title: "Good standing",
    description: "You can create and join KasaFund groups.",
    icon: "shield-checkmark" as const,
    color: C.primary,
    background: C.soft,
  },
  caution: {
    title: "Good standing with history",
    description: "You can join other groups, but suspended memberships remain closed.",
    icon: "shield-half-outline" as const,
    color: C.warning,
    background: C.warningSoft,
  },
  restricted: {
    title: "Account restricted",
    description: "Settle overdue group obligations before creating or joining groups.",
    icon: "alert-circle" as const,
    color: C.error,
    background: C.errorSoft,
  },
};

export default function AccountStandingScreen() {
  const router = useRouter();
  const [standing, setStanding] = useState<AccountStanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStanding = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await apiService.getAccountStanding();
      setStanding(response.data);
    } catch (error) {
      Alert.alert(
        "Couldn’t load account standing",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStanding();
    }, [loadStanding])
  );

  const config = STATUS[standing?.level || "good"];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={21} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account standing</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <AnimatedLoader size="regular" />
        </View>
      ) : standing ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              onRefresh={() => void loadStanding(true)}
              refreshing={refreshing}
              tintColor={C.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.statusCard, { backgroundColor: config.background }]}>
            <View style={[styles.statusIcon, { backgroundColor: C.surface }]}>
              <Ionicons name={config.icon} size={27} color={config.color} />
            </View>
            <Text style={[styles.statusTitle, { color: config.color }]}>
              {config.title}
            </Text>
            <Text style={styles.statusDescription}>{config.description}</Text>
            <View style={styles.eligibilityRow}>
              <Ionicons
                name={standing.canCreateOrJoinGroups ? "checkmark-circle" : "close-circle"}
                size={17}
                color={standing.canCreateOrJoinGroups ? C.primary : C.error}
              />
              <Text style={styles.eligibilityText}>
                {standing.canCreateOrJoinGroups
                  ? "Group participation available"
                  : "New group participation paused"}
              </Text>
            </View>
          </View>

          {!!standing.openObligations.length && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Open obligations</Text>
                  <Text style={styles.sectionSubtitle}>
                    {money(standing.outstandingAmount)} outstanding
                  </Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{standing.openObligations.length}</Text>
                </View>
              </View>
              {standing.openObligations.map((obligation) => (
                <View key={obligation._id} style={styles.card}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="cash-outline" size={19} color={C.error} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{obligation.group.name}</Text>
                      <Text style={styles.rowSubtitle}>
                        Cycle {obligation.cycleNumber} · Due {date(obligation.dueDate)}
                      </Text>
                    </View>
                    <Text style={styles.amount}>{money(obligation.amountDue)}</Text>
                  </View>
                  {obligation.creditor?.fullName && (
                    <Text style={styles.recoveryText}>
                      Recovery is owed to {obligation.creditor.fullName}
                    </Text>
                  )}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      obligation.liabilityType === "post_payout_debt"
                        ? router.push("/wallet/debts")
                        : router.push({
                            pathname: "/groups/[id]",
                            params: { id: obligation.group._id },
                          })
                    }
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>
                      {obligation.liabilityType === "post_payout_debt"
                        ? "Repay debt"
                        : "Review contribution"}
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={C.surface} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Suspended memberships</Text>
                <Text style={styles.sectionSubtitle}>
                  Permanent group-level restrictions
                </Text>
              </View>
            </View>
            {standing.suspendedGroups.length ? (
              standing.suspendedGroups.map((membership) => (
                <View key={membership._id} style={styles.card}>
                  <View style={styles.rowTop}>
                    <View style={[styles.rowIcon, styles.suspendedIcon]}>
                      <Ionicons name="ban-outline" size={19} color={C.error} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{membership.group.name}</Text>
                      <Text style={styles.rowSubtitle}>
                        Suspended {date(membership.suspendedAt)}
                      </Text>
                    </View>
                    <View style={styles.permanentBadge}>
                      <Text style={styles.permanentText}>Closed</Text>
                    </View>
                  </View>
                  <Text style={styles.historyNote}>
                    Repayment restores your overall account standing but does not reopen
                    this membership.
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={22} color={C.primary} />
                <Text style={styles.emptyText}>No suspended group memberships.</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Repayment history</Text>
                <Text style={styles.sectionSubtitle}>Settled account debts</Text>
              </View>
            </View>
            {standing.repaymentHistory.length ? (
              standing.repaymentHistory.map((payment) => (
                <View key={payment._id} style={styles.historyRow}>
                  <View style={styles.historyIcon}>
                    <Ionicons name="checkmark" size={17} color={C.primary} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{payment.group.name}</Text>
                    <Text style={styles.rowSubtitle}>
                      Paid {date(payment.paidAt)} · {payment.paymentMethod.replace("_", " ")}
                    </Text>
                  </View>
                  <Text style={styles.historyAmount}>{money(payment.amount)}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={22} color={C.muted} />
                <Text style={styles.emptyText}>No debt repayments recorded.</Text>
              </View>
            )}
          </View>

          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={18} color={C.primary} />
            <Text style={styles.infoText}>
              Account standing is calculated from recorded group obligations and
              membership decisions. Trust scores are calculated separately.
            </Text>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: C.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: C.surface, borderColor: C.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  headerSpacer: { height: 42, width: 42 },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  loader: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { paddingBottom: 48, paddingHorizontal: 20 },
  statusCard: { alignItems: "center", borderRadius: 22, marginBottom: 28, marginTop: 12, padding: 22 },
  statusIcon: { alignItems: "center", borderRadius: 19, height: 60, justifyContent: "center", marginBottom: 13, width: 60 },
  statusTitle: { fontSize: 20, fontWeight: "800" },
  statusDescription: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  eligibilityRow: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 14, flexDirection: "row", marginTop: 16, paddingHorizontal: 13, paddingVertical: 9 },
  eligibilityText: { color: C.text, fontSize: 11, fontWeight: "700", marginLeft: 7 },
  section: { marginBottom: 26 },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 11 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  sectionSubtitle: { color: C.muted, fontSize: 10, marginTop: 3 },
  countBadge: { alignItems: "center", backgroundColor: C.errorSoft, borderRadius: 12, minWidth: 28, paddingHorizontal: 8, paddingVertical: 6 },
  countText: { color: C.error, fontSize: 11, fontWeight: "800" },
  card: { backgroundColor: C.surface, borderColor: C.border, borderRadius: 17, borderWidth: 1, marginBottom: 10, padding: 15 },
  rowTop: { alignItems: "center", flexDirection: "row" },
  rowIcon: { alignItems: "center", backgroundColor: C.errorSoft, borderRadius: 11, height: 40, justifyContent: "center", marginRight: 10, width: 40 },
  suspendedIcon: { backgroundColor: C.errorSoft },
  rowCopy: { flex: 1 },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  rowSubtitle: { color: C.muted, fontSize: 10, marginTop: 3, textTransform: "capitalize" },
  amount: { color: C.error, fontSize: 13, fontWeight: "800" },
  recoveryText: { color: C.muted, fontSize: 10, marginTop: 12 },
  primaryButton: { alignItems: "center", backgroundColor: C.primary, borderRadius: 11, flexDirection: "row", justifyContent: "center", marginTop: 13, paddingVertical: 11 },
  primaryButtonText: { color: C.surface, fontSize: 12, fontWeight: "800", marginRight: 6 },
  permanentBadge: { backgroundColor: C.errorSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  permanentText: { color: C.error, fontSize: 9, fontWeight: "800" },
  historyNote: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 12 },
  emptyCard: { alignItems: "center", backgroundColor: C.surface, borderColor: C.border, borderRadius: 15, borderWidth: 1, flexDirection: "row", padding: 15 },
  emptyText: { color: C.muted, fontSize: 11, marginLeft: 9 },
  historyRow: { alignItems: "center", backgroundColor: C.surface, borderBottomColor: C.border, borderBottomWidth: 1, flexDirection: "row", paddingHorizontal: 14, paddingVertical: 13 },
  historyIcon: { alignItems: "center", backgroundColor: C.soft, borderRadius: 10, height: 36, justifyContent: "center", marginRight: 10, width: 36 },
  historyAmount: { color: C.primary, fontSize: 12, fontWeight: "800" },
  infoNote: { alignItems: "flex-start", backgroundColor: C.soft, borderRadius: 14, flexDirection: "row", padding: 14 },
  infoText: { color: C.muted, flex: 1, fontSize: 10, lineHeight: 16, marginLeft: 9 },
});
