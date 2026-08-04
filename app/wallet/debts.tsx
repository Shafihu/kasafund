import {
  KasaButton,
  KasaCard,
  KasaChoiceCard,
  KasaPaymentSummary,
  KasaSectionHeader,
  KasaStateView,
  KasaStatusBadge,
} from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { apiService, type GroupDebt } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PaymentMethod = "mobile_money" | "wallet" | "card";

const METHODS: {
  key: PaymentMethod;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "mobile_money", label: "Mobile Money", description: "Approve securely on your phone", icon: "phone-portrait-outline" },
  { key: "wallet", label: "KasaFund Wallet", description: "Use your available wallet balance", icon: "wallet-outline" },
  { key: "card", label: "Debit or credit card", description: "Continue to secure card checkout", icon: "card-outline" },
];

function money(value: number) {
  return `GH₵ ${(value / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dueDate(value: string) {
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function recoveryRecipient(debt: GroupDebt) {
  return debt.creditors?.length > 1
    ? `${debt.creditors.length} remaining payout recipients`
    : debt.creditor.fullName;
}

export default function GroupDebtsScreen() {
  const router = useRouter();
  const walletBalance = useAuthStore((state) => state.user?.walletBalance ?? 0);
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const [debts, setDebts] = useState<GroupDebt[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [selectedDebt, setSelectedDebt] = useState<GroupDebt | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("mobile_money");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const walletShortfall = selectedDebt
    ? Math.max(selectedDebt.amountDue - walletBalance, 0)
    : 0;
  const canPay = Boolean(
    selectedDebt && !submitting && (method !== "wallet" || walletShortfall === 0)
  );

  const loadDebts = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setLoadError("");
    try {
      const response = await apiService.getGroupDebts();
      setDebts(response.data.debts);
      setTotalAmount(response.data.totalAmount);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDebts();
    }, [loadDebts])
  );

  const closeCheckout = () => {
    if (submitting) return;
    setSelectedDebt(null);
    setMethod("mobile_money");
  };

  const repay = async () => {
    if (!selectedDebt || submitting || !canPay) return;
    setSubmitting(true);
    try {
      const callbackUrl = Linking.createURL("wallet/debts");
      const response = await apiService.startDebtRepayment(selectedDebt._id, {
        paymentMethod: method,
        callbackUrl,
      });

      if (response.data.paymentType === "wallet") {
        await checkAuthStatus();
        setSelectedDebt(null);
        await loadDebts(true);
        Alert.alert(
          "Debt repaid",
          `${money(selectedDebt.amountDue)} was distributed to ${recoveryRecipient(selectedDebt)}. Your account is back in good standing.`
        );
        return;
      }

      if (!response.data.authorizationUrl) {
        throw new Error("Secure checkout is unavailable. Please try again.");
      }
      const checkout = await WebBrowser.openAuthSessionAsync(
        response.data.authorizationUrl,
        callbackUrl
      );
      const verification = await apiService.verifyDebtRepayment(
        selectedDebt._id,
        response.data.reference
      );
      if (verification.data.status === "paid") {
        await checkAuthStatus();
        setSelectedDebt(null);
        await loadDebts(true);
        Alert.alert(
          "Debt repaid",
          `${money(selectedDebt.amountDue)} was recovered for ${recoveryRecipient(selectedDebt)}.`
        );
      } else {
        Alert.alert(
          checkout.type === "cancel" || checkout.type === "dismiss"
            ? "Payment not confirmed"
            : "Payment processing",
          "If you approved the payment, the debt will clear automatically after Paystack confirms it."
        );
      }
    } catch (error) {
      Alert.alert(
        "Couldn’t repay debt",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons color={kasaColors.text} name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Group debt</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <KasaStateView kind="loading" style={styles.fullState} title="Loading group debt" />
      ) : loadError && !debts.length ? (
        <KasaStateView
          actionLabel="Try again"
          kind="error"
          message={loadError}
          onAction={() => void loadDebts()}
          style={styles.fullState}
          title="Couldn’t load group debt"
        />
      ) : (
        <FlatList
          contentContainerStyle={[styles.content, !debts.length && styles.emptyContent]}
          data={debts}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              onRefresh={() => void loadDebts(true)}
              refreshing={refreshing}
              tintColor={kasaColors.brand}
            />
          }
          ListHeaderComponent={debts.length ? (
            <>
              <KasaCard style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <View>
                    <Text style={styles.summaryLabel}>Total outstanding</Text>
                    <Text style={styles.summaryAmount}>{money(totalAmount)}</Text>
                  </View>
                  <KasaStatusBadge icon="alert-circle-outline" label="Action required" tone="danger" />
                </View>
                <Text style={styles.summaryText}>
                  Repayment clears your account restriction. Suspension from the original group remains permanent.
                </Text>
              </KasaCard>
              <KasaSectionHeader
                description={`${debts.length} recorded ${debts.length === 1 ? "balance" : "balances"} requiring settlement.`}
                title="Amounts to settle"
              />
            </>
          ) : null}
          ListEmptyComponent={
            <KasaStateView
              icon="shield-checkmark-outline"
              kind="empty"
              message="Your account has no recoverable contribution balances."
              style={styles.fullState}
              title="No outstanding group debt"
            />
          }
          renderItem={({ item }) => (
            <KasaCard style={styles.debtCard}>
              <View style={styles.debtTop}>
                <View style={styles.groupIcon}>
                  <Ionicons color={kasaColors.brand} name="people" size={19} />
                </View>
                <View style={styles.debtCopy}>
                  <Text numberOfLines={1} style={styles.groupName}>{item.group.name}</Text>
                  <Text style={styles.cycleLabel}>Missed cycle {item.cycleNumber}</Text>
                </View>
                <Text style={styles.debtAmount}>{money(item.amountDue)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Recovery goes to</Text>
                <Text style={styles.detailValue}>{recoveryRecipient(item)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Original due date</Text>
                <Text style={styles.detailValue}>{dueDate(item.dueDate)}</Text>
              </View>
              <KasaButton
                label="Repay this debt"
                onPress={() => setSelectedDebt(item)}
                rightIcon={<Ionicons color={kasaColors.white} name="arrow-forward" size={17} />}
                style={styles.repayButton}
              />
            </KasaCard>
          )}
        />
      )}

      <Modal
        animationType="slide"
        onRequestClose={closeCheckout}
        presentationStyle="pageSheet"
        visible={Boolean(selectedDebt)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={styles.modalCopy}>
              <Text style={styles.modalTitle}>Repay group debt</Text>
              <Text style={styles.modalSubtitle}>Review who receives the recovery before paying.</Text>
            </View>
            <Pressable
              accessibilityLabel="Close repayment"
              accessibilityRole="button"
              disabled={submitting}
              onPress={closeCheckout}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Ionicons color={kasaColors.text} name="close" size={21} />
            </Pressable>
          </View>

          {selectedDebt ? (
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.paymentHero}>
                <Text style={styles.paymentGroup}>{selectedDebt.group.name}</Text>
                <Text style={styles.paymentAmount}>{money(selectedDebt.amountDue)}</Text>
                <Text style={styles.paymentRecipient}>Recovery for {recoveryRecipient(selectedDebt)}</Text>
              </View>

              <KasaSectionHeader
                description="Choose how you want to settle this recorded balance."
                title="Payment method"
              />
              <View accessibilityRole="radiogroup" style={styles.methodList}>
                {METHODS.map((item) => {
                  const selected = item.key === method;
                  return (
                    <KasaChoiceCard
                      accessibilityLabel={`${item.label}. ${item.description}`}
                      key={item.key}
                      onPress={() => setMethod(item.key)}
                      selected={selected}
                      style={styles.methodCard}
                    >
                      <View style={[styles.methodIcon, selected && styles.methodIconSelected]}>
                        <Ionicons color={selected ? kasaColors.white : kasaColors.brand} name={item.icon} size={21} />
                      </View>
                      <View style={styles.methodCopy}>
                        <Text style={styles.methodLabel}>{item.label}</Text>
                        <Text style={styles.methodDescription}>
                          {item.key === "wallet" ? `${money(walletBalance)} available` : item.description}
                        </Text>
                      </View>
                      <Ionicons
                        color={selected ? kasaColors.brand : kasaColors.textMuted}
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={21}
                      />
                    </KasaChoiceCard>
                  );
                })}
              </View>

              {method === "wallet" ? (
                <KasaCard style={styles.walletCard} variant="soft">
                  <View style={styles.walletRow}>
                    <Text style={styles.walletLabel}>Wallet readiness</Text>
                    <KasaStatusBadge
                      compact
                      label={walletShortfall === 0 ? "Ready" : "Insufficient balance"}
                      tone={walletShortfall === 0 ? "success" : "danger"}
                    />
                  </View>
                  {walletShortfall > 0 ? (
                    <Text style={styles.shortfallText}>Add {money(walletShortfall)} more to use your wallet.</Text>
                  ) : null}
                </KasaCard>
              ) : null}

              <KasaPaymentSummary
                items={[
                  { label: "Recorded debt", value: money(selectedDebt.amountDue) },
                  { label: "Processing fee", value: "GH₵ 0.00" },
                  { label: "Recovery recipient", value: recoveryRecipient(selectedDebt) },
                ]}
                style={styles.paymentSummary}
                total={money(selectedDebt.amountDue)}
              />

              <KasaCard style={styles.protectionNote} variant="soft">
                <Ionicons color={kasaColors.brand} name="lock-closed-outline" size={17} />
                <Text style={styles.protectionText}>
                  This payment applies only to this recorded debt and cannot alter the current group payout cycle.
                </Text>
              </KasaCard>
            </ScrollView>
          ) : null}

          <View style={styles.modalFooter}>
            <KasaButton
              disabled={!canPay}
              label={`Pay · ${money(selectedDebt?.amountDue || 0)}`}
              leftIcon={<Ionicons color={kasaColors.white} name="lock-closed" size={16} />}
              loading={submitting}
              onPress={() => void repay()}
            />
            {method === "wallet" && walletShortfall > 0 ? (
              <Text style={styles.footerWarning}>Your wallet needs more funds for this repayment.</Text>
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: kasaColors.background, flex: 1 },
  header: { alignItems: "center", borderBottomColor: kasaColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", height: 58, justifyContent: "space-between", paddingHorizontal: 16 },
  headerButton: { alignItems: "center", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  headerTitle: { color: kasaColors.text, fontSize: 17, fontWeight: "800" },
  pressed: { opacity: 0.58, transform: [{ scale: 0.96 }] },
  fullState: { flex: 1 },
  content: { gap: 12, paddingBottom: 42, paddingHorizontal: 20 },
  emptyContent: { flexGrow: 1 },
  summaryCard: { backgroundColor: kasaColors.dangerSoft, borderColor: "#F1C8C3", marginBottom: 14, marginTop: 12 },
  summaryTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { color: kasaColors.danger, fontSize: 12, fontWeight: "700" },
  summaryAmount: { color: kasaColors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.8, marginTop: 5 },
  summaryText: { color: kasaColors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 16 },
  debtCard: { marginTop: 0 },
  debtTop: { alignItems: "center", flexDirection: "row" },
  groupIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 12, height: 42, justifyContent: "center", marginRight: 11, width: 42 },
  debtCopy: { flex: 1 },
  groupName: { color: kasaColors.text, fontSize: 14, fontWeight: "800" },
  cycleLabel: { color: kasaColors.textMuted, fontSize: 10, marginTop: 3 },
  debtAmount: { color: kasaColors.danger, fontSize: 15, fontWeight: "800" },
  divider: { backgroundColor: kasaColors.border, height: StyleSheet.hairlineWidth, marginVertical: 14 },
  detailRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  detailLabel: { color: kasaColors.textMuted, fontSize: 11 },
  detailValue: { color: kasaColors.text, flex: 1, fontSize: 11, fontWeight: "700", marginLeft: 16, textAlign: "right" },
  repayButton: { marginTop: 10 },
  modalSafe: { backgroundColor: kasaColors.background, flex: 1 },
  modalHeader: { alignItems: "center", borderBottomColor: kasaColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", paddingHorizontal: 20, paddingVertical: 12 },
  modalCopy: { flex: 1, paddingRight: 12 },
  modalTitle: { color: kasaColors.text, fontSize: 21, fontWeight: "800" },
  modalSubtitle: { color: kasaColors.textMuted, fontSize: 11, marginTop: 3 },
  closeButton: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 12, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  modalContent: { padding: 20, paddingBottom: 30 },
  paymentHero: { alignItems: "center", backgroundColor: kasaColors.brandStrong, borderRadius: 20, marginBottom: 26, overflow: "hidden", padding: 22 },
  paymentGroup: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "700" },
  paymentAmount: { color: kasaColors.white, fontSize: 30, fontWeight: "800", marginTop: 7 },
  paymentRecipient: { color: kasaColors.accent, fontSize: 11, fontWeight: "700", marginTop: 7, textAlign: "center" },
  methodList: { gap: 9, marginTop: 12 },
  methodCard: { alignItems: "center", flexDirection: "row", minHeight: 70, padding: 13 },
  methodIcon: { alignItems: "center", backgroundColor: kasaColors.surfaceMuted, borderRadius: 11, height: 42, justifyContent: "center", marginRight: 11, width: 42 },
  methodIconSelected: { backgroundColor: kasaColors.brand },
  methodCopy: { flex: 1 },
  methodLabel: { color: kasaColors.text, fontSize: 13, fontWeight: "700" },
  methodDescription: { color: kasaColors.textMuted, fontSize: 10, marginTop: 3 },
  walletCard: { marginTop: 14 },
  walletRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  walletLabel: { color: kasaColors.text, fontSize: 12, fontWeight: "700" },
  shortfallText: { color: kasaColors.danger, fontSize: 11, marginTop: 10 },
  paymentSummary: { marginTop: 18 },
  protectionNote: { alignItems: "flex-start", flexDirection: "row", gap: 9, marginTop: 14 },
  protectionText: { color: kasaColors.textMuted, flex: 1, fontSize: 10, lineHeight: 15 },
  modalFooter: { backgroundColor: kasaColors.background, borderTopColor: kasaColors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 8, paddingHorizontal: 20, paddingTop: 12 },
  footerWarning: { color: kasaColors.danger, fontSize: 10, marginTop: 7, textAlign: "center" },
});
