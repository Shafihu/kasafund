import { apiService } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ReportReason = "scam" | "harassment" | "impersonation" | "inappropriate" | "other";

const REASONS: { id: ReportReason; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "scam", title: "Scam or fraud", subtitle: "Suspicious money requests or dishonest activity", icon: "warning-outline" },
  { id: "harassment", title: "Harassment", subtitle: "Threatening, abusive, or unwanted behaviour", icon: "hand-left-outline" },
  { id: "impersonation", title: "Impersonation", subtitle: "Pretending to be another person or organization", icon: "people-outline" },
  { id: "inappropriate", title: "Inappropriate content", subtitle: "Offensive or harmful profile information", icon: "eye-off-outline" },
  { id: "other", title: "Something else", subtitle: "Another safety or trust concern", icon: "ellipsis-horizontal-circle-outline" },
];

const COLORS = {
  primary: "#0B4D3E",
  background: "#F5F7F6",
  surface: "#FFFFFF",
  border: "#DFE7E3",
  text: "#12211C",
  muted: "#697873",
  danger: "#C0392B",
  soft: "#E5F2ED",
};

export default function ReportMemberScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!id || !reason) {
      Alert.alert("Choose a reason", "Tell us why you’re reporting this member.");
      return;
    }
    if (reason === "other" && details.trim().length < 10) {
      Alert.alert("Add some details", "Please briefly explain your concern.");
      return;
    }
    setSubmitting(true);
    try {
      await apiService.reportUser(id, { reason, details: details.trim() });
      Alert.alert(
        "Report received",
        "Thank you. The KasaFund safety team will review it. The member won’t be told who submitted the report.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (requestError) {
      Alert.alert("Couldn’t submit report", requestError instanceof Error ? requestError.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={21} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report member</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.notice}>
            <View style={styles.noticeIcon}><Ionicons name="shield-checkmark-outline" size={22} color={COLORS.primary} /></View>
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>Reports are confidential</Text>
              <Text style={styles.noticeText}>Tell us what’s wrong with {name || "this member"}. They won’t see who reported them.</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>What happened?</Text>
          <View style={styles.card}>
            {REASONS.map((item, index) => {
              const selected = reason === item.id;
              return (
                <View key={item.id}>
                  <TouchableOpacity activeOpacity={0.75} onPress={() => setReason(item.id)} style={styles.reasonRow}>
                    <View style={[styles.reasonIcon, selected && styles.reasonIconSelected]}>
                      <Ionicons name={item.icon} size={20} color={selected ? COLORS.surface : COLORS.primary} />
                    </View>
                    <View style={styles.reasonCopy}>
                      <Text style={styles.reasonTitle}>{item.title}</Text>
                      <Text style={styles.reasonSubtitle}>{item.subtitle}</Text>
                    </View>
                    <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={21} color={selected ? COLORS.primary : COLORS.muted} />
                  </TouchableOpacity>
                  {index < REASONS.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Additional details</Text>
          <TextInput
            maxLength={1000}
            multiline
            onChangeText={setDetails}
            placeholder="Share useful context without including sensitive information…"
            placeholderTextColor="#94A19C"
            style={styles.input}
            textAlignVertical="top"
            value={details}
          />
          <Text style={styles.counter}>{details.length}/1000</Text>

          <TouchableOpacity disabled={submitting} onPress={() => void submit()} style={[styles.submitButton, submitting && styles.submitDisabled]}>
            <Text style={styles.submitText}>{submitting ? "Submitting…" : "Submit report"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  headerSpacer: { height: 42, width: 42 },
  headerTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  content: { paddingBottom: 42, paddingHorizontal: 20 },
  notice: { alignItems: "flex-start", backgroundColor: COLORS.soft, borderRadius: 16, flexDirection: "row", marginBottom: 26, padding: 15 },
  noticeIcon: { alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 12, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700", marginBottom: 3 },
  noticeText: { color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  sectionTitle: { color: COLORS.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, marginBottom: 9, textTransform: "uppercase" },
  card: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 17, borderWidth: 1, marginBottom: 25, overflow: "hidden" },
  reasonRow: { alignItems: "center", flexDirection: "row", minHeight: 76, padding: 14 },
  reasonIcon: { alignItems: "center", backgroundColor: COLORS.soft, borderRadius: 12, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  reasonIconSelected: { backgroundColor: COLORS.primary },
  reasonCopy: { flex: 1, marginRight: 8 },
  reasonTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  reasonSubtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  divider: { backgroundColor: "#EDF1EF", height: 1, marginLeft: 68 },
  input: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 15, borderWidth: 1, color: COLORS.text, fontSize: 14, lineHeight: 20, minHeight: 120, padding: 14 },
  counter: { color: COLORS.muted, fontSize: 10, marginBottom: 22, marginTop: 6, textAlign: "right" },
  submitButton: { alignItems: "center", backgroundColor: COLORS.danger, borderRadius: 14, height: 52, justifyContent: "center" },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: COLORS.surface, fontSize: 14, fontWeight: "800" },
});
