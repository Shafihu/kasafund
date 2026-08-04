import {
  AUTH_COLORS,
  AuthButton,
  AuthField,
  AuthScaffold,
} from "@/components/auth/AuthUI";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function LoginScreen() {
  const router = useRouter();
  const { clearError, error, isLoading, login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!error) return;
    Alert.alert("Could not sign in", error);
    clearError();
  }, [clearError, error]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Enter your email and password to continue.");
      return;
    }

    try {
      await login(email.trim().toLowerCase(), password);
      // handleLoginSuccess();
    } catch {
      // The store exposes the user-facing error.
    }
  };

  return (
    <AuthScaffold
      eyebrow="WELCOME BACK"
      subtitle="Access your groups, wallet, fundraisers, and contribution history."
      title="Sign in securely"
    >
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
        autoComplete="current-password"
        icon="lock-closed-outline"
        label="Password"
        onChangeText={setPassword}
        onSubmitEditing={() => void handleLogin()}
        onToggleSecure={() => setShowPassword((current) => !current)}
        placeholder="Enter your password"
        returnKeyType="done"
        secureTextEntry={!showPassword}
        secureVisible={showPassword}
        value={password}
      />

      <TouchableOpacity
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => router.push("/(auth)/forgot-password")}
        style={styles.forgotButton}
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </TouchableOpacity>

      <AuthButton label="Sign in" loading={isLoading} onPress={() => void handleLogin()} />
      <GoogleAuthButton />

      <View style={styles.securityNote}>
        <Ionicons color={AUTH_COLORS.primary} name="shield-checkmark-outline" size={17} />
        <Text style={styles.securityText}>Your session and payment information are encrypted.</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to KasaFund?</Text>
        <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
          <Text style={styles.footerLink}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: 27 },
  footerLink: { color: AUTH_COLORS.primary, fontSize: 13, fontWeight: "800", marginLeft: 5 },
  footerText: { color: AUTH_COLORS.textMuted, fontSize: 13 },
  forgotButton: { alignSelf: "flex-end", marginBottom: 20, marginTop: -5, paddingVertical: 4 },
  forgotText: { color: AUTH_COLORS.primary, fontSize: 12, fontWeight: "700" },
  securityNote: { alignItems: "center", backgroundColor: AUTH_COLORS.primaryLight, borderRadius: 13, flexDirection: "row", marginTop: 17, paddingHorizontal: 13, paddingVertical: 12 },
  securityText: { color: AUTH_COLORS.textMuted, flex: 1, fontSize: 10, lineHeight: 15, marginLeft: 9 },
});
