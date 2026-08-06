import {
  KasaButton,
  KasaCard,
  KasaChoiceCard,
  KasaPaymentSummary,
  KasaSectionHeader,
  KasaStatusBadge,
} from "@/components/ui";
import { GamifiedTransactionSuccess } from "@/components/payments/GamifiedTransactionSuccess";
import { kasaColors } from "@/constants/design";
import { apiService } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { markGroupForRefresh } from "@/utils/group-refresh";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: kasaColors.brand,
  primaryDark: kasaColors.brandStrong,
  background: kasaColors.background,
  surface: kasaColors.surface,
  border: kasaColors.border,
  text: kasaColors.text,
  textMuted: kasaColors.textMuted,
  placeholder: "#9AA8A3",
  successSurface: kasaColors.successSoft,
};

type PaymentMethod = "momo" | "wallet" | "card";

const PAYMENT_METHODS: {
  key: PaymentMethod;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: "momo",
    label: "Mobile Money",
    description: "Approve the payment on your phone",
    icon: "phone-portrait-outline",
  },
  {
    key: "wallet",
    label: "KasaFund Wallet",
    description: "Pay from your available balance",
    icon: "wallet-outline",
  },
  {
    key: "card",
    label: "Debit or credit card",
    description: "Continue to secure card checkout",
    icon: "card-outline",
  },
];

export default function ContributeGroupScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const params = useLocalSearchParams<{
    id: string;
    groupName?: string;
    contributionAmount?: string;
    frequency?: string;
  }>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("momo");
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const groupName = params.groupName || "Your group";
  const amount = params.contributionAmount || "GH₵ 0";
  const frequency = params.frequency || "Scheduled";
  const amountInPesewas = Math.round(
    Number(amount.replace(/[^\d.]/g, "")) * 100
  );
  const walletBalance = user?.walletBalance ?? 0;
  const walletShortfall = Math.max(amountInPesewas - walletBalance, 0);
  const canContinue =
    !submitting &&
    (paymentMethod !== "wallet" || walletBalance >= amountInPesewas);
  const selectedMethod = PAYMENT_METHODS.find(
    (method) => method.key === paymentMethod
  );

  const finishContribution = () => {
    if (params.id) markGroupForRefresh(params.id);
    router.back();
  };

  const submitContribution = async () => {
    if (!params.id) return;
    setSubmitting(true);
    try {
      const callbackUrl = Linking.createURL(`groups/${params.id}/contribute`);
      const response = await apiService.startGroupContribution(params.id, {
        paymentMethod:
          paymentMethod === "momo" ? "mobile_money" : paymentMethod,
        callbackUrl,
      });

      if (response.data.paymentType === "wallet") {
        await checkAuthStatus();
        setShowSuccess(true);
        return;
      }

      if (!response.data.authorizationUrl) {
        throw new Error("Secure checkout is unavailable. Please try again.");
      }
      const checkout = await WebBrowser.openAuthSessionAsync(
        response.data.authorizationUrl,
        callbackUrl
      );
      const verification = await apiService.verifyGroupContribution(
        params.id,
        response.data.reference
      );
      if (verification.data.status === "paid") {
        setShowSuccess(true);
      } else {
        Alert.alert(
          checkout.type === "cancel" || checkout.type === "dismiss"
            ? "Payment not confirmed"
            : "Payment processing",
          "If you approved the payment, the group will update automatically after Paystack confirms it."
        );
      }
    } catch (error) {
      Alert.alert(
        "Could not complete contribution",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmContribution = () => {
    Alert.alert(
      "Confirm contribution",
      `Pay ${amount} to ${groupName} using ${selectedMethod?.label}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm payment",
          onPress: () => void submitContribution(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Make a contribution</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <KasaCard style={styles.groupCard}>
            <View style={styles.groupIcon}>
              <Ionicons name="people" size={22} color={COLORS.background} />
            </View>
            <View style={styles.groupCopy}>
              <Text style={styles.groupName}>{groupName}</Text>
              <Text style={styles.groupMeta}>{frequency} contribution</Text>
            </View>
            <KasaStatusBadge compact label="Group payment" tone="info" />
          </KasaCard>

          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>Contribution due</Text>
            <Text style={styles.amount}>{amount}</Text>
            <View style={styles.secureRow}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />
              <Text style={styles.secureText}>Secure group payment</Text>
            </View>
          </View>

          <KasaSectionHeader
            description="Choose how you want to fund this contribution."
            title="Payment method"
          />
          <View style={styles.methodList}>
            {PAYMENT_METHODS.map((method) => {
              const selected = method.key === paymentMethod;
              return (
                <KasaChoiceCard
                  accessibilityLabel={`${method.label}. ${method.description}`}
                  key={method.key}
                  onPress={() => setPaymentMethod(method.key)}
                  selected={selected}
                  style={styles.methodCard}
                >
                  <View style={[styles.methodIcon, selected && styles.methodIconSelected]}>
                    <Ionicons
                      name={method.icon}
                      size={21}
                      color={selected ? COLORS.background : COLORS.primary}
                    />
                  </View>
                  <View style={styles.methodCopy}>
                    <Text style={styles.methodLabel}>{method.label}</Text>
                    <Text style={styles.methodDescription}>{method.description}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                </KasaChoiceCard>
              );
            })}
          </View>

          {paymentMethod === "momo" && (
            <KasaCard style={styles.infoCard} variant="soft">
              <Ionicons name="phone-portrait-outline" size={21} color={COLORS.primary} />
              <Text style={styles.cardInfoText}>
                Enter your mobile money details and approve securely on Paystack Checkout.
              </Text>
            </KasaCard>
          )}

          {paymentMethod === "wallet" && (
            <KasaCard style={styles.walletCard} variant="soft">
              <View style={styles.walletRow}>
                <View>
                  <Text style={styles.infoLabel}>Available balance</Text>
                  <Text style={styles.walletBalance}>
                    GH₵ {(walletBalance / 100).toLocaleString("en-GH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
                <KasaStatusBadge
                  compact
                  label={walletShortfall === 0 ? "Ready" : "Insufficient balance"}
                  tone={walletShortfall === 0 ? "success" : "danger"}
                />
              </View>
              {walletShortfall > 0 ? (
                <Text style={styles.shortfallText}>
                  Add GH₵ {(walletShortfall / 100).toLocaleString("en-GH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} more to use your wallet.
                </Text>
              ) : null}
            </KasaCard>
          )}

          {paymentMethod === "card" && (
            <KasaCard style={styles.infoCard} variant="soft">
              <Ionicons name="lock-closed-outline" size={21} color={COLORS.primary} />
              <Text style={styles.cardInfoText}>
                Card details are entered on the secure payment page after confirmation.
              </Text>
            </KasaCard>
          )}

          <KasaPaymentSummary
            items={[
              { label: "Contribution", value: amount },
              { label: "Processing fee", value: "GH₵ 0.00" },
            ]}
            style={styles.summaryCard}
            total={amount}
          />
        </ScrollView>

        <View style={styles.footer}>
          <KasaButton
            disabled={!canContinue}
            label={`Continue · ${amount}`}
            leftIcon={<Ionicons color={kasaColors.white} name="lock-closed" size={16} />}
            loading={submitting}
            onPress={confirmContribution}
          />
          {paymentMethod === "wallet" && walletShortfall > 0 ? (
            <Text style={styles.footerWarning}>Your wallet needs more funds for this payment.</Text>
          ) : null}
          <Text style={styles.footerNote}>Payments are encrypted and securely processed.</Text>
        </View>
      </KeyboardAvoidingView>
      <GamifiedTransactionSuccess
        amountLabel={amount}
        contextIcon="people"
        doneLabel="Back to group"
        eyebrow="CONTRIBUTION COMPLETE"
        message={`Your contribution to ${groupName} has been recorded.`}
        onDone={finishContribution}
        rewardText="Another promise kept"
        title="Group goal powered!"
        visible={showSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  headerSpacer: { height: 44, width: 44 },
  pressed: { opacity: 0.58, transform: [{ scale: 0.96 }] },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  content: { padding: 20, paddingBottom: 30 },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  groupCopy: { flex: 1 },
  groupName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  groupMeta: { marginTop: 3, fontSize: 12, color: COLORS.textMuted },
  amountBlock: { alignItems: "center", paddingVertical: 30 },
  amountLabel: { fontSize: 13, color: COLORS.textMuted },
  amount: {
    marginTop: 7,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: COLORS.text,
  },
  secureRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 9 },
  secureText: { fontSize: 11, color: COLORS.primary },
  methodList: { gap: 9, marginTop: 12 },
  methodCard: {
    minHeight: 72,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  methodIconSelected: { backgroundColor: COLORS.primary },
  methodCopy: { flex: 1 },
  methodLabel: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  methodDescription: { marginTop: 3, fontSize: 11, color: COLORS.textMuted },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.placeholder,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  paymentDetails: {
    marginTop: 18,
    padding: 16,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
  },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  networkRow: { flexDirection: "row", gap: 8, marginTop: 9 },
  networkChip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  networkChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.successSurface },
  networkText: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted },
  networkTextSelected: { color: COLORS.primary },
  phoneLabel: { marginTop: 18 },
  phoneInputWrapper: {
    height: 52,
    paddingHorizontal: 13,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  countryCode: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  inputDivider: { width: 1, height: 24, marginHorizontal: 11, backgroundColor: COLORS.border },
  phoneInput: { flex: 1, height: "100%", fontSize: 15, color: COLORS.text },
  fieldHint: { marginTop: 7, fontSize: 10, lineHeight: 15, color: COLORS.textMuted },
  infoCard: {
    marginTop: 18,
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletCard: { marginTop: 18 },
  walletRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { fontSize: 11, color: COLORS.textMuted },
  walletBalance: { marginTop: 3, fontSize: 18, fontWeight: "700", color: COLORS.primary },
  shortfallText: { color: kasaColors.danger, fontSize: 11, lineHeight: 16, marginTop: 12 },
  cardInfoText: { flex: 1, fontSize: 12, lineHeight: 18, color: COLORS.primaryDark },
  summaryCard: { marginTop: 22 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  footerWarning: { color: kasaColors.danger, fontSize: 10, marginTop: 7, textAlign: "center" },
  footerNote: { marginTop: 7, fontSize: 10, textAlign: "center", color: COLORS.textMuted },
});
