import { AUTH_COLORS } from "@/components/auth/AuthUI";
import { useAuthStore } from "@/stores/useAuthStore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
let configured = false;

function GoogleMark() {
  return (
    <Svg accessibilityLabel="Google" height={22} viewBox="0 0 48 48" width={22}>
      <Path
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917Z"
        fill="#FFC107"
      />
      <Path
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.347 4.337-17.694 10.691Z"
        fill="#FF3D00"
      />
      <Path
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44Z"
        fill="#4CAF50"
      />
      <Path
        d="M43.611 20.083H42V20H24v8h11.303a12.05 12.05 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917Z"
        fill="#1976D2"
      />
    </Svg>
  );
}

export function GoogleAuthButton() {
  const continueWithGoogle = useAuthStore((state) => state.continueWithGoogle);
  const isGoogleLoading = useAuthStore((state) => state.isGoogleLoading);
  const [openingGoogle, setOpeningGoogle] = useState(false);
  const loading = openingGoogle || isGoogleLoading;

  const handlePress = async () => {
    if (!webClientId || (Platform.OS === "ios" && !iosClientId)) {
      Alert.alert(
        "Google sign-in needs setup",
        "Add the Google OAuth client IDs to your app environment, then rebuild the development app."
      );
      return;
    }

    let googleModule:
      | typeof import("@react-native-google-signin/google-signin")
      | null = null;

    try {
      setOpeningGoogle(true);
      googleModule = await import(
        "@react-native-google-signin/google-signin"
      );
      const {
        GoogleSignin,
        isSuccessResponse,
      } = googleModule;

      if (!configured) {
        GoogleSignin.configure({
          webClientId,
          ...(iosClientId ? { iosClientId } : {}),
          offlineAccess: false,
          scopes: ["profile", "email"],
        });
        configured = true;
      }

      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      }

      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;

      const idToken = response.data.idToken;
      if (!idToken) {
        throw new Error("Google did not return an identity token");
      }

      await continueWithGoogle(idToken);
    } catch (error) {
      if (
        googleModule?.isErrorWithCode(error) &&
        (error.code === googleModule.statusCodes.SIGN_IN_CANCELLED ||
          error.code === googleModule.statusCodes.IN_PROGRESS)
      ) {
        return;
      }

      if (!useAuthStore.getState().error) {
        Alert.alert(
          "Google sign-in failed",
          error instanceof Error
            ? error.message
            : "Please try again in a moment."
        );
      }
    } finally {
      setOpeningGoogle(false);
    }
  };

  return (
    <>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.divider} />
      </View>
      <TouchableOpacity
        accessibilityLabel="Continue with Google"
        accessibilityRole="button"
        activeOpacity={0.78}
        disabled={loading}
        onPress={() => void handlePress()}
        style={[styles.buttonFrame, loading && styles.buttonDisabled]}
      >
        {loading ? (
          <ActivityIndicator color={AUTH_COLORS.primary} />
        ) : (
          <>
            <View style={styles.googleMark}>
              <GoogleMark />
            </View>
            <Text style={styles.buttonText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  buttonDisabled: { opacity: 0.58 },
  buttonFrame: {
    alignItems: "center",
    backgroundColor: AUTH_COLORS.surface,
    borderColor: AUTH_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    height: 54,
    justifyContent: "center",
  },
  buttonText: { color: AUTH_COLORS.text, fontSize: 14, fontWeight: "700" },
  divider: { backgroundColor: AUTH_COLORS.border, flex: 1, height: 1 },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 14,
    marginTop: 20,
  },
  dividerText: {
    color: AUTH_COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.7,
    marginHorizontal: 11,
  },
  googleMark: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: AUTH_COLORS.border,
    borderRadius: 11,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    marginRight: 10,
    width: 30,
  },
});
