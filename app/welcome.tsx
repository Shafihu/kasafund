import { KasaFundMark } from "@/components/branding/KasaFundMark";
import { kasaColors } from "@/constants/design";
import { openKasaFundPublicPage } from "@/constants/publicLinks";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [reduceMotion, setReduceMotion] = useState(false);
  const imageEntrance = useRef(new Animated.Value(0)).current;
  const copyEntrance = useRef(new Animated.Value(0)).current;
  const actionEntrance = useRef(new Animated.Value(0)).current;
  const compact = height < 720;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      imageEntrance.setValue(1);
      copyEntrance.setValue(1);
      actionEntrance.setValue(1);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(imageEntrance, {
        duration: 650,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(copyEntrance, {
          duration: 420,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(220),
        Animated.timing(actionEntrance, {
          duration: 380,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [actionEntrance, copyEntrance, imageEntrance, reduceMotion]);

  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  const openAuthScreen = (screen: "/(auth)/register" | "/(auth)/login") => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.push(screen);
  };

  const openLegalPage = (page: "terms" | "privacy") => {
    void openKasaFundPublicPage(page).catch(() => undefined);
  };

  const copyTranslateY = copyEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const actionTranslateY = actionEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 0],
  });
  const imageScale = imageEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [1.04, 1],
  });

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: imageEntrance, transform: [{ scale: imageScale }] }]}>
        <Image
          accessibilityLabel="Young KasaFund members talking together outside"
          cachePolicy="memory-disk"
          contentFit="cover"
          contentPosition="center"
          source={require("@/assets/images/kasafund-welcome-editorial-v4.png")}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <LinearGradient
        colors={[
          "rgba(255,249,237,0.22)",
          "rgba(255,249,237,0.06)",
          "rgba(255,249,237,0)",
          "rgba(255,249,237,0.04)",
          "rgba(255,249,237,0.84)",
          "rgba(255,249,237,0.98)",
        ]}
        locations={[0, 0.24, 0.46, 0.67, 0.84, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View accessibilityLabel="KasaFund" style={styles.brand}>
            <KasaFundMark size={40} />
            <Text style={styles.brandName}>KasaFund</Text>
          </View>
          <Pressable
            accessibilityHint="Opens sign in"
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => openAuthScreen("/(auth)/login")}
            style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}
          >
            <Text style={styles.signInText}>Sign in</Text>
          </Pressable>
        </View>

        <Animated.View
          style={[
            styles.copy,
            compact && styles.copyCompact,
            { opacity: copyEntrance, transform: [{ translateY: copyTranslateY }] },
          ]}
        >
          <Text style={[styles.title, compact && styles.titleCompact]}>
            Save on your own. Thrive together.
          </Text>
          <Text style={styles.subtitle}>
            Personal savings, trusted susu groups and fundraising kept clear in one place.
          </Text>
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View
          style={[
            styles.actions,
            { opacity: actionEntrance, transform: [{ translateY: actionTranslateY }] },
          ]}
        >
          <Pressable
            accessibilityHint="Creates a new KasaFund account"
            accessibilityRole="button"
            onPress={() => openAuthScreen("/(auth)/register")}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          >
            <Text style={styles.primaryButtonText}>Get started</Text>
            <View style={styles.arrowButton}>
              <Ionicons color={kasaColors.brandStrong} name="arrow-forward" size={20} />
            </View>
          </Pressable>

          <View style={styles.legalNotice}>
            <Text style={styles.footerText}>By continuing, you agree to KasaFund’s</Text>
            <View style={styles.legalLinks}>
              <Pressable
                accessibilityHint="Opens KasaFund's terms on kasafund.com"
                accessibilityRole="link"
                hitSlop={7}
                onPress={() => openLegalPage("terms")}
                style={({ pressed }) => [styles.legalLinkButton, pressed && styles.pressed]}
              >
                <Text style={styles.legalLink}>Terms of Service</Text>
              </Pressable>
              <Text style={styles.legalSeparator}>and</Text>
              <Pressable
                accessibilityHint="Opens KasaFund's privacy policy on kasafund.com"
                accessibilityRole="link"
                hitSlop={7}
                onPress={() => openLegalPage("privacy")}
                style={({ pressed }) => [styles.legalLinkButton, pressed && styles.pressed]}
              >
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#FFF9ED", flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 20 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 58 },
  brand: { alignItems: "center", flexDirection: "row", gap: 10 },
  brandName: { color: kasaColors.brandStrong, fontSize: 20, fontWeight: "900", letterSpacing: -0.6 },
  signInButton: { alignItems: "center", backgroundColor: "rgba(255,249,237,0.72)", borderColor: "rgba(11,77,62,0.28)", borderRadius: 22, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 17 },
  signInText: { color: kasaColors.brandStrong, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  copy: { marginTop: 58, maxWidth: 350 },
  copyCompact: { marginTop: 30 },
  title: { color: kasaColors.brandStrong, fontSize: 40, fontWeight: "900", letterSpacing: -1.6, lineHeight: 44 },
  titleCompact: { fontSize: 35, lineHeight: 39 },
  subtitle: { color: "#4F5F59", fontSize: 14, lineHeight: 21, marginTop: 14, maxWidth: 325 },
  spacer: { flex: 1, minHeight: 100 },
  actions: { paddingBottom: 8 },
  primaryButton: { alignItems: "center", backgroundColor: kasaColors.brand, borderRadius: 17, flexDirection: "row", justifyContent: "space-between", minHeight: 60, paddingLeft: 20, paddingRight: 10 },
  primaryButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  primaryButtonText: { color: kasaColors.white, fontSize: 15, fontWeight: "900" },
  arrowButton: { alignItems: "center", backgroundColor: kasaColors.accent, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  footerText: { color: "rgba(18,33,28,0.52)", fontSize: 9, lineHeight: 14, marginTop: 12, textAlign: "center" },
  legalLink: { color: kasaColors.brandStrong, fontSize: 9, fontWeight: "800", textDecorationLine: "underline" },
  legalLinkButton: { alignItems: "center", justifyContent: "center", minHeight: 30 },
  legalLinks: { alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: -6 },
  legalNotice: { alignItems: "center" },
  legalSeparator: { color: "rgba(18,33,28,0.52)", fontSize: 9, marginHorizontal: 5 },
});
