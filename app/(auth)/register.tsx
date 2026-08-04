import {
  AUTH_COLORS,
  AuthButton,
  AuthField,
  AuthScaffold,
} from "@/components/auth/AuthUI";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { openKasaFundPublicPage } from "@/constants/publicLinks";
import { useAuthStore } from "@/stores/useAuthStore";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

function passwordStrength(password: string) {
  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;

  if (!password) return { color: AUTH_COLORS.border, label: "", score: 0 };
  if (points <= 1) return { color: AUTH_COLORS.error, label: "Weak", score: 1 };
  if (points <= 3) return { color: "#C8871F", label: "Fair", score: 2 };
  return { color: AUTH_COLORS.success, label: "Strong", score: 3 };
}

export default function RegisterScreen() {
  const router = useRouter();
  const { clearError, error, isLoading, signup } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const strength = useMemo(() => passwordStrength(password), [password]);
  const passwordError = confirmPassword && password !== confirmPassword
    ? "Passwords do not match"
    : undefined;

  useEffect(() => {
    if (!error) return;
    Alert.alert("Could not create account", error);
    clearError();
  }, [clearError, error]);

  const handleSignUp = async () => {
    if (!fullName.trim()) {
      Alert.alert("Name required", "Enter your full name to continue.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match", "Re-enter your password to confirm it.");
      return;
    }

    try {
      await signup(fullName.trim(), email.trim().toLowerCase(), password);
      // handleSignupSuccess(); 
    } catch {
      // The store exposes the user-facing error.
    }
  };

  const openLegalPage = (page: "terms" | "privacy") => {
    void openKasaFundPublicPage(page).catch(() => {
      Alert.alert("Could not open page", "Check your internet connection and try again.");
    });
  };

  return (
    <AuthScaffold
      eyebrow="JOIN KASAFUND"
      subtitle="Create one secure account for your savings groups, fundraising, and wallet."
      title="Let’s get you started"
    >
      <AuthField
        autoCapitalize="words"
        autoComplete="name"
        autoCorrect={false}
        icon="person-outline"
        label="Full name"
        onChangeText={setFullName}
        placeholder="Ama Serwaa"
        returnKeyType="next"
        value={fullName}
      />
      <AuthField
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        icon="mail-outline"
        keyboardType="email-address"
        label="Email address"
        onChangeText={setEmail}
        placeholder="you@example.com"
        returnKeyType="next"
        value={email}
      />
      <AuthField
        autoCapitalize="none"
        autoComplete="new-password"
        icon="lock-closed-outline"
        label="Password"
        onChangeText={setPassword}
        onToggleSecure={() => setShowPassword((current) => !current)}
        placeholder="At least 8 characters"
        secureTextEntry={!showPassword}
        secureVisible={showPassword}
        value={password}
      />

      {password ? (
        <View style={styles.strengthRow}>
          <View style={styles.strengthTrack}>
            <View
              style={[
                styles.strengthFill,
                { backgroundColor: strength.color, width: `${(strength.score / 3) * 100}%` },
              ]}
            />
          </View>
          <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
        </View>
      ) : null}

      <AuthField
        autoCapitalize="none"
        autoComplete="new-password"
        error={passwordError}
        icon="checkmark-circle-outline"
        label="Confirm password"
        onChangeText={setConfirmPassword}
        onSubmitEditing={() => void handleSignUp()}
        onToggleSecure={() => setShowConfirmPassword((current) => !current)}
        placeholder="Enter your password again"
        returnKeyType="done"
        secureTextEntry={!showConfirmPassword}
        secureVisible={showConfirmPassword}
        value={confirmPassword}
      />

      <AuthButton label="Create account" loading={isLoading} onPress={() => void handleSignUp()} />
      <GoogleAuthButton />

      <View style={styles.legalNotice}>
        <Text style={styles.terms}>By creating an account, you agree to KasaFund’s</Text>
        <View style={styles.legalLinks}>
          <TouchableOpacity
            accessibilityHint="Opens KasaFund's terms on kasafund.com"
            accessibilityRole="link"
            hitSlop={6}
            onPress={() => openLegalPage("terms")}
            style={styles.legalLinkButton}
          >
            <Text style={styles.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.legalSeparator}>and</Text>
          <TouchableOpacity
            accessibilityHint="Opens KasaFund's privacy policy on kasafund.com"
            accessibilityRole="link"
            hitSlop={6}
            onPress={() => openLegalPage("privacy")}
            style={styles.legalLinkButton}
          >
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.footerLink}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: 23 },
  footerLink: { color: AUTH_COLORS.primary, fontSize: 13, fontWeight: "800", marginLeft: 5 },
  footerText: { color: AUTH_COLORS.textMuted, fontSize: 13 },
  legalLink: { color: AUTH_COLORS.primary, fontSize: 10, fontWeight: "800", textDecorationLine: "underline" },
  legalLinkButton: { alignItems: "center", justifyContent: "center", minHeight: 32 },
  legalLinks: { alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: -6 },
  legalNotice: { alignItems: "center", marginTop: 15, paddingHorizontal: 8 },
  legalSeparator: { color: AUTH_COLORS.textMuted, fontSize: 10, marginHorizontal: 5 },
  strengthFill: { borderRadius: 2, height: "100%" },
  strengthLabel: { fontSize: 10, fontWeight: "800", textAlign: "right", width: 38 },
  strengthRow: { alignItems: "center", flexDirection: "row", marginBottom: 15, marginTop: -9 },
  strengthTrack: { backgroundColor: AUTH_COLORS.border, borderRadius: 2, flex: 1, height: 4, overflow: "hidden" },
  terms: { color: AUTH_COLORS.textMuted, fontSize: 10, lineHeight: 15, textAlign: "center" },
});
