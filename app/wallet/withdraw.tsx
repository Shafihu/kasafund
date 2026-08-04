import {
  AnimatedLoader,
  KasaButton,
  KasaCard,
  KasaChoiceCard,
  KasaMoneyInput,
  KasaPaymentSummary,
  KasaSectionHeader,
} from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { apiService, type PayoutProvider } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatMoney(pesewas: number) {
  return `GH₵ ${(pesewas / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseAmount(value: string) {
  if (!/^\d+(\.\d{0,2})?$/.test(value.trim())) return null;
  const pesewas = Math.round(Number(value) * 100);
  return Number.isSafeInteger(pesewas) ? pesewas : null;
}

export default function WithdrawScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const balance = user?.walletBalance ?? 0;
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(user?.phoneNumber ?? "");
  const [providers, setProviders] = useState<PayoutProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<PayoutProvider | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerError, setProviderError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpReference, setOtpReference] = useState("");

  const amountInPesewas = parseAmount(amount);
  const cleanedPhone = phone.replace(/[\s-]/g, "");
  const validPhone = /^(?:\+233|233|0)\d{9}$/.test(cleanedPhone);
  const amountError = amount.length > 0
    ? !amountInPesewas || amountInPesewas < 100
      ? "Enter at least GH₵ 1.00."
      : amountInPesewas > balance
        ? `Your available balance is ${formatMoney(balance)}.`
        : undefined
    : undefined;
  const phoneError = phone.length > 0 && !validPhone
    ? "Enter a valid Ghana mobile money number."
    : undefined;
  const canWithdraw = Boolean(
    amountInPesewas &&
      amountInPesewas >= 100 &&
      amountInPesewas <= balance &&
      validPhone &&
      selectedProvider
  );
  const otpValid = /^\d{4,8}$/.test(otp);

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true);
    setProviderError("");
    try {
      const response = await apiService.getPayoutProviders();
      setProviders(response.data);
      setSelectedProvider((current) => current ?? response.data[0] ?? null);
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "Could not load providers");
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const withdraw = async () => {
    if (!canWithdraw || !amountInPesewas || !selectedProvider) return;
    setSubmitting(true);
    try {
      const response = await apiService.createWalletWithdrawal({
        amount: amountInPesewas,
        accountNumber: phone,
        providerCode: selectedProvider.code,
        providerName: selectedProvider.name,
      });
      await checkAuthStatus();
      if (response.data.requiresOtp) {
        setOtpReference(response.data.transaction.reference);
        return;
      }
      Alert.alert(
        response.data.mocked ? "Demo withdrawal complete" : "Withdrawal submitted",
        response.data.mocked
          ? "The wallet flow was simulated successfully. No real money was sent."
          : "Your transfer is processing. We’ll update the transaction when Paystack confirms it.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert(
        "Withdrawal failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmWithdrawal = () => {
    if (!amountInPesewas || !selectedProvider) return;
    Alert.alert(
      "Confirm withdrawal",
      `Send ${formatMoney(amountInPesewas)} to ${selectedProvider.name} ${phone}? Confirm the number is correct before continuing.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm transfer", onPress: () => void withdraw() },
      ]
    );
  };

  const confirmOtp = async () => {
    if (!otpValid) return;
    setSubmitting(true);
    try {
      await apiService.finalizeWalletWithdrawal(otpReference, otp);
      await checkAuthStatus();
      Alert.alert("Withdrawal submitted", "Your transfer is now being processed.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("OTP not accepted", error instanceof Error ? error.message : "Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const choosePercentage = (percentage: number) => {
    setAmount(((balance * percentage) / 10000).toFixed(2));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
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
          <Text style={styles.headerTitle}>Withdraw</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available balance</Text>
            <Text accessibilityLabel={`Available balance ${formatMoney(balance)}`} style={styles.balanceValue}>
              {formatMoney(balance)}
            </Text>
            <View style={styles.balanceMeta}>
              <Ionicons color={kasaColors.accent} name="wallet-outline" size={15} />
              <Text style={styles.balanceMetaText}>KasaFund wallet</Text>
            </View>
            <View style={styles.ringLarge} />
            <View style={styles.ringSmall} />
          </View>

          {otpReference ? (
            <>
              <KasaCard style={styles.otpCard}>
                <View style={styles.otpIcon}>
                  <Ionicons color={kasaColors.brand} name="lock-closed" size={22} />
                </View>
                <Text style={styles.otpTitle}>Confirm transfer</Text>
                <Text style={styles.otpText}>
                  Enter the Paystack transfer OTP sent to your business contact.
                </Text>
                <TextInput
                  accessibilityLabel="Transfer one-time password"
                  keyboardType="number-pad"
                  maxLength={8}
                  onChangeText={setOtp}
                  placeholder="Enter OTP"
                  placeholderTextColor="#9AA8A3"
                  secureTextEntry
                  selectionColor={kasaColors.brand}
                  style={styles.otpInput}
                  value={otp}
                />
                {otp.length > 0 && !otpValid ? (
                  <Text style={styles.validationText}>Enter the 4–8 digit OTP.</Text>
                ) : null}
              </KasaCard>
              <KasaPaymentSummary
                items={[
                  { label: "Destination", value: selectedProvider?.name || "Mobile money" },
                  { label: "Number", value: phone },
                ]}
                style={styles.summaryCard}
                total={formatMoney(amountInPesewas ?? 0)}
                totalLabel="Withdrawal"
              />
            </>
          ) : (
            <>
              <KasaSectionHeader
                description="Choose how much of your available wallet balance to send."
                title="Withdrawal amount"
              />
              <View style={styles.presets}>
                {[25, 50, 100].map((percentage) => (
                  <Pressable
                    accessibilityLabel={percentage === 100 ? "Withdraw maximum" : `Withdraw ${percentage} percent`}
                    accessibilityRole="button"
                    key={percentage}
                    onPress={() => choosePercentage(percentage)}
                    style={({ pressed }) => [styles.preset, pressed && styles.pressed]}
                  >
                    <Text style={styles.presetText}>{percentage === 100 ? "Maximum" : `${percentage}%`}</Text>
                  </Pressable>
                ))}
              </View>
              <KasaMoneyInput
                containerStyle={styles.amountInput}
                error={amountError}
                label="Amount"
                maxLength={10}
                onChangeText={setAmount}
                value={amount}
              />

              <View style={styles.destinationHeader}>
                <KasaSectionHeader
                  description="Select the network registered to the receiving number."
                  title="Mobile money provider"
                />
              </View>
              {loadingProviders ? (
                <KasaCard style={styles.providerState}>
                  <AnimatedLoader size="compact" />
                </KasaCard>
              ) : providerError ? (
                <KasaCard style={styles.errorCard} variant="soft">
                  <Ionicons color={kasaColors.danger} name="alert-circle-outline" size={20} />
                  <View style={styles.errorCopy}>
                    <Text style={styles.errorTitle}>Providers unavailable</Text>
                    <Text style={styles.errorText}>{providerError}</Text>
                  </View>
                  <KasaButton
                    fullWidth={false}
                    label="Retry"
                    onPress={() => void loadProviders()}
                    size="compact"
                    variant="secondary"
                  />
                </KasaCard>
              ) : (
                <View accessibilityRole="radiogroup" style={styles.providers}>
                  {providers.map((provider) => {
                    const selected = selectedProvider?.code === provider.code;
                    return (
                      <KasaChoiceCard
                        accessibilityLabel={provider.name}
                        key={provider.code}
                        onPress={() => setSelectedProvider(provider)}
                        selected={selected}
                        style={styles.provider}
                      >
                        <View style={styles.providerCopy}>
                          <Text style={styles.providerText}>{provider.name}</Text>
                          <Text style={styles.providerHint}>Mobile money payout</Text>
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
              )}

              <Text style={styles.fieldLabel}>Mobile money number</Text>
              <View style={[styles.phoneBox, phoneError && styles.phoneBoxError]}>
                <Ionicons color={kasaColors.textMuted} name="phone-portrait-outline" size={19} />
                <TextInput
                  accessibilityLabel="Receiving mobile money number"
                  keyboardType="phone-pad"
                  maxLength={16}
                  onChangeText={setPhone}
                  placeholder="e.g. 024 123 4567"
                  placeholderTextColor="#9AA8A3"
                  selectionColor={kasaColors.brand}
                  style={styles.phoneInput}
                  value={phone}
                />
              </View>
              {phoneError ? <Text style={styles.validationText}>{phoneError}</Text> : null}

              <KasaPaymentSummary
                items={[
                  { label: "You withdraw", value: formatMoney(amountInPesewas ?? 0) },
                  { label: "Transfer fee", value: "GH₵ 0.00" },
                  { label: "Remaining balance", value: formatMoney(amountInPesewas && amountInPesewas <= balance ? balance - amountInPesewas : balance) },
                ]}
                style={styles.summaryCard}
                total={formatMoney(amountInPesewas ?? 0)}
                totalLabel="Recipient gets"
              />

              <KasaCard style={styles.notice} variant="soft">
                <Ionicons color={kasaColors.brand} name="information-circle-outline" size={19} />
                <Text style={styles.noticeText}>
                  Confirm the provider and number carefully. Mobile money transfers may not be reversible after submission.
                </Text>
              </KasaCard>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <KasaButton
            disabled={otpReference ? !otpValid : !canWithdraw}
            label={otpReference ? "Confirm withdrawal" : `Withdraw · ${formatMoney(amountInPesewas ?? 0)}`}
            leftIcon={<Ionicons color={kasaColors.white} name={otpReference ? "lock-closed" : "arrow-up"} size={16} />}
            loading={submitting}
            onPress={otpReference ? confirmOtp : confirmWithdrawal}
          />
          <Text style={styles.footerNote}>
            {otpReference ? "Your transfer starts only after the OTP is accepted." : "Review the destination before confirming."}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: kasaColors.background, flex: 1 },
  header: { alignItems: "center", borderBottomColor: kasaColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", height: 58, justifyContent: "space-between", paddingHorizontal: 16 },
  headerButton: { alignItems: "center", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  headerTitle: { color: kasaColors.text, fontSize: 17, fontWeight: "700" },
  pressed: { opacity: 0.58, transform: [{ scale: 0.96 }] },
  content: { padding: 20, paddingBottom: 32 },
  balanceCard: { backgroundColor: kasaColors.brand, borderRadius: 20, marginBottom: 28, overflow: "hidden", padding: 20 },
  balanceLabel: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "600", zIndex: 2 },
  balanceValue: { color: kasaColors.white, fontSize: 28, fontWeight: "800", letterSpacing: -0.7, marginTop: 6, zIndex: 2 },
  balanceMeta: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 18, zIndex: 2 },
  balanceMetaText: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700" },
  ringLarge: { borderColor: "rgba(255,255,255,0.08)", borderRadius: 90, borderWidth: 25, height: 160, position: "absolute", right: -46, top: -60, width: 160 },
  ringSmall: { backgroundColor: "rgba(232,184,75,0.13)", borderRadius: 40, bottom: -32, height: 80, position: "absolute", right: 64, width: 80 },
  presets: { flexDirection: "row", gap: 8, marginTop: 12 },
  preset: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 44 },
  presetText: { color: kasaColors.brand, fontSize: 11, fontWeight: "800" },
  amountInput: { marginTop: 14 },
  destinationHeader: { marginTop: 28 },
  providerState: { alignItems: "center", justifyContent: "center", marginTop: 12, minHeight: 80 },
  providers: { gap: 8, marginTop: 12 },
  provider: { alignItems: "center", flexDirection: "row", minHeight: 62, padding: 13 },
  providerCopy: { flex: 1 },
  providerText: { color: kasaColors.text, fontSize: 13, fontWeight: "700" },
  providerHint: { color: kasaColors.textMuted, fontSize: 10, marginTop: 3 },
  errorCard: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 12 },
  errorCopy: { flex: 1 },
  errorTitle: { color: kasaColors.danger, fontSize: 12, fontWeight: "700" },
  errorText: { color: kasaColors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  fieldLabel: { color: kasaColors.text, fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 24 },
  phoneBox: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 56, paddingHorizontal: 14 },
  phoneBoxError: { borderColor: kasaColors.danger },
  phoneInput: { color: kasaColors.text, flex: 1, fontSize: 15, paddingVertical: 14 },
  validationText: { color: kasaColors.danger, fontSize: 11, marginTop: 6 },
  summaryCard: { marginTop: 22 },
  notice: { alignItems: "flex-start", flexDirection: "row", gap: 10, marginTop: 16 },
  noticeText: { color: kasaColors.textMuted, flex: 1, fontSize: 11, lineHeight: 17 },
  otpCard: { alignItems: "center" },
  otpIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 16, height: 52, justifyContent: "center", width: 52 },
  otpTitle: { color: kasaColors.text, fontSize: 19, fontWeight: "800", marginTop: 15 },
  otpText: { color: kasaColors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  otpInput: { backgroundColor: kasaColors.surfaceMuted, borderColor: kasaColors.border, borderRadius: 14, borderWidth: 1, color: kasaColors.text, fontSize: 20, fontWeight: "700", letterSpacing: 5, marginTop: 20, padding: 15, textAlign: "center", width: "100%" },
  footer: { backgroundColor: kasaColors.background, borderTopColor: kasaColors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 8, paddingHorizontal: 20, paddingTop: 12 },
  footerNote: { color: kasaColors.textMuted, fontSize: 10, marginTop: 7, textAlign: "center" },
});
