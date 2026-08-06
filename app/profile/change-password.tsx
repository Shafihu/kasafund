import { apiService } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

const COLORS = {
  primary: "#0B4D3E",
  background: "#F6F8F7",
  surface: "#FFFFFF",
  border: "#E2E8E5",
  text: "#12211C",
  textMuted: "#6B7A75",
};

function PasswordField({
  label,
  value,
  onChangeText,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordInputWrap}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          style={styles.passwordInput}
          value={value}
        />
        <TouchableOpacity
          accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`}
          hitSlop={8}
          onPress={() => setVisible((current) => !current)}
        >
          <Ionicons color={COLORS.textMuted} name={visible ? "eye-off-outline" : "eye-outline"} size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!currentPassword || newPassword.length < 8) {
      Alert.alert("Check your password", "Enter your current password and use at least 8 characters for the new one.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don’t match", "Enter the same new password in both fields.");
      return;
    }
    setSaving(true);
    try {
      const response = await apiService.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password changed", response.message, [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Couldn’t change password", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons color={COLORS.text} name="arrow-back" size={21} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change password</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.securityIntro}>
            <View style={styles.securityIcon}>
              <Ionicons color={COLORS.primary} name="lock-closed-outline" size={23} />
            </View>
            <Text style={styles.introTitle}>Protect your KasaFund account</Text>
            <Text style={styles.introText}>Use a password you do not use on another app. Your current password is required to authorize this change.</Text>
          </View>

          <View style={styles.formCard}>
            <PasswordField autoFocus label="Current password" onChangeText={setCurrentPassword} value={currentPassword} />
            <PasswordField label="New password" onChangeText={setNewPassword} value={newPassword} />
            <PasswordField label="Confirm new password" onChangeText={setConfirmPassword} value={confirmPassword} />
            <View style={styles.requirementRow}>
              <Ionicons color={newPassword.length >= 8 ? COLORS.primary : COLORS.textMuted} name={newPassword.length >= 8 ? "checkmark-circle" : "ellipse-outline"} size={16} />
              <Text style={styles.requirementText}>At least 8 characters</Text>
            </View>
          </View>

          <TouchableOpacity disabled={saving} onPress={submit} style={[styles.saveButton, saving && { opacity: 0.65 }]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Change password</Text>}
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
  content: { paddingBottom: 40, paddingHorizontal: 20 },
  securityIntro: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 25 },
  securityIcon: { alignItems: "center", backgroundColor: "#E6F2EE", borderRadius: 20, height: 62, justifyContent: "center", marginBottom: 13, width: 62 },
  introTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  introText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: "center" },
  formCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 17, borderWidth: 1, gap: 18, padding: 17 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  passwordInputWrap: { alignItems: "center", backgroundColor: COLORS.background, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, flexDirection: "row", paddingHorizontal: 13 },
  passwordInput: { color: COLORS.text, flex: 1, fontSize: 15, minHeight: 50, paddingRight: 12 },
  requirementRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  requirementText: { color: COLORS.textMuted, fontSize: 12 },
  saveButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 14, justifyContent: "center", marginTop: 20, minHeight: 52 },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
