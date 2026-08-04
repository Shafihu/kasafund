import { useAuthStore } from "@/stores/useAuthStore";
import { useKycGateStore } from "@/stores/useKycGateStore";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  primary: "#0B4D3E",
  primaryLight: "#E7F1ED",
  accent: "#E8B84B",
  surface: "#FFFFFF",
  border: "#E1E8E5",
  text: "#12211C",
  textMuted: "#697873",
};

export function KycRequiredModal() {
  const router = useRouter();
  const status = useAuthStore((state) => state.user?.identityVerification?.status);
  const action = useKycGateStore((state) => state.action);
  const visible = useKycGateStore((state) => state.visible);
  const hide = useKycGateStore((state) => state.hide);

  const isReviewing = status === "in_review";
  const isStarted = status === "in_progress" || status === "resubmission_required";
  const title = isReviewing
    ? "Verification is being reviewed"
    : isStarted
      ? "Finish your verification"
      : "Verify your identity first";
  const message = isReviewing
    ? `You’ll be able to ${action} as soon as your ID and facial checks are approved.`
    : `Complete a quick government ID and facial scan before you can ${action}.`;

  const openVerification = () => {
    hide();
    requestAnimationFrame(() => router.push("/profile/identity-verification"));
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={hide}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close verification reminder" onPress={hide} style={StyleSheet.absoluteFill} />
        <View style={styles.card}>
          <View style={styles.brandLine} />
          <TouchableOpacity accessibilityLabel="Close" hitSlop={8} onPress={hide} style={styles.closeButton}>
            <Ionicons color={COLORS.textMuted} name="close" size={20} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <View style={styles.iconHalo}>
              <Ionicons color={COLORS.primary} name={isReviewing ? "hourglass-outline" : "finger-print-outline"} size={34} />
            </View>
            <View style={styles.shieldBadge}>
              <Ionicons color={COLORS.primary} name="shield-checkmark" size={14} />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.reasons}>
            <View style={styles.reasonRow}>
              <Ionicons color={COLORS.primary} name="checkmark-circle" size={17} />
              <Text style={styles.reasonText}>Helps protect members and campaign supporters</Text>
            </View>
            <View style={styles.reasonRow}>
              <Ionicons color={COLORS.primary} name="checkmark-circle" size={17} />
              <Text style={styles.reasonText}>Required for group and money features</Text>
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.86} onPress={openVerification} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {isReviewing ? "View verification status" : isStarted ? "Continue verification" : "Verify my identity"}
            </Text>
            <View style={styles.arrowWrap}>
              <Ionicons color={COLORS.primary} name="arrow-forward" size={17} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity hitSlop={8} onPress={hide} style={styles.laterButton}>
            <Text style={styles.laterText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: "center", backgroundColor: "rgba(4,18,14,0.62)", flex: 1, justifyContent: "center", padding: 22 },
  card: { backgroundColor: COLORS.surface, borderRadius: 26, maxWidth: 420, overflow: "hidden", paddingBottom: 20, paddingHorizontal: 22, paddingTop: 30, shadowColor: "#000000", shadowOffset: { height: 14, width: 0 }, shadowOpacity: 0.28, shadowRadius: 24, width: "100%" },
  brandLine: { backgroundColor: COLORS.accent, height: 5, left: 0, position: "absolute", right: 0, top: 0 },
  closeButton: { alignItems: "center", backgroundColor: "#F3F6F4", borderRadius: 12, height: 38, justifyContent: "center", position: "absolute", right: 15, top: 17, width: 38 },
  iconWrap: { alignSelf: "center", marginTop: 8 },
  iconHalo: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 30, height: 82, justifyContent: "center", width: 82 },
  shieldBadge: { alignItems: "center", backgroundColor: COLORS.accent, borderColor: COLORS.surface, borderRadius: 12, borderWidth: 3, bottom: -2, height: 29, justifyContent: "center", position: "absolute", right: -2, width: 29 },
  title: { color: COLORS.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.4, marginTop: 19, textAlign: "center" },
  message: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8, paddingHorizontal: 5, textAlign: "center" },
  reasons: { backgroundColor: "#F7F9F8", borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, gap: 9, marginTop: 19, padding: 13 },
  reasonRow: { alignItems: "center", flexDirection: "row", gap: 9 },
  reasonText: { color: COLORS.text, flex: 1, fontSize: 11, lineHeight: 16 },
  primaryButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 15, flexDirection: "row", height: 56, justifyContent: "center", marginTop: 20 },
  primaryButtonText: { color: COLORS.surface, fontSize: 14, fontWeight: "800" },
  arrowWrap: { alignItems: "center", backgroundColor: COLORS.accent, borderRadius: 17, height: 34, justifyContent: "center", position: "absolute", right: 10, width: 34 },
  laterButton: { alignSelf: "center", marginTop: 14, padding: 4 },
  laterText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
});
