import { GroupAgreementModal } from "@/components/groups/GroupAgreementModal";
import { apiService, type ApiGroup } from "@/services/apiService";
import { useKycGate } from "@/hooks/useKycGate";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  primary: "#0B4D3E",
  background: "#FFFFFF",
  surface: "#F6F8F7",
  border: "#E2E8E5",
  text: "#12211C",
  textMuted: "#6B7A75",
};

export default function JoinGroupScreen() {
  const { ensureKyc } = useKycGate();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<ApiGroup | null>(null);
  const [agreementVisible, setAgreementVisible] = useState(false);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    let active = true;
    apiService
      .getGroupJoinPreview(code)
      .then((response) => {
        if (active) setGroup(response.data.group);
      })
      .catch((error) => {
        if (active) {
          Alert.alert(
            "Invitation unavailable",
            error instanceof Error ? error.message : "This invitation link is invalid."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code]);

  const join = async () => {
    if (!code || joining) return;
    if (!ensureKyc("join a savings group")) return;
    try {
      setJoining(true);
      setAgreementVisible(false);
      const response = await apiService.joinGroupByCode(code, true);
      router.replace(`/groups/${response.data._id}`);
    } catch (error) {
      Alert.alert(
        "Could not join group",
        error instanceof Error ? error.message : "The invitation link may be invalid."
      );
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity hitSlop={8} onPress={() => router.back()} style={styles.closeButton}>
        <Ionicons name="close" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="people" size={34} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Join this KasaFund group</Text>
        <Text style={styles.subtitle}>
          {group
            ? `You were invited to ${group.name}. Review its contribution commitment before joining.`
            : "Review the invitation and group commitment before joining."}
        </Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>INVITATION CODE</Text>
          <Text style={styles.code}>{code?.toUpperCase() || "Invalid link"}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!code || !group || joining || loading}
          onPress={() => {
            if (!ensureKyc("join a savings group")) return;
            setAgreementVisible(true);
          }}
          style={[
            styles.joinButton,
            (!code || !group || joining || loading) && styles.disabled,
          ]}
        >
          {joining ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.joinButtonText}>
              {loading ? "Checking invitation…" : "Review agreement"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <GroupAgreementModal
        group={group}
        onAccept={() => void join()}
        onClose={() => setAgreementVisible(false)}
        visible={agreementVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },
  closeButton: { alignItems: "center", height: 44, justifyContent: "center", marginLeft: 16, marginTop: 8, width: 44 },
  content: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 28, paddingBottom: 80 },
  iconWrap: { alignItems: "center", backgroundColor: "#E5F1ED", borderRadius: 24, height: 78, justifyContent: "center", marginBottom: 20, width: 78 },
  title: { color: COLORS.text, fontSize: 23, fontWeight: "700", textAlign: "center" },
  subtitle: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, marginTop: 9, maxWidth: 330, textAlign: "center" },
  codeCard: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, marginVertical: 25, paddingHorizontal: 35, paddingVertical: 18 },
  codeLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1.2 },
  code: { color: COLORS.primary, fontSize: 22, fontWeight: "800", letterSpacing: 2, marginTop: 6 },
  joinButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 12, height: 52, justifyContent: "center", maxWidth: 340, width: "100%" },
  joinButtonText: { color: COLORS.background, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.45 },
});
