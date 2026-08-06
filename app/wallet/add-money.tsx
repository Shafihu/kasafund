import {
  KasaButton,
  KasaCard,
  KasaMoneyInput,
  KasaPaymentSummary,
  KasaSectionHeader,
  KasaStatusBadge,
} from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { apiService } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PRESETS = [50, 100, 200, 500];

function parseAmount(value: string) {
  if (!/^\d+(\.\d{0,2})?$/.test(value.trim())) return null;
  const pesewas = Math.round(Number(value) * 100);
  return Number.isSafeInteger(pesewas) ? pesewas : null;
}

function money(pesewas: number | null) {
  return `GH₵ ${((pesewas ?? 0) / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AddMoneyScreen() {
  const router = useRouter();
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const amountInPesewas = parseAmount(amount);
  const amountError = amount.length > 0 && (!amountInPesewas || amountInPesewas < 100)
    ? "Enter at least GH₵ 1.00."
    : undefined;
  const canContinue = Boolean(amountInPesewas && amountInPesewas >= 100);

  const startPayment = async () => {
    if (!amountInPesewas || amountInPesewas < 100) return;

    setLoading(true);
    try {
      const callbackUrl = Linking.createURL("wallet/add-money");
      const response = await apiService.initializeWalletDeposit(amountInPesewas, callbackUrl);
      const payment = await WebBrowser.openAuthSessionAsync(
        response.data.authorizationUrl,
        callbackUrl
      );

      const verification = await apiService.verifyWalletDeposit(response.data.reference);
      if (verification.data.status === "completed") {
        await checkAuthStatus();
        Alert.alert("Money added", `${money(amountInPesewas)} is now available in your wallet.`, [
          { text: "Done", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(
          payment.type === "cancel" || payment.type === "dismiss"
            ? "Payment not confirmed"
            : "Payment processing",
          payment.type === "cancel" || payment.type === "dismiss"
            ? "The checkout closed before Paystack confirmed payment. If you approved it, your wallet will update automatically."
            : "Paystack is still confirming this payment. Your wallet will update automatically once confirmed."
        );
      }
    } catch (error) {
      Alert.alert(
        "Unable to add money",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.headerTitle}>Add money</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <KasaCard style={styles.contextCard}>
            <View style={styles.contextIcon}>
              <Ionicons color={kasaColors.brand} name="wallet-outline" size={21} />
            </View>
            <View style={styles.contextCopy}>
              <Text style={styles.contextTitle}>KasaFund wallet</Text>
              <Text style={styles.contextText}>Money becomes available after confirmation.</Text>
            </View>
            <KasaStatusBadge compact label="GH₵ wallet" tone="info" />
          </KasaCard>

          <KasaSectionHeader
            description="Choose a preset or enter any amount from GH₵ 1.00."
            title="Amount to add"
          />
          <View accessibilityRole="radiogroup" style={styles.presets}>
            {PRESETS.map((preset) => {
              const selected = amount === String(preset);
              return (
                <Pressable
                  accessibilityLabel={`Add ${preset} Ghana cedis`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={preset}
                  onPress={() => setAmount(String(preset))}
                  style={({ pressed }) => [
                    styles.preset,
                    selected && styles.presetActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.presetText, selected && styles.presetTextActive]}>
                    GH₵ {preset}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <KasaMoneyInput
            autoFocus
            containerStyle={styles.amountInput}
            error={amountError}
            label="Custom amount"
            maxLength={10}
            onChangeText={setAmount}
            value={amount}
          />

          <KasaPaymentSummary
            items={[
              { label: "Wallet deposit", value: money(amountInPesewas) },
              { label: "Processing fee", value: "Shown by Paystack" },
            ]}
            style={styles.summaryCard}
            total={money(amountInPesewas)}
          />

          <KasaCard style={styles.securityCard} variant="soft">
            <View style={styles.securityIcon}>
              <Ionicons color={kasaColors.brand} name="shield-checkmark" size={19} />
            </View>
            <View style={styles.contextCopy}>
              <Text style={styles.securityTitle}>Secure Paystack checkout</Text>
              <Text style={styles.securityText}>
                Pay with mobile money or card. KasaFund never stores your payment PIN or card details.
              </Text>
            </View>
          </KasaCard>
        </ScrollView>

        <View style={styles.footer}>
          <KasaButton
            disabled={!canContinue}
            label={`Continue · ${money(amountInPesewas)}`}
            leftIcon={<Ionicons color={kasaColors.white} name="lock-closed" size={16} />}
            loading={loading}
            onPress={startPayment}
          />
          <Text style={styles.footerNote}>You’ll review the payment securely on Paystack.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: kasaColors.background, flex: 1 },
  header: {
    alignItems: "center",
    borderBottomColor: kasaColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    height: 58,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerButton: { alignItems: "center", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  headerSpacer: { height: 44, width: 44 },
  headerTitle: { color: kasaColors.text, fontSize: 17, fontWeight: "700" },
  pressed: { opacity: 0.58, transform: [{ scale: 0.96 }] },
  content: { padding: 20, paddingBottom: 32 },
  contextCard: { alignItems: "center", flexDirection: "row", marginBottom: 28 },
  contextIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 12, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  contextCopy: { flex: 1, paddingRight: 8 },
  contextTitle: { color: kasaColors.text, fontSize: 14, fontWeight: "700" },
  contextText: { color: kasaColors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  preset: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 14 },
  presetActive: { backgroundColor: kasaColors.brandSoft, borderColor: kasaColors.brand },
  presetText: { color: kasaColors.textMuted, fontSize: 12, fontWeight: "700" },
  presetTextActive: { color: kasaColors.brand },
  amountInput: { marginTop: 14 },
  summaryCard: { marginTop: 24 },
  securityCard: { alignItems: "flex-start", flexDirection: "row", marginTop: 16 },
  securityIcon: { alignItems: "center", backgroundColor: kasaColors.surface, borderRadius: 11, height: 40, justifyContent: "center", marginRight: 11, width: 40 },
  securityTitle: { color: kasaColors.text, fontSize: 13, fontWeight: "700" },
  securityText: { color: kasaColors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  footer: { backgroundColor: kasaColors.background, borderTopColor: kasaColors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 8, paddingHorizontal: 20, paddingTop: 12 },
  footerNote: { color: kasaColors.textMuted, fontSize: 10, marginTop: 7, textAlign: "center" },
});
