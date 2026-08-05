import { KasaButton } from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { apiService, type PhoneVerificationChallenge } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
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

export default function PhoneVerificationScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const codeInputRef = useRef<TextInput>(null);
  const [phoneNumber, setPhoneNumber] = useState(user?.isPhoneVerified ? "" : user?.phoneNumber || "");
  const [challenge, setChallenge] = useState<PhoneVerificationChallenge | null>(null);
  const [code, setCode] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  useEffect(() => {
    if (!challenge) return;
    const timer = setTimeout(() => codeInputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [challenge]);

  const requestCode = async () => {
    if (phoneNumber.replace(/\D/g, "").length < 9) {
      Alert.alert("Check the number", "Enter a valid mobile number. Include the country code if it is outside Ghana.");
      return;
    }
    setSending(true);
    try {
      const response = await apiService.startPhoneVerification(phoneNumber);
      setChallenge(response.data.phoneVerification);
      setSecondsRemaining(response.data.phoneVerification.resendAfterSeconds);
      setCode("");
    } catch (error) {
      Alert.alert("Could not send code", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSending(false);
    }
  };

  const resendCode = async () => {
    if (secondsRemaining > 0 || sending) return;
    setSending(true);
    try {
      const response = await apiService.resendPhoneVerification();
      setChallenge(response.data.phoneVerification);
      setSecondsRemaining(response.data.phoneVerification.resendAfterSeconds);
      setCode("");
    } catch (error) {
      Alert.alert("Could not resend code", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{4,10}$/.test(code)) return;
    setVerifying(true);
    try {
      await apiService.verifyPhoneNumber(code);
      await checkAuthStatus();
      Alert.alert(
        user?.isPhoneVerified ? "Phone number changed" : "Phone number verified",
        "Your verified number is now saved to your KasaFund account.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert("Code not accepted", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const useDifferentNumber = () => {
    setChallenge(null);
    setCode("");
    setPhoneNumber("");
  };

  const changingNumber = Boolean(user?.isPhoneVerified && user.phoneNumber);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons color={kasaColors.text} name="arrow-back" size={21} />
          </Pressable>
          <Text style={styles.headerTitle}>{changingNumber ? "Change phone number" : "Verify phone number"}</Text>
          <View style={styles.headerButtonPlaceholder} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroIcon}>
            <Ionicons color={kasaColors.brand} name={challenge ? "chatbubble-ellipses-outline" : "phone-portrait-outline"} size={30} />
          </View>
          <Text style={styles.title}>{challenge ? "Enter the code" : changingNumber ? "Verify your new number" : "Add a trusted number"}</Text>
          <Text style={styles.subtitle}>
            {challenge
              ? `We sent a verification code by SMS to ${challenge.maskedPhone}.`
              : "We’ll send a one-time code to confirm that this phone number belongs to you."}
          </Text>

          {changingNumber && !challenge ? (
            <View style={styles.currentNumberCard}>
              <View style={styles.currentNumberIcon}>
                <Ionicons color={kasaColors.success} name="shield-checkmark" size={19} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.currentNumberLabel}>CURRENT VERIFIED NUMBER</Text>
                <Text style={styles.currentNumber}>{user?.phoneNumber}</Text>
              </View>
            </View>
          ) : null}

          {!challenge ? (
            <View style={styles.formCard}>
              <Text style={styles.label}>New phone number</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>GH</Text>
                  <Text style={styles.countryDial}>+233</Text>
                </View>
                <TextInput
                  accessibilityLabel="Phone number"
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  onChangeText={setPhoneNumber}
                  placeholder="24 000 0000"
                  placeholderTextColor={kasaColors.textSubtle}
                  returnKeyType="done"
                  style={styles.phoneInput}
                  value={phoneNumber}
                />
              </View>
              <Text style={styles.helper}>For another country, enter the complete number beginning with +.</Text>
            </View>
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                ref={codeInputRef}
                accessibilityLabel="SMS verification code"
                autoComplete="sms-otp"
                keyboardType="number-pad"
                maxLength={10}
                onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                onSubmitEditing={() => void verifyCode()}
                placeholder="000000"
                placeholderTextColor={kasaColors.textSubtle}
                returnKeyType="done"
                style={styles.codeInput}
                textContentType="oneTimeCode"
                value={code}
              />
              {challenge.devCode ? (
                <View style={styles.presentationCode}>
                  <Ionicons color="#8A5B13" name="flask-outline" size={17} />
                  <Text style={styles.presentationText}>Presentation code: <Text style={styles.presentationValue}>{challenge.devCode}</Text></Text>
                </View>
              ) : null}
              <View style={styles.resendRow}>
                <Text style={styles.resendPrompt}>Didn’t receive it?</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={secondsRemaining > 0 || sending}
                  hitSlop={8}
                  onPress={() => void resendCode()}
                >
                  <Text style={[styles.resendLink, secondsRemaining > 0 && styles.resendDisabled]}>
                    {secondsRemaining > 0 ? `Resend in ${secondsRemaining}s` : sending ? "Sending…" : "Resend code"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.safetyNote}>
            <Ionicons color={kasaColors.brand} name="lock-closed-outline" size={18} />
            <Text style={styles.safetyText}>
              {changingNumber
                ? "Your current number stays on the account until the new number is successfully verified."
                : "KasaFund will never ask you to share this code with another person."}
            </Text>
          </View>

          <KasaButton
            disabled={challenge ? !/^\d{4,10}$/.test(code) : phoneNumber.replace(/\D/g, "").length < 9}
            label={challenge ? "Verify and save number" : "Send verification code"}
            loading={challenge ? verifying : sending}
            onPress={challenge ? () => void verifyCode() : () => void requestCode()}
          />

          {challenge ? (
            <Pressable
              accessibilityRole="button"
              onPress={useDifferentNumber}
              style={({ pressed }) => [styles.differentNumber, pressed && styles.pressed]}
            >
              <Text style={styles.differentNumberText}>Use a different number</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: kasaColors.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 12, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  headerButtonPlaceholder: { height: 44, width: 44 },
  headerTitle: { color: kasaColors.text, fontSize: 17, fontWeight: "800" },
  content: { paddingBottom: 44, paddingHorizontal: 20, paddingTop: 22 },
  heroIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 20, height: 64, justifyContent: "center", width: 64 },
  title: { color: kasaColors.text, fontSize: 27, fontWeight: "900", letterSpacing: -0.7, marginTop: 20 },
  subtitle: { color: kasaColors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 345 },
  currentNumberCard: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 16, borderWidth: 1, flexDirection: "row", marginTop: 24, padding: 14 },
  currentNumberIcon: { alignItems: "center", backgroundColor: "#E6F4EC", borderRadius: 12, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  currentNumberLabel: { color: kasaColors.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  currentNumber: { color: kasaColors.text, fontSize: 14, fontWeight: "800", marginTop: 4 },
  flex: { flex: 1 },
  formCard: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 18, borderWidth: 1, marginBottom: 16, marginTop: 22, padding: 17 },
  label: { color: kasaColors.text, fontSize: 13, fontWeight: "800", marginBottom: 9 },
  phoneInputRow: { alignItems: "stretch", borderColor: kasaColors.border, borderRadius: 13, borderWidth: 1, flexDirection: "row", minHeight: 54, overflow: "hidden" },
  countryCode: { alignItems: "center", backgroundColor: kasaColors.surfaceMuted, borderRightColor: kasaColors.border, borderRightWidth: 1, flexDirection: "row", gap: 5, justifyContent: "center", paddingHorizontal: 12 },
  countryCodeText: { color: kasaColors.textMuted, fontSize: 10, fontWeight: "800" },
  countryDial: { color: kasaColors.text, fontSize: 13, fontWeight: "800" },
  phoneInput: { color: kasaColors.text, flex: 1, fontSize: 16, paddingHorizontal: 13 },
  helper: { color: kasaColors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 9 },
  codeInput: { backgroundColor: kasaColors.surfaceMuted, borderColor: kasaColors.border, borderRadius: 14, borderWidth: 1, color: kasaColors.text, fontSize: 25, fontWeight: "800", letterSpacing: 7, minHeight: 62, paddingHorizontal: 16, textAlign: "center" },
  presentationCode: { alignItems: "center", backgroundColor: "#FFF4D9", borderColor: "#F0D9A5", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 13, padding: 11 },
  presentationText: { color: "#805719", flex: 1, fontSize: 11 },
  presentationValue: { fontWeight: "900", letterSpacing: 1.5 },
  resendRow: { alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: 20 },
  resendPrompt: { color: kasaColors.textMuted, fontSize: 12 },
  resendLink: { color: kasaColors.brand, fontSize: 12, fontWeight: "800", marginLeft: 5 },
  resendDisabled: { color: kasaColors.textSubtle },
  safetyNote: { alignItems: "flex-start", backgroundColor: kasaColors.brandSoft, borderRadius: 14, flexDirection: "row", gap: 10, marginBottom: 20, padding: 14 },
  safetyText: { color: kasaColors.textMuted, flex: 1, fontSize: 11, lineHeight: 17 },
  differentNumber: { alignItems: "center", justifyContent: "center", minHeight: 48, marginTop: 8 },
  differentNumberText: { color: kasaColors.brand, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.68 },
});
