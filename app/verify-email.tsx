import { AUTH_COLORS, AuthButton } from "@/components/auth/AuthUI";
import { KasaFundMark } from "@/components/branding/KasaFundMark";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RESEND_SECONDS = 60;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const devCode = useAuthStore((state) => state.emailVerificationDevCode);
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const resendEmailVerification = useAuthStore((state) => state.resendEmailVerification);
  const logout = useAuthStore((state) => state.logout);
  const [code, setCode] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(
      () => setSecondsRemaining((current) => Math.max(0, current - 1)),
      1000
    );
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const submit = async () => {
    if (code.length !== 6) {
      Alert.alert("Code required", "Enter the 6-digit code sent to your email.");
      return;
    }
    try {
      await verifyEmail(code);
      const verifiedUser = useAuthStore.getState().user;
      router.replace(
        verifiedUser?.preferences?.onboardingCompleted === false ? "/onboarding" : "/(tabs)"
      );
    } catch (error) {
      Alert.alert("Could not verify email", error instanceof Error ? error.message : "Try again.");
    }
  };

  const resend = async () => {
    try {
      await resendEmailVerification();
      setCode("");
      setSecondsRemaining(RESEND_SECONDS);
      Alert.alert("Code sent", `A new code was sent to ${user?.email}.`);
    } catch (error) {
      Alert.alert("Could not resend", error instanceof Error ? error.message : "Try again shortly.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.brandRow}>
          <KasaFundMark size={44} />
          <Text style={styles.brandName}>KasaFund</Text>
        </View>

        <View style={styles.iconWrap}>
          <Ionicons color={AUTH_COLORS.primary} name="mail-unread-outline" size={34} />
        </View>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit security code to{"\n"}
          <Text style={styles.email}>{user?.email}</Text>
        </Text>

        <TextInput
          accessibilityLabel="Six digit verification code"
          autoFocus
          autoComplete="one-time-code"
          caretHidden={false}
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
          onSubmitEditing={() => void submit()}
          placeholder="000000"
          placeholderTextColor="#B5C0BC"
          returnKeyType="done"
          style={styles.codeInput}
          textContentType="oneTimeCode"
          value={code}
        />

        {__DEV__ && devCode ? (
          <TouchableOpacity onPress={() => setCode(devCode)} style={styles.devCode}>
            <Ionicons color={AUTH_COLORS.primary} name="construct-outline" size={15} />
            <Text style={styles.devCodeText}>Development code: {devCode}</Text>
          </TouchableOpacity>
        ) : null}

        <AuthButton
          disabled={code.length !== 6}
          label="Verify email"
          loading={isLoading}
          onPress={() => void submit()}
        />

        <View style={styles.resendRow}>
          <Text style={styles.resendPrompt}>Didn’t receive it?</Text>
          <TouchableOpacity
            disabled={secondsRemaining > 0 || isLoading}
            onPress={() => void resend()}
          >
            <Text style={[styles.resendLink, secondsRemaining > 0 && styles.resendDisabled]}>
              {secondsRemaining > 0 ? `Resend in ${secondsRemaining}s` : "Resend code"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => void logout()} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Use a different account</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandName: { color: AUTH_COLORS.primary, fontSize: 18, fontWeight: "800", marginLeft: 10 },
  brandRow: { alignItems: "center", flexDirection: "row", marginBottom: 48 },
  codeInput: { backgroundColor: AUTH_COLORS.surface, borderColor: AUTH_COLORS.border, borderRadius: 17, borderWidth: 1.5, color: AUTH_COLORS.text, fontSize: 31, fontWeight: "800", height: 72, letterSpacing: 13, marginBottom: 16, marginTop: 34, paddingLeft: 23, textAlign: "center" },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 26, paddingBottom: 34 },
  devCode: { alignItems: "center", alignSelf: "center", backgroundColor: AUTH_COLORS.primaryLight, borderRadius: 10, flexDirection: "row", marginBottom: 15, paddingHorizontal: 11, paddingVertical: 8 },
  devCodeText: { color: AUTH_COLORS.primary, fontSize: 11, fontWeight: "700", marginLeft: 6 },
  email: { color: AUTH_COLORS.text, fontWeight: "700" },
  iconWrap: { alignItems: "center", backgroundColor: AUTH_COLORS.primaryLight, borderRadius: 24, height: 76, justifyContent: "center", marginBottom: 22, width: 76 },
  logoutButton: { alignSelf: "center", marginTop: 36, padding: 10 },
  logoutText: { color: AUTH_COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  resendDisabled: { color: AUTH_COLORS.placeholder },
  resendLink: { color: AUTH_COLORS.primary, fontSize: 12, fontWeight: "800", marginLeft: 5 },
  resendPrompt: { color: AUTH_COLORS.textMuted, fontSize: 12 },
  resendRow: { alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: 22 },
  safeArea: { backgroundColor: AUTH_COLORS.background, flex: 1 },
  subtitle: { color: AUTH_COLORS.textMuted, fontSize: 14, lineHeight: 22, textAlign: "center" },
  title: { color: AUTH_COLORS.text, fontSize: 29, fontWeight: "800", letterSpacing: -0.7, marginBottom: 11, textAlign: "center" },
});
