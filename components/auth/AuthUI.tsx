import { KasaFundMark } from "@/components/branding/KasaFundMark";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const AUTH_COLORS = {
  primary: "#0B4D3E",
  primaryDark: "#07372C",
  primaryLight: "#E7F1ED",
  accent: "#E8B84B",
  background: "#F7F9F8",
  surface: "#FFFFFF",
  border: "#DFE7E3",
  text: "#12211C",
  textMuted: "#697873",
  placeholder: "#9AA8A3",
  error: "#C0392B",
  success: "#1E8E5A",
};

type AuthScaffoldProps = {
  children: ReactNode;
  eyebrow: string;
  subtitle: string;
  title: string;
};

export function AuthScaffold({ children, eyebrow, subtitle, title }: AuthScaffoldProps) {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/welcome");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.ringLarge} />
          <View style={styles.ringSmall} />
          <SafeAreaView edges={["top"]}>
            <TouchableOpacity
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={8}
              onPress={goBack}
              style={styles.backButton}
            >
              <Ionicons color={AUTH_COLORS.surface} name="arrow-back" size={20} />
            </TouchableOpacity>

            <View style={styles.brandRow}>
              <KasaFundMark size={45} />
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>KasaFund</Text>
                <Text style={styles.brandTagline}>Secure community finance</Text>
              </View>
            </View>

            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </SafeAreaView>
        </View>

        <View style={styles.sheet}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type AuthFieldProps = TextInputProps & {
  error?: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onToggleSecure?: () => void;
  secureVisible?: boolean;
};

export function AuthField({
  error,
  icon,
  label,
  onToggleSecure,
  secureVisible,
  ...inputProps
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : null,
        ]}
      >
        <Ionicons
          color={focused ? AUTH_COLORS.primary : AUTH_COLORS.placeholder}
          name={icon}
          size={18}
          style={styles.inputIcon}
        />
        <TextInput
          {...inputProps}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          placeholderTextColor={AUTH_COLORS.placeholder}
          style={[styles.input, inputProps.style]}
        />
        {onToggleSecure ? (
          <TouchableOpacity
            accessibilityLabel={secureVisible ? "Hide password" : "Show password"}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onToggleSecure}
          >
            <Ionicons
              color={AUTH_COLORS.placeholder}
              name={secureVisible ? "eye-off-outline" : "eye-outline"}
              size={19}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

type AuthButtonProps = {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
};

export function AuthButton({ disabled, label, loading, onPress }: AuthButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.86}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.submitButton, (disabled || loading) && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={AUTH_COLORS.surface} />
      ) : (
        <>
          <Text style={styles.submitText}>{label}</Text>
          <View style={styles.submitArrow}>
            <Ionicons color={AUTH_COLORS.primaryDark} name="arrow-forward" size={17} />
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    marginLeft: 20,
    marginTop: 7,
    width: 40,
  },
  brandCopy: { marginLeft: 11 },
  brandName: { color: AUTH_COLORS.surface, fontSize: 17, fontWeight: "800" },
  brandRow: { alignItems: "center", flexDirection: "row", marginBottom: 24, marginHorizontal: 20, marginTop: 18 },
  brandTagline: { color: "rgba(255,255,255,0.6)", fontSize: 9, marginTop: 2 },
  container: { backgroundColor: AUTH_COLORS.primary, flex: 1 },
  disabled: { opacity: 0.55 },
  errorText: { color: AUTH_COLORS.error, fontSize: 11, marginTop: 6 },
  eyebrow: { color: AUTH_COLORS.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 7, marginHorizontal: 22 },
  fieldBlock: { marginBottom: 17 },
  header: { backgroundColor: AUTH_COLORS.primary, minHeight: 292, overflow: "hidden", paddingBottom: 48 },
  input: { color: AUTH_COLORS.text, flex: 1, fontSize: 14, height: "100%" },
  inputIcon: { marginRight: 10 },
  inputWrapper: { alignItems: "center", backgroundColor: AUTH_COLORS.background, borderColor: AUTH_COLORS.border, borderRadius: 14, borderWidth: 1.5, flexDirection: "row", height: 54, paddingHorizontal: 14 },
  inputWrapperError: { borderColor: AUTH_COLORS.error },
  inputWrapperFocused: { backgroundColor: AUTH_COLORS.surface, borderColor: AUTH_COLORS.primary },
  label: { color: AUTH_COLORS.text, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  ringLarge: { borderColor: "rgba(255,255,255,0.06)", borderRadius: 135, borderWidth: 28, height: 270, position: "absolute", right: -105, top: -75, width: 270 },
  ringSmall: { borderColor: "rgba(232,184,75,0.1)", borderRadius: 75, borderWidth: 1, bottom: 18, height: 150, left: -75, position: "absolute", width: 150 },
  scrollContent: { flexGrow: 1 },
  sheet: { backgroundColor: AUTH_COLORS.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, flex: 1, marginTop: -29, minHeight: 500, paddingBottom: 34, paddingHorizontal: 22, paddingTop: 27 },
  submitArrow: { alignItems: "center", backgroundColor: AUTH_COLORS.accent, borderRadius: 17, height: 34, justifyContent: "center", position: "absolute", right: 10, width: 34 },
  submitButton: { alignItems: "center", backgroundColor: AUTH_COLORS.primary, borderRadius: 15, flexDirection: "row", height: 56, justifyContent: "center", marginTop: 3, shadowColor: AUTH_COLORS.primaryDark, shadowOffset: { height: 7, width: 0 }, shadowOpacity: 0.18, shadowRadius: 12 },
  submitText: { color: AUTH_COLORS.surface, fontSize: 15, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 18, marginHorizontal: 22, marginTop: 6, maxWidth: 320 },
  title: { color: AUTH_COLORS.surface, fontSize: 29, fontWeight: "800", letterSpacing: -0.8, lineHeight: 34, marginHorizontal: 22 },
});
