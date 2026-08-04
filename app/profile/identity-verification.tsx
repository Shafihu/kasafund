import {
  apiService,
  type IdentityVerificationState,
  type IdentityVerificationStatus,
} from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: "#0B4D3E",
  accent: "#E8B84B",
  background: "#F6F8F7",
  surface: "#FFFFFF",
  border: "#E2E8E5",
  text: "#12211C",
  textMuted: "#6B7A75",
  primaryLight: "#E7F1ED",
  success: "#1E8E5A",
  danger: "#C84C43",
};

const STATUS_COPY: Record<
  IdentityVerificationState,
  { color: string; icon: keyof typeof Ionicons.glyphMap; label: string; message: string }
> = {
  not_started: {
    color: COLORS.primary,
    icon: "shield-outline",
    label: "Not verified",
    message: "Complete a secure identity check to strengthen trust and unlock regulated features.",
  },
  in_progress: {
    color: "#B7791F",
    icon: "time-outline",
    label: "Verification started",
    message: "Finish the ID and facial scan, then return here for your result.",
  },
  in_review: {
    color: "#B7791F",
    icon: "hourglass-outline",
    label: "Under review",
    message: "Your checks were submitted and are being reviewed securely.",
  },
  verified: {
    color: COLORS.success,
    icon: "shield-checkmark",
    label: "Identity verified",
    message: "Your government ID, liveness, and facial match checks were approved.",
  },
  declined: {
    color: COLORS.danger,
    icon: "alert-circle-outline",
    label: "Needs attention",
    message: "Your last attempt could not be approved. Review the guidance and try again.",
  },
  expired: {
    color: COLORS.danger,
    icon: "refresh-outline",
    label: "Session expired",
    message: "The previous verification session expired. Start a fresh secure check.",
  },
  resubmission_required: {
    color: "#B7791F",
    icon: "camera-reverse-outline",
    label: "Resubmission required",
    message: "One or more images need to be captured again before verification can finish.",
  },
};

const CHECKS = [
  {
    icon: "id-card-outline" as const,
    title: "Government-issued ID",
    text: "Use a valid Ghana Card, passport, or another document allowed by the verification flow.",
  },
  {
    icon: "scan-outline" as const,
    title: "Live facial scan",
    text: "Follow the camera prompts so liveness can confirm that you are physically present.",
  },
  {
    icon: "person-circle-outline" as const,
    title: "Secure facial match",
    text: "Your live scan is compared with the portrait on your identity document.",
  },
];

export default function IdentityVerificationScreen() {
  const router = useRouter();
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const storedStatus = useAuthStore((state) => state.user?.identityVerification);
  const [verification, setVerification] = useState<IdentityVerificationStatus>(
    storedStatus || { provider: "didit", status: "not_started" }
  );
  const hadStoredStatus = useRef(Boolean(storedStatus)).current;
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [consented, setConsented] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await apiService.getIdentityVerificationStatus();
      setVerification(response.data);
      await checkAuthStatus();
    } catch (error) {
      if (!hadStoredStatus) {
        Alert.alert(
          "Couldn’t load verification",
          error instanceof Error ? error.message : "Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [checkAuthStatus, hadStoredStatus]);

  useFocusEffect(
    useCallback(() => {
      void refreshStatus();
    }, [refreshStatus])
  );

  const startVerification = async () => {
    if (!consented) {
      Alert.alert(
        "Consent required",
        "Please confirm that you consent to the ID, liveness, and facial matching checks."
      );
      return;
    }
    setStarting(true);
    try {
      const response = await apiService.startIdentityVerification();
      setVerification(response.data);
      if (response.data.alreadyVerified || !response.data.sessionUrl) {
        await refreshStatus();
        return;
      }

      await WebBrowser.openAuthSessionAsync(
        response.data.sessionUrl,
        Linking.createURL("profile/identity-verification"),
        {
          preferEphemeralSession: true,
          toolbarColor: "#0B4D3E",
        }
      );
      await refreshStatus();
    } catch (error) {
      Alert.alert(
        "Couldn’t start verification",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setStarting(false);
    }
  };

  const current = STATUS_COPY[verification.status] || STATUS_COPY.not_started;
  const canRetry = ["not_started", "in_progress", "declined", "expired", "resubmission_required"].includes(
    verification.status
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Go back" hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons color={COLORS.text} name="arrow-back" size={21} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identity verification</Text>
        <TouchableOpacity accessibilityLabel="Refresh status" hitSlop={8} onPress={() => void refreshStatus()} style={styles.headerButton}>
          <Ionicons color={COLORS.text} name="refresh-outline" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={[styles.heroIcon, { borderColor: current.color }]}>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Ionicons color={current.color} name={current.icon} size={34} />
            )}
          </View>
          <Text style={[styles.statusLabel, { color: current.color }]}>{current.label}</Text>
          <Text style={styles.statusMessage}>{current.message}</Text>
          {verification.failureReason ? (
            <View style={styles.failureNote}>
              <Ionicons color={COLORS.danger} name="information-circle-outline" size={17} />
              <Text style={styles.failureText}>{verification.failureReason}</Text>
            </View>
          ) : null}
          {verification.verifiedAt ? (
            <Text style={styles.dateText}>
              Verified {new Date(verification.verifiedAt).toLocaleDateString("en-GH", { dateStyle: "medium" })}
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>What we’ll verify</Text>
        <View style={styles.checksCard}>
          {CHECKS.map((check, index) => (
            <View key={check.title}>
              <View style={styles.checkRow}>
                <View style={styles.checkIcon}>
                  <Ionicons color={COLORS.primary} name={check.icon} size={21} />
                </View>
                <View style={styles.checkCopy}>
                  <Text style={styles.checkTitle}>{check.title}</Text>
                  <Text style={styles.checkText}>{check.text}</Text>
                </View>
              </View>
              {index < CHECKS.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>

        {verification.status !== "verified" ? (
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consented }}
            activeOpacity={0.8}
            onPress={() => setConsented((value) => !value)}
            style={styles.consentRow}
          >
            <View style={[styles.checkbox, consented && styles.checkboxSelected]}>
              {consented ? <Ionicons color="#FFFFFF" name="checkmark" size={16} /> : null}
            </View>
            <Text style={styles.consentText}>
              I consent to secure processing of my identity document and facial biometrics for identity verification and fraud prevention.
            </Text>
          </TouchableOpacity>
        ) : null}

        {canRetry ? (
          <TouchableOpacity
            activeOpacity={0.86}
            disabled={starting}
            onPress={() => void startVerification()}
            style={[styles.primaryButton, starting && styles.disabled]}
          >
            {starting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons color="#FFFFFF" name="scan-outline" size={20} />
                <Text style={styles.primaryButtonText}>
                  {verification.status === "not_started"
                    ? "Verify my identity"
                    : verification.status === "in_progress"
                      ? "Continue verification"
                      : "Start a new verification"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : verification.status !== "verified" ? (
          <TouchableOpacity activeOpacity={0.82} onPress={() => void refreshStatus()} style={styles.secondaryButton}>
            <Ionicons color={COLORS.primary} name="refresh-outline" size={18} />
            <Text style={styles.secondaryButtonText}>Check verification status</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.privacyNote}>
          <Ionicons color={COLORS.primary} name="lock-closed-outline" size={18} />
          <Text style={styles.privacyText}>
            KasaFund does not store your ID or facial images on its servers. The verification provider processes them under its configured retention policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  headerTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  content: { paddingBottom: 42, paddingHorizontal: 20 },
  heroCard: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 22, borderWidth: 1, padding: 22 },
  heroIcon: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 27, borderWidth: 1, height: 76, justifyContent: "center", width: 76 },
  statusLabel: { fontSize: 18, fontWeight: "800", marginTop: 14 },
  statusMessage: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: "center" },
  dateText: { color: COLORS.textMuted, fontSize: 11, marginTop: 12 },
  failureNote: { alignItems: "flex-start", backgroundColor: "#FBEAE8", borderRadius: 12, flexDirection: "row", gap: 8, marginTop: 14, padding: 11 },
  failureText: { color: COLORS.text, flex: 1, fontSize: 11, lineHeight: 16 },
  sectionTitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.9, marginBottom: 9, marginTop: 24, textTransform: "uppercase" },
  checksCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  checkRow: { alignItems: "center", flexDirection: "row", padding: 15 },
  checkIcon: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  checkCopy: { flex: 1, marginLeft: 13 },
  checkTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  checkText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  divider: { backgroundColor: "#EDF1EF", height: 1, marginLeft: 70 },
  consentRow: { alignItems: "flex-start", flexDirection: "row", marginTop: 22, paddingHorizontal: 2 },
  checkbox: { alignItems: "center", borderColor: COLORS.border, borderRadius: 7, borderWidth: 1.5, height: 24, justifyContent: "center", marginRight: 11, marginTop: 1, width: 24 },
  checkboxSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  consentText: { color: COLORS.textMuted, flex: 1, fontSize: 11, lineHeight: 17 },
  primaryButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 15, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 20, minHeight: 56 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.primary, borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 20, minHeight: 54 },
  secondaryButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  privacyNote: { alignItems: "flex-start", backgroundColor: COLORS.primaryLight, borderRadius: 15, flexDirection: "row", gap: 10, marginTop: 18, padding: 14 },
  privacyText: { color: COLORS.textMuted, flex: 1, fontSize: 10, lineHeight: 16 },
});
