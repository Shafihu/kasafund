import { GROUP_AGREEMENT_VERSION, type ApiGroup } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
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
};

function money(value: number) {
  return `GH₵ ${(value / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const TERMS = [
  {
    icon: "calendar-outline" as const,
    title: "Contribution commitment",
    body: "You agree to contribute on schedule for every cycle in your payout round, including cycles after receiving your payout.",
  },
  {
    icon: "cash-outline" as const,
    title: "Remaining-round debt",
    body: "If you receive a payout and later default, suspension makes your unpaid commitment for that same round immediately payable to the remaining recipients.",
  },
  {
    icon: "people-outline" as const,
    title: "Group decisions",
    body: "Eligible paid members may vote on delayed payouts. If the final vote expires, confirmed contributions can be returned and defaulters suspended.",
  },
  {
    icon: "shield-checkmark-outline" as const,
    title: "Records and privacy",
    body: "KasaFund keeps payment, vote and agreement records for accountability. Your KYC documents and debt details are not published as punishment.",
  },
];

export type GroupAgreementSummary = Pick<
  ApiGroup,
  "name" | "memberCount" | "contribution"
>;

export function GroupAgreementModal({
  group,
  onAccept,
  onClose,
  visible,
}: {
  group: GroupAgreementSummary | null;
  onAccept: () => void;
  onClose: () => void;
  visible: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (visible) setConfirmed(false);
  }, [visible]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>DIGITAL GROUP AGREEMENT</Text>
            <Text style={styles.title}>Review before joining</Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Close agreement"
            hitSlop={8}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={21} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.groupCard}>
            <View style={styles.groupIcon}>
              <Ionicons name="people" size={23} color={C.primary} />
            </View>
            <View style={styles.groupCopy}>
              <Text numberOfLines={1} style={styles.groupName}>
                {group?.name || "KasaFund group"}
              </Text>
              <Text style={styles.groupMeta}>
                {group?.memberCount || 0} members ·{" "}
                {group ? money(group.contribution.amount) : "—"}{" "}
                {group?.contribution.frequency || ""}
              </Text>
            </View>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>v{GROUP_AGREEMENT_VERSION}</Text>
            </View>
          </View>

          <View style={styles.scheduleCard}>
            <View>
              <Text style={styles.scheduleLabel}>YOUR SCHEDULED COMMITMENT</Text>
              <Text style={styles.scheduleAmount}>
                {group ? money(group.contribution.amount) : "—"}
              </Text>
            </View>
            <View style={styles.scheduleSide}>
              <Text style={styles.scheduleFrequency}>
                {group?.contribution.frequency || "—"}
              </Text>
              <Text style={styles.scheduleGrace}>
                {group?.contribution.gracePeriodDays || 0} grace days
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>What you are agreeing to</Text>
          {TERMS.map((term) => (
            <View key={term.title} style={styles.termRow}>
              <View style={styles.termIcon}>
                <Ionicons name={term.icon} size={19} color={C.primary} />
              </View>
              <View style={styles.termCopy}>
                <Text style={styles.termTitle}>{term.title}</Text>
                <Text style={styles.termBody}>{term.body}</Text>
              </View>
            </View>
          ))}

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={19} color={C.warning} />
            <Text style={styles.noticeText}>
              This agreement records your group commitment. It does not authorize
              public shaming, harassment, or publication of your identity documents.
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmed }}
            activeOpacity={0.8}
            onPress={() => setConfirmed((current) => !current)}
            style={styles.confirmRow}
          >
            <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
              {confirmed && <Ionicons name="checkmark" size={15} color={C.surface} />}
            </View>
            <Text style={styles.confirmText}>
              I have reviewed these terms and agree to my contribution commitment.
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!confirmed}
            onPress={onAccept}
            style={[styles.acceptButton, !confirmed && styles.acceptButtonDisabled]}
          >
            <Ionicons name="shield-checkmark" size={18} color={C.surface} />
            <Text style={styles.acceptText}>Accept and continue</Text>
          </TouchableOpacity>
          <Text style={styles.footerText}>
            Your acceptance time and agreement version will be securely recorded.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: C.background, flex: 1 },
  header: { alignItems: "center", borderBottomColor: C.border, borderBottomWidth: 1, flexDirection: "row", paddingHorizontal: 20, paddingVertical: 14 },
  headerCopy: { flex: 1 },
  eyebrow: { color: C.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  title: { color: C.text, fontSize: 21, fontWeight: "800", marginTop: 4 },
  closeButton: { alignItems: "center", backgroundColor: C.surface, borderColor: C.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  content: { padding: 20, paddingBottom: 28 },
  groupCard: { alignItems: "center", backgroundColor: C.surface, borderColor: C.border, borderRadius: 17, borderWidth: 1, flexDirection: "row", padding: 14 },
  groupIcon: { alignItems: "center", backgroundColor: C.soft, borderRadius: 13, height: 46, justifyContent: "center", marginRight: 11, width: 46 },
  groupCopy: { flex: 1 },
  groupName: { color: C.text, fontSize: 14, fontWeight: "800" },
  groupMeta: { color: C.muted, fontSize: 9, marginTop: 4, textTransform: "capitalize" },
  versionBadge: { backgroundColor: C.background, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 5 },
  versionText: { color: C.muted, fontSize: 7, fontWeight: "700" },
  scheduleCard: { alignItems: "center", backgroundColor: C.primaryDark, borderRadius: 18, flexDirection: "row", justifyContent: "space-between", marginTop: 14, padding: 17 },
  scheduleLabel: { color: "rgba(255,255,255,0.6)", fontSize: 7, fontWeight: "800", letterSpacing: 0.7 },
  scheduleAmount: { color: C.surface, fontSize: 23, fontWeight: "800", marginTop: 6 },
  scheduleSide: { alignItems: "flex-end" },
  scheduleFrequency: { color: C.surface, fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  scheduleGrace: { color: "rgba(255,255,255,0.6)", fontSize: 8, marginTop: 4 },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: "800", marginBottom: 5, marginTop: 24 },
  termRow: { alignItems: "flex-start", flexDirection: "row", paddingVertical: 11 },
  termIcon: { alignItems: "center", backgroundColor: C.soft, borderRadius: 11, height: 39, justifyContent: "center", marginRight: 11, width: 39 },
  termCopy: { flex: 1 },
  termTitle: { color: C.text, fontSize: 11, fontWeight: "800" },
  termBody: { color: C.muted, fontSize: 9, lineHeight: 15, marginTop: 3 },
  notice: { alignItems: "flex-start", backgroundColor: C.warningSoft, borderRadius: 13, flexDirection: "row", marginTop: 10, padding: 13 },
  noticeText: { color: C.muted, flex: 1, fontSize: 9, lineHeight: 15, marginLeft: 8 },
  confirmRow: { alignItems: "flex-start", backgroundColor: C.surface, borderColor: C.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 16, padding: 14 },
  checkbox: { alignItems: "center", borderColor: C.border, borderRadius: 6, borderWidth: 2, height: 23, justifyContent: "center", marginRight: 10, width: 23 },
  checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },
  confirmText: { color: C.text, flex: 1, fontSize: 10, fontWeight: "600", lineHeight: 16 },
  footer: { backgroundColor: C.surface, borderTopColor: C.border, borderTopWidth: 1, padding: 18 },
  acceptButton: { alignItems: "center", backgroundColor: C.primary, borderRadius: 13, flexDirection: "row", justifyContent: "center", paddingVertical: 15 },
  acceptButtonDisabled: { opacity: 0.4 },
  acceptText: { color: C.surface, fontSize: 13, fontWeight: "800", marginLeft: 7 },
  footerText: { color: C.muted, fontSize: 8, marginTop: 8, textAlign: "center" },
});
