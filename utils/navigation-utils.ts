import { useAuthStore } from "@/stores/useAuthStore";
import { router } from "expo-router";

export const handleLogout = async () => {
  const { logout } = useAuthStore.getState();

  try {
    await logout();
    // Reset navigation stack and go to welcome screen
    router.replace("/welcome");
  } catch (error) {
    console.error("Logout failed:", error);
  }
};

export const handleLoginSuccess = () => {
  router.dismissAll();
  const needsOnboarding =
    useAuthStore.getState().user?.preferences?.onboardingCompleted === false;
  router.replace(needsOnboarding ? "/onboarding" : "/(tabs)");
};

export const handleSignupSuccess = () => {
  router.dismissAll();
  router.replace("/onboarding");
};
