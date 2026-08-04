import {
  AUTH_COLORS,
  AuthButton,
  AuthField,
  AuthScaffold,
} from "@/components/auth/AuthUI";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const handleResetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      Alert.alert("Invalid email", "Enter the email address connected to your account.");
      return;
    }

    setIsLoading(true);
    try {
      // Replace with the password-reset endpoint when email delivery is configured.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setEmail(normalizedEmail);
      setIsEmailSent(true);
    } catch {
      Alert.alert("Could not send email", "Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow={isEmailSent ? "CHECK YOUR INBOX" : "ACCOUNT RECOVERY"}
      subtitle={isEmailSent
        ? "Use the secure link in your email to create a new password."
        : "We’ll help you regain access to your KasaFund account."}
      title={isEmailSent ? "Reset link sent" : "Forgot your password?"}
    >
      {isEmailSent ? (
        <View style={styles.sentContent}>
          <View style={styles.sentIcon}>
            <Ionicons color={AUTH_COLORS.primary} name="mail-open-outline" size={30} />
          </View>
          <Text style={styles.sentTitle}>Email on its way</Text>
          <Text style={styles.sentText}>
            If an account exists for <Text style={styles.email}>{email}</Text>, you’ll receive reset instructions shortly.
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setIsEmailSent(false)}
            style={styles.resendButton}
          >
            <Ionicons color={AUTH_COLORS.primary} name="refresh-outline" size={17} />
            <Text style={styles.resendText}>Try another email</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <AuthField
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            icon="mail-outline"
            keyboardType="email-address"
            label="Email address"
            onChangeText={setEmail}
            onSubmitEditing={() => void handleResetPassword()}
            placeholder="you@example.com"
            returnKeyType="send"
            value={email}
          />
          <AuthButton label="Send reset link" loading={isLoading} onPress={() => void handleResetPassword()} />
          <View style={styles.helpNote}>
            <Ionicons color={AUTH_COLORS.primary} name="information-circle-outline" size={18} />
            <Text style={styles.helpText}>For security, we won’t confirm whether an email is registered.</Text>
          </View>
        </>
      )}

      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => router.replace("/(auth)/login")}
        style={styles.backToLogin}
      >
        <Ionicons color={AUTH_COLORS.primary} name="arrow-back" size={16} />
        <Text style={styles.backToLoginText}>Back to sign in</Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  backToLogin: { alignItems: "center", alignSelf: "center", flexDirection: "row", marginTop: 25, padding: 7 },
  backToLoginText: { color: AUTH_COLORS.primary, fontSize: 12, fontWeight: "800", marginLeft: 6 },
  email: { color: AUTH_COLORS.text, fontWeight: "800" },
  helpNote: { alignItems: "center", backgroundColor: AUTH_COLORS.primaryLight, borderRadius: 13, flexDirection: "row", marginTop: 17, padding: 13 },
  helpText: { color: AUTH_COLORS.textMuted, flex: 1, fontSize: 10, lineHeight: 15, marginLeft: 9 },
  resendButton: { alignItems: "center", borderColor: AUTH_COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", marginTop: 22, paddingHorizontal: 17, paddingVertical: 12 },
  resendText: { color: AUTH_COLORS.primary, fontSize: 12, fontWeight: "800", marginLeft: 7 },
  sentContent: { alignItems: "center", paddingHorizontal: 10, paddingTop: 5 },
  sentIcon: { alignItems: "center", backgroundColor: AUTH_COLORS.primaryLight, borderRadius: 24, height: 72, justifyContent: "center", marginBottom: 17, width: 72 },
  sentText: { color: AUTH_COLORS.textMuted, fontSize: 12, lineHeight: 19, maxWidth: 310, textAlign: "center" },
  sentTitle: { color: AUTH_COLORS.text, fontSize: 18, fontWeight: "800", marginBottom: 7 },
});
