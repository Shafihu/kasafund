import {
  apiService,
  type ApiUser,
  type UserPreferences,
} from "@/services/apiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  profileImage?: string;
  bio?: string;
  role?: "user" | "super_admin";
  emailVerified?: boolean;
  isPhoneVerified?: boolean;
  walletBalance?: number;
  notificationPrefs?: ApiUser["notificationPrefs"];
  preferences?: UserPreferences;
  identityVerification?: ApiUser["identityVerification"];
  payoutMethod?: ApiUser["payoutMethod"];
}

const mapApiUser = (user: ApiUser): User => ({
  id: user._id,
  email: user.email,
  fullName: user.fullName,
  phoneNumber: user.phoneNumber ?? "",
  profileImage: user.profileImage,
  bio: user.bio ?? "",
  role: user.role,
  emailVerified: user.emailVerified,
  isPhoneVerified: user.isPhoneVerified,
  walletBalance: user.walletBalance,
  notificationPrefs: user.notificationPrefs,
  preferences: user.preferences,
  identityVerification: user.identityVerification,
  payoutMethod: user.payoutMethod,
});

export interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGoogleLoading: boolean;
  error: string | null;
  isOnline: boolean;
  emailVerificationDevCode: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  continueWithGoogle: (idToken: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  checkAuthStatus: () => Promise<void>;
  setOnlineStatus: (isOnline: boolean) => void;
  verifyEmail: (code: string) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isGoogleLoading: false,
      error: null,
      isOnline: true,
      emailVerificationDevCode: null,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const { isOnline } = get();

          if (isOnline) {
            // Use API service
            const response = await apiService.login({ email, password });
            const user = mapApiUser(response.data.user);

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              emailVerificationDevCode:
                response.data.emailVerification?.devCode || null,
            });
          } else {
            throw new Error("You need an internet connection to sign in");
          }
        } catch (error) {
          set({
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "Login failed. Please try again.",
          });
          throw error;
        }
      },

      continueWithGoogle: async (idToken: string) => {
        set({ isGoogleLoading: true, error: null });

        try {
          if (!get().isOnline) {
            throw new Error("You need an internet connection to continue with Google");
          }

          const response = await apiService.googleLogin({ idToken });
          set({
            user: mapApiUser(response.data.user),
            isAuthenticated: true,
            isGoogleLoading: false,
            error: null,
            emailVerificationDevCode: null,
          });
        } catch (error) {
          set({
            isGoogleLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "Google sign-in failed. Please try again.",
          });
          throw error;
        }
      },

      signup: async (fullName: string, email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const { isOnline } = get();

          if (isOnline) {
            // Use API service
            const response = await apiService.signup({
              fullName,
              email,
              password,
            });
            const user = mapApiUser(response.data.user);

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              emailVerificationDevCode:
                response.data.emailVerification?.devCode || null,
            });
          } else {
            throw new Error("You need an internet connection to create an account");
          }
        } catch (error) {
          set({
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "Sign up failed. Please try again.",
          });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });

        try {
          const { isOnline } = get();

          if (isOnline) {
            await apiService.logout();
          } else {
            // Simulate API call for offline mode
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            isGoogleLoading: false,
            error: null,
            emailVerificationDevCode: null,
          });

          try {
            const { GoogleSignin } = await import(
              "@react-native-google-signin/google-signin"
            );
            await GoogleSignin.signOut();
          } catch {
            // A Google session may not exist; the KasaFund session is already closed.
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      updateProfile: async (updates: Partial<User>) => {
        const { user, isOnline } = get();
        if (!user) return;

        try {
          if (isOnline) {
            // Use API service
            const response = await apiService.updateProfile(updates);

            // The API response has a nested structure with data.user
            const userData = (response as any).data?.user || response;

            const updatedUser = mapApiUser(userData);

            set({ user: updatedUser });
          } else {
            // Update local state only
            set({ user: { ...user, ...updates } });
          }
        } catch (error) {
          throw error;
        }
      },

      checkAuthStatus: async () => {
        try {
          const { isOnline } = get();

          if (isOnline) {
            if (!(await apiService.hasAuthToken())) {
              set({ user: null, isAuthenticated: false });
              return;
            }

            const profile = await apiService.getProfile();
            const user = mapApiUser(profile);
            set({ user, isAuthenticated: true });
          }
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },

      verifyEmail: async (code: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.verifyEmail(code);
          set({
            user: mapApiUser(response.data.user),
            isLoading: false,
            emailVerificationDevCode: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Email verification failed",
          });
          throw error;
        }
      },

      resendEmailVerification: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.resendEmailVerification();
          set({
            isLoading: false,
            emailVerificationDevCode:
              response.data?.emailVerification?.devCode || null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Could not resend verification email",
          });
          throw error;
        }
      },

      setOnlineStatus: (isOnline: boolean) => {
        set({ isOnline });
      },

      clearError: () => {
        set({ error: null });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isOnline: state.isOnline,
      }),
    }
  )
);
