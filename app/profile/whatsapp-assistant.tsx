import {
  apiService,
  type WhatsAppLinkCode,
  type WhatsAppLinkStatus,
} from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
  primaryLight: "#E3F2EC",
  whatsapp: "#168C54",
  accent: "#E8B84B",
  background: "#F6F8F7",
  surface: "#FFFFFF",
  border: "#E2E8E5",
  text: "#12211C",
  textMuted: "#6B7A75",
  danger: "#C0392B",
};

export default function WhatsAppAssistantScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<WhatsAppLinkStatus | null>(null);
  const [linkCode, setLinkCode] = useState<WhatsAppLinkCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const nextStatus = await apiService.getWhatsAppLinkStatus();
      setStatus(nextStatus);
      if (nextStatus.linked) setLinkCode(null);
    } catch (error) {
      Alert.alert(
        "Couldn’t load WhatsApp",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStatus();
    }, [loadStatus])
  );

  const generateCode = async () => {
    setWorking(true);
    try {
      setLinkCode(await apiService.createWhatsAppLinkCode());
    } catch (error) {
      Alert.alert(
        "Couldn’t create link code",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setWorking(false);
    }
  };

  const copyCode = async () => {
    if (!linkCode) return;
    await Clipboard.setStringAsync(linkCode.linkMessage);
    Alert.alert("Copied", "The WhatsApp link message was copied.");
  };

  const openWhatsApp = async () => {
    if (!linkCode?.deepLink) {
      Alert.alert(
        "WhatsApp number unavailable",
        "The KasaFund WhatsApp number has not been configured on the server yet."
      );
      return;
    }
    try {
      await Linking.openURL(linkCode.deepLink);
    } catch {
      Alert.alert("Couldn’t open WhatsApp", "Copy the link message and send it manually.");
    }
  };

  const confirmUnlink = () => {
    Alert.alert(
      "Disconnect WhatsApp?",
      "Kasa will immediately lose access to your KasaFund account information on this WhatsApp number.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              await apiService.unlinkWhatsApp();
              setStatus((current) =>
                current
                  ? { ...current, linked: false, phoneLast4: "", linkedAt: null }
                  : current
              );
              setLinkCode(null);
            } catch (error) {
              Alert.alert(
                "Couldn’t disconnect",
                error instanceof Error ? error.message : "Please try again."
              );
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons color={COLORS.text} name="arrow-back" size={21} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WhatsApp assistant</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons color="#FFFFFF" name="logo-whatsapp" size={32} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>MEET KASA</Text>
              <Text style={styles.heroTitle}>KasaFund help in WhatsApp</Text>
              <Text style={styles.heroText}>
                Ask about KasaFund or securely check selected account information.
              </Text>
            </View>
            <View style={styles.heroRing} />
          </View>

          <View style={styles.statusCard}>
            <View
              style={[
                styles.statusIcon,
                status?.linked ? styles.statusIconLinked : null,
              ]}
            >
              <Ionicons
                color={status?.linked ? COLORS.whatsapp : COLORS.textMuted}
                name={status?.linked ? "checkmark-circle" : "link-outline"}
                size={23}
              />
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.cardTitle}>
                {status?.linked ? "WhatsApp connected" : "Not connected"}
              </Text>
              <Text style={styles.cardText}>
                {status?.linked
                  ? `Linked to the number ending in ${status.phoneLast4}`
                  : "Generate a secure one-time code to link your number."}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                status?.linked ? styles.statusBadgeLinked : null,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  status?.linked ? styles.statusBadgeTextLinked : null,
                ]}
              >
                {status?.linked ? "ACTIVE" : "OFF"}
              </Text>
            </View>
          </View>

          {!status?.linked && linkCode ? (
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>ONE-TIME LINK MESSAGE</Text>
              <TouchableOpacity activeOpacity={0.75} onPress={() => void copyCode()} style={styles.codeRow}>
                <Text style={styles.codeText}>{linkCode.linkMessage}</Text>
                <Ionicons color={COLORS.primary} name="copy-outline" size={20} />
              </TouchableOpacity>
              <Text style={styles.codeHint}>
                Send this exact message to KasaFund on WhatsApp. It expires in 10 minutes and works once.
              </Text>
              <TouchableOpacity onPress={() => void openWhatsApp()} style={styles.whatsappButton}>
                <Ionicons color="#FFFFFF" name="logo-whatsapp" size={20} />
                <Text style={styles.whatsappButtonText}>Open WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!status?.linked && !linkCode ? (
            <TouchableOpacity
              disabled={working}
              onPress={() => void generateCode()}
              style={[styles.primaryButton, working && styles.disabled]}
            >
              {working ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons color="#FFFFFF" name="link-outline" size={20} />
                  <Text style={styles.primaryButtonText}>Generate secure link code</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          <Text style={styles.sectionTitle}>What Kasa can access</Text>
          <View style={styles.permissionsCard}>
            {[
              ["wallet-outline", "Wallet balance", "Read-only balance information"],
              ["calendar-outline", "Contribution schedule", "Upcoming group due dates"],
              ["people-outline", "Your groups", "Active memberships and contribution terms"],
              ["shield-checkmark-outline", "KYC status", "Verification status only"],
            ].map(([icon, title, subtitle], index) => (
              <View key={title}>
                <View style={styles.permissionRow}>
                  <View style={styles.permissionIcon}>
                    <Ionicons color={COLORS.primary} name={icon as any} size={19} />
                  </View>
                  <View style={styles.permissionCopy}>
                    <Text style={styles.permissionTitle}>{title}</Text>
                    <Text style={styles.permissionText}>{subtitle}</Text>
                  </View>
                  <Ionicons color={COLORS.whatsapp} name="checkmark" size={19} />
                </View>
                {index < 3 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>

          <View style={styles.safetyCard}>
            <Ionicons color={COLORS.primary} name="shield-checkmark" size={22} />
            <View style={styles.safetyCopy}>
              <Text style={styles.safetyTitle}>Read-only by design</Text>
              <Text style={styles.safetyText}>
                Kasa cannot contribute, withdraw, transfer money, vote, change your profile, or reveal identity documents through WhatsApp.
              </Text>
            </View>
          </View>

          {status?.linked ? (
            <TouchableOpacity disabled={working} onPress={confirmUnlink} style={styles.unlinkButton}>
              {working ? (
                <ActivityIndicator color={COLORS.danger} />
              ) : (
                <Text style={styles.unlinkText}>Disconnect WhatsApp</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  headerTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  loading: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { paddingBottom: 44, paddingHorizontal: 20 },
  hero: { backgroundColor: COLORS.primary, borderRadius: 22, flexDirection: "row", overflow: "hidden", padding: 19 },
  heroIcon: { alignItems: "center", backgroundColor: COLORS.whatsapp, borderRadius: 17, height: 56, justifyContent: "center", marginRight: 14, width: 56, zIndex: 1 },
  heroCopy: { flex: 1, zIndex: 1 },
  eyebrow: { color: COLORS.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginBottom: 5 },
  heroTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  heroText: { color: "rgba(255,255,255,0.72)", fontSize: 11, lineHeight: 16, marginTop: 5 },
  heroRing: { borderColor: "rgba(255,255,255,0.07)", borderRadius: 90, borderWidth: 24, height: 180, position: "absolute", right: -75, top: -75, width: 180 },
  statusCard: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 17, borderWidth: 1, flexDirection: "row", marginTop: 17, padding: 15 },
  statusIcon: { alignItems: "center", backgroundColor: "#EEF1F0", borderRadius: 13, height: 44, justifyContent: "center", marginRight: 12, width: 44 },
  statusIconLinked: { backgroundColor: "#E0F5E9" },
  statusCopy: { flex: 1 },
  cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  cardText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  statusBadge: { backgroundColor: "#EEF1F0", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  statusBadgeLinked: { backgroundColor: "#E0F5E9" },
  statusBadgeText: { color: COLORS.textMuted, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  statusBadgeTextLinked: { color: COLORS.whatsapp },
  codeCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, marginTop: 17, padding: 17 },
  codeLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  codeRow: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 13, flexDirection: "row", justifyContent: "space-between", marginTop: 10, padding: 14 },
  codeText: { color: COLORS.primary, fontSize: 18, fontWeight: "900", letterSpacing: 0.7 },
  codeHint: { color: COLORS.textMuted, fontSize: 11, lineHeight: 17, marginTop: 10 },
  whatsappButton: { alignItems: "center", backgroundColor: COLORS.whatsapp, borderRadius: 13, flexDirection: "row", height: 50, justifyContent: "center", marginTop: 15 },
  whatsappButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", marginLeft: 8 },
  primaryButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 14, flexDirection: "row", height: 54, justifyContent: "center", marginTop: 17 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", marginLeft: 8 },
  disabled: { opacity: 0.6 },
  sectionTitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 9, marginTop: 26, textTransform: "uppercase" },
  permissionsCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  permissionRow: { alignItems: "center", flexDirection: "row", padding: 14 },
  permissionIcon: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 11, height: 38, justifyContent: "center", marginRight: 11, width: 38 },
  permissionCopy: { flex: 1 },
  permissionTitle: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  permissionText: { color: COLORS.textMuted, fontSize: 10, marginTop: 3 },
  divider: { backgroundColor: "#EDF1EF", height: 1, marginLeft: 63 },
  safetyCard: { alignItems: "flex-start", backgroundColor: COLORS.primaryLight, borderRadius: 16, flexDirection: "row", marginTop: 17, padding: 15 },
  safetyCopy: { flex: 1, marginLeft: 11 },
  safetyTitle: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  safetyText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  unlinkButton: { alignItems: "center", borderColor: "#EDCBC7", borderRadius: 14, borderWidth: 1, height: 52, justifyContent: "center", marginTop: 20 },
  unlinkText: { color: COLORS.danger, fontSize: 14, fontWeight: "800" },
});
