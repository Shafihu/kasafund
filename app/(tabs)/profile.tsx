import { SettingsScreen } from "@/screens/SettingsScreen";
import { KasaPointAvatar } from "@/components/users/KasaPointAvatar";
import { apiService, type KasaPointTier } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: "#0B4D3E",
  primaryLight: "#E8F2EE",
  background: "#F6F8F7",
  surface: "#FFFFFF",
  border: "#E2E9E6",
  text: "#12211C",
  textMuted: "#64736E",
  verified: "#1D9BF0",
  warning: "#9B6617",
  warningSurface: "#FFF5E3",
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function verificationCopy(status?: string) {
  if (status === "in_progress" || status === "in_review") return "Verification in progress";
  if (status === "declined" || status === "resubmission_required") return "Verification needs attention";
  return "Complete identity verification";
}

export default function UserSettings() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const displayName = user?.fullName || "KasaFund member";
  const avatarInitials = getInitials(displayName);
  const verificationStatus = user?.identityVerification?.status;
  const isIdentityVerified = verificationStatus === "verified";
  const [kasaPointTier, setKasaPointTier] = useState<KasaPointTier>("starter");

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void apiService.getPublicUserProfile(user.id).then((response) => {
      if (active) setKasaPointTier(response.data.achievements.tier);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user?.id]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ACCOUNT</Text>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <Pressable
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push("/profile/account")}
            style={({ pressed }) => [styles.editIconButton, pressed && styles.pressed]}
          >
            <Ionicons color={COLORS.primary} name="create-outline" size={20} />
          </Pressable>
        </View>

        <Pressable
          accessibilityHint="Shows your profile as a KasaFund member"
          accessibilityLabel={`View ${displayName}'s member profile`}
          accessibilityRole="button"
          disabled={!user?.id}
          onPress={() => {
            if (!user?.id) return;
            router.push({ pathname: "/users/[id]", params: { id: user.id } });
          }}
          style={({ pressed }) => [
            styles.profileCard,
            pressed && styles.profileCardPressed,
          ]}
        >
          <KasaPointAvatar
            accessibilityLabel={`${displayName}'s profile picture`}
            imageUrl={user?.profileImage}
            initials={avatarInitials}
            size={76}
            tier={kasaPointTier}
          />

          <View style={styles.identityCopy}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.name}>{displayName}</Text>
              {isIdentityVerified ? (
                <Ionicons
                  accessibilityLabel="Identity verified"
                  color={COLORS.verified}
                  name="checkmark-circle"
                  size={18}
                />
              ) : null}
            </View>
            {user?.email ? <Text numberOfLines={1} style={styles.email}>{user.email}</Text> : null}
          </View>
          <View style={styles.profileCardAction}>
            <Ionicons color={COLORS.textMuted} name="chevron-forward" size={19} />
          </View>
        </Pressable>

        {!isIdentityVerified ? (
          <Pressable
            accessibilityHint="Opens identity verification"
            accessibilityRole="button"
            onPress={() => router.push("/profile/identity-verification")}
            style={({ pressed }) => [styles.verificationCard, pressed && styles.pressed]}
          >
            <View style={styles.verificationIcon}>
              <Ionicons color={COLORS.warning} name="finger-print-outline" size={21} />
            </View>
            <View style={styles.verificationCopy}>
              <Text style={styles.verificationTitle}>{verificationCopy(verificationStatus)}</Text>
              <Text style={styles.verificationText}>
                Verify your identity to join groups and make transactions.
              </Text>
            </View>
            <Ionicons color={COLORS.warning} name="arrow-forward" size={17} />
          </Pressable>
        ) : null}

        <SettingsScreen />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: { borderRadius: 34, height: 68, width: 68 },
  avatarFallback: { alignItems: "center", backgroundColor: COLORS.primaryLight, justifyContent: "center" },
  avatarFrame: { borderColor: COLORS.surface, borderRadius: 38, borderWidth: 3, shadowColor: "#07372C", shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.09, shadowRadius: 10 },
  avatarInitials: { color: COLORS.primary, fontSize: 21, fontWeight: "800", letterSpacing: 0.2 },
  content: { paddingBottom: 110 },
  editIconButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, height: 46, justifyContent: "center", shadowColor: "#07372C", shadowOffset: { height: 3, width: 0 }, shadowOpacity: 0.04, shadowRadius: 8, width: 46 },
  email: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingBottom: 18, paddingHorizontal: 20, paddingTop: 10 },
  headerTitle: { color: COLORS.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.8 },
  identityCopy: { flex: 1, marginLeft: 16 },
  name: { color: COLORS.text, flexShrink: 1, fontSize: 20, fontWeight: "800", letterSpacing: -0.4, marginRight: 5 },
  nameRow: { alignItems: "center", flexDirection: "row" },
  pressed: { opacity: 0.68 },
  profileCard: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 20, borderWidth: 1, flexDirection: "row", marginHorizontal: 20, padding: 18, shadowColor: "#07372C", shadowOffset: { height: 5, width: 0 }, shadowOpacity: 0.04, shadowRadius: 14 },
  profileCardAction: { alignItems: "center", height: 44, justifyContent: "center", marginLeft: 8, width: 24 },
  profileCardPressed: { opacity: 0.72, transform: [{ scale: 0.995 }] },
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  verificationCard: { alignItems: "center", backgroundColor: COLORS.warningSurface, borderColor: "#F0D8AA", borderRadius: 16, borderWidth: 1, flexDirection: "row", marginHorizontal: 20, marginTop: 14, padding: 14 },
  verificationCopy: { flex: 1, marginHorizontal: 11 },
  verificationIcon: { alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  verificationText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  verificationTitle: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
});
