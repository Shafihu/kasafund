import {
  apiService,
  type AutoContributionSettings,
} from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  primary: "#0B4D3E",
  primaryDark: "#07372C",
  primarySoft: "#E4F1EC",
  accent: "#E8B84B",
  background: "#FFFFFF",
  surface: "#F6F8F7",
  border: "#E2E8E5",
  text: "#12211C",
  textMuted: "#697873",
  warning: "#A46716",
  warningSurface: "#FFF3DE",
};

type Props = {
  amount: number;
  groupId: string;
  groupName: string;
  initialSettings: AutoContributionSettings;
  onClose: () => void;
  onSaved: (settings: AutoContributionSettings) => void;
  visible: boolean;
};

function money(amount: number) {
  return `GH₵ ${(amount / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateLabel(value?: string | null) {
  if (!value) return "Waiting for the next payout schedule";
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function AutoContributionModal({
  amount,
  groupId,
  groupName,
  initialSettings,
  onClose,
  onSaved,
  visible,
}: Props) {
  const walletBalance = useAuthStore((state) => state.user?.walletBalance ?? 0);
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setEnabled(initialSettings.enabled);
  }, [initialSettings.enabled, visible]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiService.updateAutoContribution(groupId, enabled);
      onSaved(response.data);
      onClose();
      Alert.alert(
        enabled ? "Auto-contribution enabled" : "Auto-contribution turned off",
        enabled
          ? `${money(amount)} will be paid from your wallet when ${groupName}'s contribution is due.`
          : `Future contributions to ${groupName} will require manual payment.`
      );
    } catch (error) {
      Alert.alert(
        "Could not update auto-contribution",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const hasEnoughNow = walletBalance >= amount;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>GROUP PAYMENTS</Text>
            <Text style={styles.title}>Auto-contribute</Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Close auto-contribution settings"
            disabled={saving}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons color={COLORS.text} name="close" size={21} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons color={COLORS.primary} name="sync" size={25} />
            </View>
            <Text style={styles.heroTitle}>Never miss a contribution</Text>
            <Text style={styles.heroText}>
              KasaFund will securely move the contribution from your wallet only when it becomes due.
            </Text>
          </View>

          <View style={styles.switchCard}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>Automatic wallet payment</Text>
              <Text style={styles.switchSubtitle}>
                {enabled ? "Active for this group" : "Manual payments only"}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Automatic wallet contribution"
              ios_backgroundColor={COLORS.border}
              onValueChange={setEnabled}
              thumbColor={COLORS.background}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              value={enabled}
            />
          </View>

          <Text style={styles.sectionTitle}>Payment details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Group</Text>
              <Text numberOfLines={1} style={styles.detailValue}>{groupName}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailValue}>{money(amount)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Funding source</Text>
              <View style={styles.walletValue}>
                <Ionicons color={COLORS.primary} name="wallet-outline" size={16} />
                <Text style={styles.detailValue}>KasaFund wallet</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Next scheduled debit</Text>
              <Text style={[styles.detailValue, styles.dateValue]}>
                {dateLabel(initialSettings.nextRunAt)}
              </Text>
            </View>
          </View>

          <View style={[styles.balanceCard, !hasEnoughNow && styles.balanceWarning]}>
            <View style={styles.balanceIcon}>
              <Ionicons
                color={hasEnoughNow ? COLORS.primary : COLORS.warning}
                name={hasEnoughNow ? "checkmark-circle" : "alert-circle"}
                size={21}
              />
            </View>
            <View style={styles.balanceCopy}>
              <Text style={styles.balanceTitle}>Wallet balance · {money(walletBalance)}</Text>
              <Text style={styles.balanceText}>
                {hasEnoughNow
                  ? "Your current balance can cover the next contribution."
                  : "You can still enable this, but you must add money before the due date."}
              </Text>
            </View>
          </View>

          <View style={styles.assuranceList}>
            {[
              ["notifications-outline", "You will be reminded before the scheduled debit."],
              ["shield-checkmark-outline", "KasaFund will never make your wallet balance negative."],
              ["pause-circle-outline", "You can turn this off at any time before the next debit."],
            ].map(([icon, label]) => (
              <View key={label} style={styles.assuranceRow}>
                <Ionicons color={COLORS.primary} name={icon as keyof typeof Ionicons.glyphMap} size={18} />
                <Text style={styles.assuranceText}>{label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          activeOpacity={0.86}
          disabled={saving || enabled === initialSettings.enabled}
          onPress={save}
          style={[
            styles.saveButton,
            (saving || enabled === initialSettings.enabled) && styles.saveButtonDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.saveButtonText}>
              {enabled ? "Enable auto-contribution" : "Turn off auto-contribution"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  assuranceList: { gap: 14, marginTop: 22 },
  assuranceRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  assuranceText: { color: COLORS.textMuted, flex: 1, fontSize: 12, lineHeight: 18 },
  balanceCard: { alignItems: "center", backgroundColor: COLORS.primarySoft, borderRadius: 16, flexDirection: "row", marginTop: 16, padding: 15 },
  balanceCopy: { flex: 1 },
  balanceIcon: { alignItems: "center", backgroundColor: COLORS.background, borderRadius: 11, height: 40, justifyContent: "center", marginRight: 11, width: 40 },
  balanceText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  balanceTitle: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  balanceWarning: { backgroundColor: COLORS.warningSurface },
  closeButton: { alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  container: { backgroundColor: COLORS.background, flex: 1, paddingBottom: 24, paddingHorizontal: 20, paddingTop: 18 },
  content: { paddingBottom: 24 },
  dateValue: { flex: 1, textAlign: "right" },
  detailLabel: { color: COLORS.textMuted, fontSize: 12 },
  detailRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 42 },
  detailValue: { color: COLORS.text, fontSize: 12, fontWeight: "700", maxWidth: "62%" },
  detailsCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 17, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 7 },
  divider: { backgroundColor: COLORS.border, height: StyleSheet.hairlineWidth },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  headerCopy: { flex: 1 },
  heroCard: { alignItems: "center", backgroundColor: COLORS.primarySoft, borderRadius: 21, paddingHorizontal: 24, paddingVertical: 24 },
  heroIcon: { alignItems: "center", backgroundColor: COLORS.background, borderRadius: 18, height: 56, justifyContent: "center", marginBottom: 12, width: 56 },
  heroText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  heroTitle: { color: COLORS.primaryDark, fontSize: 17, fontWeight: "700" },
  saveButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 14, height: 54, justifyContent: "center" },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: COLORS.background, fontSize: 14, fontWeight: "800" },
  sectionTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700", marginBottom: 10, marginTop: 22 },
  switchCard: { alignItems: "center", borderColor: COLORS.border, borderRadius: 17, borderWidth: 1, flexDirection: "row", marginTop: 16, padding: 16 },
  switchCopy: { flex: 1 },
  switchSubtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  switchTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "700", marginTop: 3 },
  walletValue: { alignItems: "center", flexDirection: "row", gap: 6 },
});
