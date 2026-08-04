import {
  KasaButton,
  KasaCard,
  KasaChoiceCard,
  KasaMoneyInput,
  KasaPaymentSummary,
  KasaSectionHeader,
  KasaStatusBadge,
} from "@/components/ui";
import { GamifiedTransactionSuccess } from "@/components/payments/GamifiedTransactionSuccess";
import { kasaColors } from "@/constants/design";
import { apiService } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { markCampaignForRefresh } from "@/utils/campaign-refresh";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PaymentMethod = "mobile_money" | "wallet" | "card";

const PRESETS = [50, 100, 250, 500];
const METHODS: {
  key: PaymentMethod;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: "mobile_money",
    label: "Mobile Money",
    description: "Approve securely on your phone",
    icon: "phone-portrait-outline",
  },
  {
    key: "wallet",
    label: "KasaFund Wallet",
    description: "Use your available wallet balance",
    icon: "wallet-outline",
  },
  {
    key: "card",
    label: "Debit or credit card",
    description: "Continue to secure card checkout",
    icon: "card-outline",
  },
];

function formatMoney(amount: number) {
  return `GH₵ ${Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : "0.00"}`;
}

export default function DonateCampaignScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const anonymousByDefault = useAuthStore(
    (state) => state.user?.preferences?.anonymousDonationsByDefault ?? false
  );
  const { id, campaignTitle, allowAnonymous } = useLocalSearchParams<{
    id: string;
    campaignTitle?: string;
    allowAnonymous?: string;
  }>();
  const [amount, setAmount] = useState("100");
  const [message, setMessage] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("mobile_money");
  const [anonymous, setAnonymous] = useState(
    allowAnonymous === "true" && anonymousByDefault
  );
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const amountValue = Number(amount);
  const amountInPesewas = Math.round(amountValue * 100);
  const displayAmount = formatMoney(amountValue);
  const walletBalance = user?.walletBalance ?? 0;
  const walletShortfall = Math.max(amountInPesewas - walletBalance, 0);
  const amountError = amount.length > 0 && (!Number.isFinite(amountValue) || amountValue < 1)
    ? "Enter at least GH₵ 1.00."
    : undefined;
  const canSubmit =
    Number.isFinite(amountValue) &&
    amountValue >= 1 &&
    !submitting &&
    (method !== "wallet" || walletShortfall === 0);

  const finishDonation = () => {
    if (id) markCampaignForRefresh(id);
    router.back();
  };

  const submit = async () => {
    if (!id || !canSubmit) return;
    try {
      setSubmitting(true);
      const callbackUrl = Linking.createURL(`fundraising/${id}/donate`);
      const response = await apiService.startDonation(id, {
        amount: amountInPesewas,
        isAnonymous: anonymous,
        message: message.trim(),
        paymentMethod: method,
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
      const verification = await apiService.verifyDonation(id, response.data.reference);
      if (verification.data.status === "completed") {
        setShowSuccess(true);
      } else {
        Alert.alert(
          checkout.type === "cancel" || checkout.type === "dismiss"
            ? "Payment not confirmed"
            : "Payment processing",
          "If you approved the payment, the campaign will update automatically after Paystack confirms it.",
          [
            { text: "Stay", style: "cancel" },
            { text: "Return to campaign", onPress: finishDonation },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        "Could not complete donation",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDonation = () => {
    const methodLabel = METHODS.find((item) => item.key === method)?.label;
    Alert.alert(
      "Confirm donation",
      `Donate ${displayAmount} to ${campaignTitle || "this campaign"} using ${methodLabel}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm payment", onPress: () => void submit() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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
            <Ionicons color={kasaColors.text} name="arrow-back" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Make a donation</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <KasaCard style={styles.campaignCard}>
            <View style={styles.campaignIcon}>
              <Ionicons color={kasaColors.white} name="heart" size={20} />
            </View>
            <View style={styles.campaignCopy}>
              <Text style={styles.overline}>Supporting</Text>
              <Text numberOfLines={2} style={styles.campaignTitle}>
                {campaignTitle || "Campaign"}
              </Text>
            </View>
            <KasaStatusBadge compact label="Donation" tone="info" />
          </KasaCard>

          <KasaSectionHeader
            description="Choose a preset or enter any amount from GH₵ 1.00."
            title="Donation amount"
          />
          <View accessibilityRole="radiogroup" style={styles.presets}>
            {PRESETS.map((preset) => {
              const selected = amountValue === preset;
              return (
                <Pressable
                  accessibilityLabel={`Donate ${preset} Ghana cedis`}
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
            containerStyle={styles.amountInput}
            error={amountError}
            label="Custom amount"
            onChangeText={setAmount}
            value={amount}
          />

          <KasaSectionHeader
            description="Choose how you want to fund this donation."
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
                  style={styles.methodRow}
                >
                  <View style={[styles.methodIcon, selected && styles.methodIconActive]}>
                    <Ionicons
                      color={selected ? kasaColors.white : kasaColors.brand}
                      name={item.icon}
                      size={20}
                    />
                  </View>
                  <View style={styles.methodCopy}>
                    <Text style={styles.methodLabel}>{item.label}</Text>
                    <Text style={styles.methodDescription}>{item.description}</Text>
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
                <View>
                  <Text style={styles.walletLabel}>Available balance</Text>
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
          ) : null}

          <View style={styles.optionalSection}>
            <KasaSectionHeader
              description="This appears with your donation when the organizer allows it."
              title="Message of support"
            />
            <TextInput
              accessibilityLabel="Optional message of support"
              maxLength={500}
              multiline
              onChangeText={setMessage}
              placeholder="Write something encouraging (optional)"
              placeholderTextColor="#9AA8A3"
              selectionColor={kasaColors.brand}
              style={styles.messageInput}
              textAlignVertical="top"
              value={message}
            />
            <Text style={styles.characterCount}>{message.length}/500</Text>
          </View>

          {allowAnonymous === "true" ? (
            <KasaCard style={styles.anonymousRow}>
              <View style={styles.anonymousIcon}>
                <Ionicons color={kasaColors.brand} name="eye-off-outline" size={20} />
              </View>
              <View style={styles.anonymousCopy}>
                <Text style={styles.anonymousTitle}>Donate anonymously</Text>
                <Text style={styles.anonymousText}>Your name will not appear publicly.</Text>
              </View>
              <Switch
                accessibilityLabel="Donate anonymously"
                onValueChange={setAnonymous}
                trackColor={{ false: kasaColors.border, true: kasaColors.brand }}
                value={anonymous}
              />
            </KasaCard>
          ) : null}

          <KasaPaymentSummary
            items={[
              { label: "Donation", value: displayAmount },
              { label: "Processing fee", value: "GH₵ 0.00" },
              { label: "Public name", value: anonymous ? "Anonymous" : "Your profile name" },
            ]}
            style={styles.summaryCard}
            total={displayAmount}
          />
        </ScrollView>

        <View style={styles.footer}>
          <KasaButton
            disabled={!canSubmit}
            label={`Continue · ${displayAmount}`}
            leftIcon={<Ionicons color={kasaColors.white} name="lock-closed" size={16} />}
            loading={submitting}
            onPress={confirmDonation}
          />
          {method === "wallet" && walletShortfall > 0 ? (
            <Text style={styles.footerWarning}>Your wallet needs more funds for this donation.</Text>
          ) : null}
          <Text style={styles.secureText}>
            Secure payment · Your donation is recorded after confirmation
          </Text>
        </View>
      </KeyboardAvoidingView>
      <GamifiedTransactionSuccess
        amountLabel={displayAmount}
        contextIcon="heart"
        doneLabel="Back to campaign"
        eyebrow="DONATION COMPLETE"
        message={`Your support for ${campaignTitle || "this campaign"} has been received.`}
        onDone={finishDonation}
        rewardText="You helped move a story forward"
        title="You made an impact!"
        visible={showSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: kasaColors.background, flex: 1 },
  header: {
    alignItems: "center",
    borderBottomColor: kasaColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    height: 58,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerButton: {
    alignItems: "center",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerTitle: { color: kasaColors.text, fontSize: 17, fontWeight: "700" },
  pressed: { opacity: 0.58, transform: [{ scale: 0.96 }] },
  content: { padding: 20, paddingBottom: 30 },
  campaignCard: { alignItems: "center", flexDirection: "row", marginBottom: 28 },
  campaignIcon: {
    alignItems: "center",
    backgroundColor: kasaColors.brand,
    borderRadius: 13,
    height: 44,
    justifyContent: "center",
    marginRight: 12,
    width: 44,
  },
  campaignCopy: { flex: 1, paddingRight: 8 },
  overline: { color: kasaColors.brand, fontSize: 10, fontWeight: "800" },
  campaignTitle: { color: kasaColors.text, fontSize: 14, fontWeight: "700", marginTop: 3 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  preset: {
    alignItems: "center",
    backgroundColor: kasaColors.surface,
    borderColor: kasaColors.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 15,
  },
  presetActive: { backgroundColor: kasaColors.brandSoft, borderColor: kasaColors.brand },
  presetText: { color: kasaColors.textMuted, fontSize: 12, fontWeight: "700" },
  presetTextActive: { color: kasaColors.brand },
  amountInput: { marginBottom: 28, marginTop: 14 },
  methodList: { gap: 9, marginTop: 12 },
  methodRow: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 72, padding: 13 },
  methodIcon: {
    alignItems: "center",
    backgroundColor: kasaColors.surfaceMuted,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  methodIconActive: { backgroundColor: kasaColors.brand },
  methodCopy: { flex: 1 },
  methodLabel: { color: kasaColors.text, fontSize: 14, fontWeight: "700" },
  methodDescription: { color: kasaColors.textMuted, fontSize: 11, marginTop: 3 },
  walletCard: { marginTop: 16 },
  walletRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  walletLabel: { color: kasaColors.textMuted, fontSize: 11 },
  walletBalance: { color: kasaColors.brand, fontSize: 18, fontWeight: "800", marginTop: 3 },
  shortfallText: { color: kasaColors.danger, fontSize: 11, lineHeight: 16, marginTop: 12 },
  optionalSection: { marginTop: 28 },
  messageInput: {
    backgroundColor: kasaColors.surface,
    borderColor: kasaColors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: kasaColors.text,
    fontSize: 13,
    height: 96,
    marginTop: 12,
    padding: 14,
  },
  characterCount: { color: kasaColors.textMuted, fontSize: 10, marginTop: 6, textAlign: "right" },
  anonymousRow: { alignItems: "center", flexDirection: "row", marginTop: 18 },
  anonymousIcon: {
    alignItems: "center",
    backgroundColor: kasaColors.brandSoft,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    marginRight: 12,
    width: 42,
  },
  anonymousCopy: { flex: 1, paddingRight: 8 },
  anonymousTitle: { color: kasaColors.text, fontSize: 13, fontWeight: "700" },
  anonymousText: { color: kasaColors.textMuted, fontSize: 11, marginTop: 3 },
  summaryCard: { marginTop: 22 },
  footer: {
    backgroundColor: kasaColors.background,
    borderTopColor: kasaColors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  footerWarning: { color: kasaColors.danger, fontSize: 10, marginTop: 7, textAlign: "center" },
  secureText: { color: kasaColors.textMuted, fontSize: 10, marginTop: 7, textAlign: "center" },
});
