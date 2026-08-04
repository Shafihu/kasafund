import { KasaCard, KasaSectionHeader, KasaStateView, KasaStatusBadge } from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { useKycGate } from "@/hooks/useKycGate";
import {
  apiService,
  type ApiWalletTransaction,
  type GroupDebt,
  type SavingsPot,
} from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: kasaColors.brand,
  primaryDark: kasaColors.brandStrong,
  accent: kasaColors.accent,
  background: kasaColors.background,
  surface: kasaColors.surface,
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

type TransactionType =
  | "contribution"
  | "contribution_refund"
  | "payout"
  | "donation"
  | "withdrawal"
  | "deposit"
  | "savings_deposit"
  | "savings_withdrawal"
  | "debt_repayment"
  | "debt_recovery"
  | "transfer";

type Transaction = {
  id: string;
  type: TransactionType;
  title: string;
  subtitle: string;
  amount: number; // positive = credit, negative = debit, in pesewas
  date: string;
  createdAt: string;
  status: "completed" | "pending" | "failed";
};

const TRANSACTION_ICONS: Record<
  TransactionType,
  keyof typeof Ionicons.glyphMap
> = {
  contribution: "arrow-up-circle",
  contribution_refund: "return-down-back",
  payout: "arrow-down-circle",
  donation: "heart",
  withdrawal: "arrow-redo-circle",
  deposit: "add-circle",
  savings_deposit: "leaf",
  savings_withdrawal: "wallet",
  debt_repayment: "shield-outline",
  debt_recovery: "shield-checkmark",
  transfer: "swap-horizontal",
};

function formatAmount(amount: number) {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}GH₵ ${(Math.abs(amount) / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTransactionDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function mapWalletTransaction(transaction: ApiWalletTransaction): Transaction {
  const isDeposit = transaction.type === "deposit";
  const isPayout = transaction.type === "payout";
  const isContribution = transaction.type === "contribution";
  const isContributionRefund = transaction.type === "contribution_refund";
  const isSavingsDeposit = transaction.type === "savings_deposit";
  const isSavingsWithdrawal = transaction.type === "savings_withdrawal";
  const isDebtRepayment = transaction.type === "debt_repayment";
  const isDebtRecovery = transaction.type === "debt_recovery";
  const isCredit =
    isDeposit ||
    isPayout ||
    isContributionRefund ||
    isSavingsWithdrawal ||
    isDebtRecovery;
  const destination = transaction.destination;
  const demoPrefix = transaction.transferMode === "mock" ? "Demo • " : "";
  return {
    id: transaction._id,
    type: transaction.type,
    title: isPayout
      ? "Group payout received"
      : isDeposit
        ? "Money added"
        : isContributionRefund
          ? "Contribution returned"
        : isContribution
          ? "Group contribution"
          : isSavingsDeposit
            ? "Saved to My Susu"
            : isSavingsWithdrawal
              ? "Moved from My Susu"
              : isDebtRepayment
                ? "Group debt repaid"
                : isDebtRecovery
                  ? "Late contribution recovered"
          : "Wallet withdrawal",
    subtitle: isPayout
      ? transaction.groupName || "Group rotation payout"
      : isDeposit
      ? transaction.channel
        ? transaction.channel.replaceAll("_", " ")
        : "Paystack deposit"
      : isContribution || isContributionRefund
        ? transaction.groupName || "Automatic wallet contribution"
        : isSavingsDeposit || isSavingsWithdrawal
          ? transaction.savingsPotName || "Personal savings"
        : isDebtRepayment || isDebtRecovery
          ? transaction.groupName || "Group contribution debt"
        : `${demoPrefix}${destination?.providerName || "Mobile money"}${
          destination?.accountLast4 ? ` ····${destination.accountLast4}` : ""
        }`,
    amount: isCredit ? transaction.amount : -transaction.amount,
    date: formatTransactionDate(transaction.createdAt),
    createdAt: transaction.createdAt,
    status:
      transaction.status === "completed"
        ? "completed"
        : transaction.status === "failed" || transaction.status === "reversed"
          ? "failed"
          : "pending",
  };
}

function StatusDot({ status }: { status: Transaction["status"] }) {
  if (status === "completed") return null;
  const label = status === "pending" ? "Pending" : "Failed";
  return <KasaStatusBadge compact label={label} tone={status === "pending" ? "warning" : "danger"} />;
}

function transactionSection(value: string) {
  const now = new Date();
  const transactionDate = new Date(value);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());
  const daysAgo = Math.floor((today.getTime() - day.getTime()) / 86_400_000);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo <= 7) return "Earlier this week";
  return "Older";
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.amount >= 0;
  const iconColors = tx.status === "failed"
    ? { background: COLORS.errorSurface, foreground: COLORS.error }
    : tx.status === "pending"
      ? { background: COLORS.warningSurface, foreground: COLORS.warning }
      : tx.type === "donation"
        ? { background: "#FCEFF3", foreground: "#A33D60" }
        : tx.type === "savings_deposit" || tx.type === "savings_withdrawal"
          ? { background: kasaColors.brandSoft, foreground: COLORS.primary }
          : isCredit
            ? { background: COLORS.successSurface, foreground: COLORS.success }
            : { background: kasaColors.surfaceMuted, foreground: COLORS.textMuted };
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIconWrap, { backgroundColor: iconColors.background }]}>
        <Ionicons
          name={TRANSACTION_ICONS[tx.type]}
          size={20}
          color={iconColors.foreground}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {tx.title}
        </Text>
        <Text numberOfLines={1} style={styles.txSubtitle}>{tx.subtitle}</Text>
        <Text style={styles.txDate}>{tx.date}</Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={[
            styles.txAmount,
            { color: isCredit ? COLORS.success : COLORS.text },
          ]}
        >
          {formatAmount(tx.amount)}
        </Text>
        <StatusDot status={tx.status} />
      </View>
    </View>
  );
}

function EmptyState({ onAddMoney }: { onAddMoney: () => void }) {
  return (
    <KasaStateView
      actionLabel="Add money"
      icon="receipt-outline"
      kind="empty"
      message="Your deposits, group payouts and withdrawals will appear here."
      onAction={onAddMoney}
      style={styles.emptyState}
      title="No transactions yet"
    />
  );
}

export default function WalletScreen() {
  const { guardKyc } = useKycGate();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hideBalanceByDefault = user?.preferences?.hideWalletBalance ?? false;
  const [balanceVisible, setBalanceVisible] = useState(!hideBalanceByDefault);
  const [walletBalance, setWalletBalance] = useState(user?.walletBalance ?? 0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savingsPots, setSavingsPots] = useState<SavingsPot[]>([]);
  const [debts, setDebts] = useState<GroupDebt[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setBalanceVisible(!hideBalanceByDefault);
  }, [hideBalanceByDefault]);

  const loadWallet = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setLoadError(null);
    try {
      const [walletResponse, savingsResponse, debtResponse] = await Promise.all([
        apiService.getWallet(),
        apiService.getSavingsPots(),
        apiService.getGroupDebts(),
      ]);
      setWalletBalance(walletResponse.data.balance);
      setTransactions(walletResponse.data.transactions.map(mapWalletTransaction));
      setSavingsPots(savingsResponse.data);
      setDebts(debtResponse.data.debts);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      setLoadError(message);
      if (showRefresh) {
        Alert.alert("Couldn’t refresh wallet", message);
      }
    } finally {
      setInitialLoading(false);
      if (showRefresh) setRefreshing(false);
    }
  }, []);

  const transactionSections = useMemo(
    () => ["Today", "Yesterday", "Earlier this week", "Older"]
      .map((title) => ({
        title,
        data: transactions.filter((transaction) => transactionSection(transaction.createdAt) === title),
      }))
      .filter((section) => section.data.length > 0),
    [transactions],
  );

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet])
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <SectionList
        sections={transactionSections}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadWallet(true)}
            refreshing={refreshing}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          initialLoading ? (
            <KasaStateView kind="loading" style={styles.emptyState} title="Loading wallet" />
          ) : loadError ? (
            <KasaStateView
              actionLabel="Try again"
              kind="error"
              message={loadError}
              onAction={() => loadWallet()}
              style={styles.emptyState}
              title="Wallet unavailable"
            />
          ) : (
            <EmptyState
              onAddMoney={() => guardKyc("add money to your wallet", () => router.push("/wallet/add-money"))}
            />
          )
        }
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Wallet</Text>
              <Pressable
                accessibilityLabel="Refresh wallet"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => loadWallet(true)}
                style={({ pressed }) => [styles.headerIconBtn, pressed && styles.iconPressed]}
              >
                <Ionicons name="sync-outline" size={20} color={COLORS.text} />
              </Pressable>
            </View>

            {/* Balance card */}
            <LinearGradient
              colors={["#12604F", "#0B4D3E", "#06352C"]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.balanceCard}
            >
              <View pointerEvents="none" style={styles.cardRingLarge} />
              <View pointerEvents="none" style={styles.cardRingSmall} />
              <View pointerEvents="none" style={styles.cardGlow} />

              <View style={styles.balanceTopRow}>
                <View style={styles.balanceLabelRow}>
                  <View style={styles.walletMark}>
                    <Ionicons name="wallet-outline" size={14} color={COLORS.accent} />
                  </View>
                  <Text style={styles.balanceLabel}>Available balance</Text>
                </View>
                <Pressable
                  accessibilityLabel={balanceVisible ? "Hide wallet balance" : "Show wallet balance"}
                  accessibilityRole="button"
                  onPress={() => setBalanceVisible((v) => !v)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.eyeButton, pressed && styles.cardControlPressed]}
                >
                  <Ionicons
                    name={balanceVisible ? "eye-outline" : "eye-off-outline"}
                    size={18}
                    color="rgba(255,255,255,0.8)"
                  />
                </Pressable>
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.currencyLabel}>GH₵</Text>
                <Text style={styles.balanceValue}>
                  {balanceVisible
                    ? (walletBalance / 100).toLocaleString("en-GH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "••••••"}
                </Text>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.cardControlPressed]}
                  onPress={() => guardKyc("add money to your wallet", () => router.push("/wallet/add-money"))}
                >
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="add" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.actionLabel}>Add Money</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.cardControlPressed]}
                  onPress={() => guardKyc("withdraw money", () => router.push("/wallet/withdraw"))}
                >
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="arrow-up" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.actionLabel}>Withdraw</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.cardControlPressed]}
                  onPress={() => guardKyc("transfer money", () =>
                    Alert.alert("Transfer", "Direct wallet transfers are coming soon.")
                  )}
                >
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="swap-horizontal" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.actionLabel}>Transfer</Text>
                </Pressable>
              </View>
            </LinearGradient>

            <Pressable
              accessibilityRole="button"
              onPress={() => guardKyc("manage personal savings", () => router.push("/wallet/my-susu"))}
              style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
            >
              <KasaCard style={styles.susuCard}>
                <View style={styles.susuIcon}>
                  <Ionicons color={COLORS.primary} name="leaf" size={22} />
                </View>
                <View style={styles.susuCopy}>
                  <View style={styles.susuTitleRow}>
                    <Text style={styles.susuTitle}>My Susu</Text>
                    {!!savingsPots.length && (
                      <KasaStatusBadge compact label={`${savingsPots.length} ${savingsPots.length === 1 ? "pot" : "pots"}`} tone="success" />
                    )}
                  </View>
                  <Text style={styles.susuSubtitle}>
                    {savingsPots.length
                      ? `${formatAmount(savingsPots.reduce((sum, pot) => sum + pot.currentAmount, 0)).replace("+", "")} saved across your pots`
                      : "Save toward personal goals at your own pace"}
                  </Text>
                </View>
                <Ionicons color={COLORS.textMuted} name="chevron-forward" size={19} />
              </KasaCard>
            </Pressable>

            {!!debts.length && (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  guardKyc("repay an overdue group contribution", () =>
                    router.push("/wallet/debts")
                  )
                }
                style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
              >
                <KasaCard style={styles.debtCard}>
                  <View style={styles.debtIcon}>
                    <Ionicons color={COLORS.error} name="alert-circle" size={22} />
                  </View>
                  <View style={styles.susuCopy}>
                    <Text style={styles.debtTitle}>Outstanding group debt</Text>
                    <Text style={styles.debtSubtitle}>
                      {formatAmount(-debts.reduce((sum, debt) => sum + debt.amountDue, 0)).replace("-", "")} due across {debts.length} {debts.length === 1 ? "group" : "groups"}
                    </Text>
                  </View>
                  <Ionicons color={COLORS.error} name="chevron-forward" size={19} />
                </KasaCard>
              </Pressable>
            )}

            <View style={styles.historyHeadingRow}>
              <KasaSectionHeader description="Money moving in and out of your wallet" title="Activity" />
            </View>
          </View>
        }
        renderItem={({ item }) => <TransactionRow tx={item} />}
        renderSectionHeader={({ section }) => <Text style={styles.transactionSection}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  cardPressable: { marginHorizontal: 20 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  susuCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 18,
    padding: 16,
  },
  susuIcon: {
    alignItems: "center",
    backgroundColor: COLORS.successSurface,
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    marginRight: 12,
    width: 48,
  },
  susuCopy: { flex: 1 },
  susuTitleRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  susuTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  susuSubtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  debtCard: {
    alignItems: "center",
    backgroundColor: COLORS.errorSurface,
    borderColor: "#F1C8C3",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 12,
    padding: 16,
  },
  debtIcon: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    marginRight: 12,
    width: 48,
  },
  debtTitle: { color: COLORS.error, fontSize: 15, fontWeight: "800" },
  debtSubtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  listContent: {
    paddingBottom: 24,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPressed: { backgroundColor: kasaColors.surfaceMuted, transform: [{ scale: 0.97 }] },

  // Balance card
  balanceCard: {
    marginHorizontal: 20,
    borderRadius: 26,
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    minHeight: 258,
    overflow: "hidden",
    padding: 22,
    marginBottom: 0,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 9,
  },
  cardRingLarge: {
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 34,
    borderColor: "rgba(255,255,255,0.055)",
    position: "absolute",
    right: -72,
    top: -92,
  },
  cardRingSmall: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 19,
    borderColor: "rgba(232,184,75,0.11)",
    position: "absolute",
    left: -31,
    bottom: -46,
  },
  cardGlow: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(232,184,75,0.07)",
    position: "absolute",
    right: 35,
    bottom: 38,
  },
  balanceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
    zIndex: 1,
  },
  balanceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  walletMark: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "600",
  },
  eyeButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardControlPressed: { backgroundColor: "rgba(255,255,255,0.18)", transform: [{ scale: 0.98 }] },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 9,
    zIndex: 1,
  },
  currencyLabel: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -1.1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 26,
    paddingTop: 17,
    borderTopColor: "rgba(255,255,255,0.12)",
    borderTopWidth: 1,
    zIndex: 1,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 70,
    paddingHorizontal: 5,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // History heading
  historyHeadingRow: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 4,
  },
  transactionSection: { backgroundColor: COLORS.background, color: COLORS.textMuted, fontSize: 12, fontWeight: "800", paddingBottom: 6, paddingHorizontal: 20, paddingTop: 16 },

  // Transaction row
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  txIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  txSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  txDate: {
    fontSize: 11,
    color: COLORS.placeholder,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 74,
  },

  // Empty state
  emptyState: {
    minHeight: 210,
  },
});
