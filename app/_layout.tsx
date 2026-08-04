import { AnimatedAppSplash } from "@/components/splash/AnimatedAppSplash";
import { KycRequiredModal } from "@/components/kyc/KycRequiredModal";
import { AchievementUnlockHost } from "@/components/users/AchievementUnlockHost";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

export const unstable_settings = {
  anchor: '(welcome)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const onboardingCompleted = useAuthStore(
    (state) => state.user?.preferences?.onboardingCompleted
  );
  const emailVerified = useAuthStore((state) => state.user?.emailVerified);
  const needsEmailVerification = isAuthenticated && emailVerified !== true;
  const needsOnboarding =
    isAuthenticated && emailVerified === true && onboardingCompleted === false;
  const canEnterApp =
    isAuthenticated && emailVerified === true && onboardingCompleted !== false;
  const [appIsReady, setAppIsReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const nativeSplashHidden = useRef(false);

  useEffect(() => {
    let active = true;
    const fallback = setTimeout(() => {
      if (active) setAppIsReady(true);
    }, 2500);

    void checkAuthStatus().finally(() => {
      clearTimeout(fallback);
      if (active) setAppIsReady(true);
    });

    return () => {
      active = false;
      clearTimeout(fallback);
    };
  }, [checkAuthStatus]);

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    SplashScreen.hide();
  }, []);

  const finishAnimatedSplash = useCallback(() => {
    setShowAnimatedSplash(false);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={needsOnboarding}>
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false, headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={needsEmailVerification}>
            <Stack.Screen name="verify-email" options={{ gestureEnabled: false, headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={canEnterApp}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="groups" options={{ headerShown: false }} />
            <Stack.Screen name="fundraising" options={{ headerShown: false }} />
            <Stack.Screen name="wallet" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="users/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="users/report" options={{ headerShown: false }} />
            <Stack.Screen
              name="create_group_modal"
              options={{ gestureEnabled: false, headerShown: false, presentation: "modal" }}
            />
            <Stack.Screen
              name="create_campaign_modal"
              options={{ gestureEnabled: false, headerShown: false, presentation: "modal" }}
            />
            <Stack.Screen
              name="notifications_modal"
              options={{ gestureEnabled: true, headerShown: false, presentation: "modal" }}
            />
          </Stack.Protected>
        </Stack>

        <KycRequiredModal />
        <AchievementUnlockHost enabled={canEnterApp} />

        {showAnimatedSplash ? (
          <AnimatedAppSplash
            appIsReady={appIsReady}
            onFinish={finishAnimatedSplash}
            onLayoutReady={hideNativeSplash}
          />
        ) : null}
        <StatusBar style={showAnimatedSplash ? "light" : "auto"} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
