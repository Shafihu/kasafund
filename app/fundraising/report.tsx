import { KasaButton } from "@/components/ui";
import { kasaColors, kasaLayout, kasaRadii, kasaSpacing } from "@/constants/design";
import { apiService } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type CampaignReportReason = "scam" | "misleading" | "inappropriate" | "prohibited" | "other";

const REASONS: {
  id: CampaignReportReason;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "scam", title: "Scam or fraud", subtitle: "Suspicious claims, payment requests, or dishonest fundraising", icon: "warning-outline" },
  { id: "misleading", title: "Misleading information", subtitle: "The story, identity, images, or use of funds may be inaccurate", icon: "document-text-outline" },
  { id: "inappropriate", title: "Inappropriate content", subtitle: "Harmful, offensive, or exploitative campaign content", icon: "eye-off-outline" },
  { id: "prohibited", title: "Prohibited fundraising", subtitle: "The campaign appears to fund an unsafe or unlawful activity", icon: "ban-outline" },
  { id: "other", title: "Something else", subtitle: "Another trust or safety concern about this campaign", icon: "ellipsis-horizontal-circle-outline" },
];

export default function ReportCampaignScreen() {
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [reason, setReason] = useState<CampaignReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    const explanation = details.trim();
    if (!id || !reason) {
      setError("Choose the reason that best describes your concern.");
      return;
    }
    if (explanation.length < 10) {
      setError("Add at least 10 characters so the safety team has useful context.");
      return;
    }
    setSubmitting(true); setError("");
    try {
      await apiService.reportCampaign(id, { reason, details: explanation });
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The report could not be submitted. Please try again.");
    } finally { setSubmitting(false); }
  };

  if (submitted) {
    return <SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content"/><View style={styles.successState}><View style={styles.successIcon}><Ionicons color={kasaColors.brand} name="shield-checkmark-outline" size={30}/></View><Text style={styles.successTitle}>Report received</Text><Text style={styles.successText}>KasaFund’s safety team will review this campaign. The organizer will not be told who submitted the report.</Text><KasaButton fullWidth={false} label="Return to campaign" onPress={() => router.back()}/></View></SafeAreaView>;
  }

  return <SafeAreaView edges={["top"]} style={styles.safeArea}>
    <StatusBar barStyle="dark-content"/>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.safeArea}>
      <View style={styles.header}><Pressable accessibilityLabel="Go back" hitSlop={8} onPress={() => router.back()} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}><Ionicons color={kasaColors.text} name="arrow-back" size={21}/></Pressable><Text style={styles.headerTitle}>Report campaign</Text><View style={styles.headerSpacer}/></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.notice}><View style={styles.noticeIcon}><Ionicons color={kasaColors.brand} name="shield-outline" size={22}/></View><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>Confidential safety report</Text><Text style={styles.noticeText}>Tell us what concerns you about “{title || "this campaign"}”. Reporting does not automatically remove or penalize it.</Text></View></View>
        <Text style={styles.sectionTitle}>What concerns you?</Text>
        <View style={styles.reasonCard}>{REASONS.map((item, index) => {
          const selected = reason === item.id;
          return <View key={item.id}><Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { setReason(item.id); setError(""); }} style={({ pressed }) => [styles.reasonRow, pressed && styles.pressed]}><View style={[styles.reasonIcon, selected && styles.reasonIconSelected]}><Ionicons color={selected ? kasaColors.white : kasaColors.brand} name={item.icon} size={20}/></View><View style={styles.reasonCopy}><Text style={styles.reasonTitle}>{item.title}</Text><Text style={styles.reasonSubtitle}>{item.subtitle}</Text></View><Ionicons color={selected ? kasaColors.brand : kasaColors.textMuted} name={selected ? "radio-button-on" : "radio-button-off"} size={21}/></Pressable>{index < REASONS.length - 1 && <View style={styles.divider}/>}</View>;
        })}</View>
        <Text style={styles.sectionTitle}>What should the reviewer know?</Text>
        <TextInput accessibilityLabel="Campaign report details" maxLength={1000} multiline onChangeText={value => { setDetails(value); setError(""); }} placeholder="Describe the specific claim, image, request, or behaviour that concerns you…" placeholderTextColor="#94A19C" style={styles.input} textAlignVertical="top" value={details}/>
        <Text style={styles.counter}>{details.trim().length}/1000 · minimum 10 characters</Text>
        {error ? <View accessibilityLiveRegion="polite" style={styles.error}><Ionicons color={kasaColors.danger} name="alert-circle-outline" size={17}/><Text style={styles.errorText}>{error}</Text></View> : null}
        <KasaButton label="Submit confidential report" loading={submitting} onPress={() => void submit()} style={styles.submit} variant="danger"/>
        <Text style={styles.footerNote}>Use reporting for genuine trust or safety concerns. For urgent danger, contact the appropriate local emergency service.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: kasaColors.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: kasaLayout.screenInset, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: kasaRadii.md, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  headerSpacer: { height: 44, width: 44 },
  headerTitle: { color: kasaColors.text, fontSize: 17, fontWeight: "800" },
  content: { paddingBottom: 42, paddingHorizontal: kasaLayout.screenInset },
  notice: { alignItems: "flex-start", backgroundColor: kasaColors.brandSoft, borderRadius: kasaRadii.lg, flexDirection: "row", marginBottom: kasaSpacing.xxl, padding: 15 },
  noticeIcon: { alignItems: "center", backgroundColor: kasaColors.surface, borderRadius: kasaRadii.md, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: kasaColors.text, fontSize: 14, fontWeight: "800", marginBottom: 3 },
  noticeText: { color: kasaColors.textMuted, fontSize: 11, lineHeight: 17 },
  sectionTitle: { color: kasaColors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.7, marginBottom: 9, textTransform: "uppercase" },
  reasonCard: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: kasaRadii.lg, borderWidth: 1, marginBottom: kasaSpacing.xxl, overflow: "hidden" },
  reasonRow: { alignItems: "center", flexDirection: "row", minHeight: 78, padding: 14 },
  reasonIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: kasaRadii.md, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  reasonIconSelected: { backgroundColor: kasaColors.brand },
  reasonCopy: { flex: 1, marginRight: 8 },
  reasonTitle: { color: kasaColors.text, fontSize: 14, fontWeight: "700" },
  reasonSubtitle: { color: kasaColors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  divider: { backgroundColor: kasaColors.border, height: 1, marginLeft: 68 },
  input: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: kasaRadii.lg, borderWidth: 1, color: kasaColors.text, fontSize: 14, lineHeight: 20, minHeight: 128, padding: 14 },
  counter: { color: kasaColors.textMuted, fontSize: 10, marginTop: 6, textAlign: "right" },
  error: { alignItems: "flex-start", backgroundColor: kasaColors.dangerSoft, borderRadius: kasaRadii.md, flexDirection: "row", gap: 8, marginTop: 14, padding: 11 },
  errorText: { color: kasaColors.danger, flex: 1, fontSize: 11, lineHeight: 16 },
  submit: { marginTop: 20 },
  footerNote: { color: kasaColors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 13, paddingHorizontal: 10, textAlign: "center" },
  pressed: { opacity: 0.72 },
  successState: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 34 },
  successIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 20, height: 68, justifyContent: "center", marginBottom: 17, width: 68 },
  successTitle: { color: kasaColors.text, fontSize: 24, fontWeight: "800" },
  successText: { color: kasaColors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 22, marginTop: 7, maxWidth: 330, textAlign: "center" },
});
