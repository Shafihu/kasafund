import { useAuthStore } from "@/stores/useAuthStore";
import { useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";


interface NavigationGuardProps {
  children: React.ReactNode;
}

export default function NavigationGuard({ children }: NavigationGuardProps) {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated
  );


  useEffect(() => {
    // If user is authenticated and tries to access auth screens, redirect to main app
    if (isAuthenticated) {
      console.log(isAuthenticated, 'from Guard')
      const currentPath = "/" + segments.join("/");
      const authPaths = [
        // "/index",
        "/(auth)/login",
        "/(auth)/signup",
        "/(auth)/forgot-password",
        "/welcome",
        "/onboarding",
      ];

      if (authPaths.includes(currentPath)) {
        router.replace("/(tabs)");
      }
    }
  }, [isAuthenticated, segments, router]);

  return <>{children}</>;
}