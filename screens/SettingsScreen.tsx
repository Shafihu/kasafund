import { KasaCard } from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { KasaFundPublicPage, openKasaFundPublicPage } from "@/constants/publicLinks";
import { useAuthStore } from "@/stores/useAuthStore";
import { handleLogout } from "@/utils/navigation-utils";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

const COLORS = {
  primary: kasaColors.brand,
  background: kasaColors.background,
  surface: kasaColors.surface,
  border: kasaColors.border,
  text: kasaColors.text,
  textMuted: kasaColors.textMuted,
  danger: kasaColors.danger,
};

interface SettingItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  destructive?: boolean;
  onPress?: () => void;
  info?: boolean;
  external?: boolean;
}

export function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const version = Constants.expoConfig?.version || "1.0.0";

  const confirmLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out of KasaFund?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: handleLogout },
    ]);
  };

  const explainPayouts = () => {
    Alert.alert(
      "How group payouts work",
      "At the end of a scheduled payout day, KasaFund checks that the full group pot is available. The recipient’s wallet is credited, the rotation advances, and every member is notified. If the pot is incomplete, the payout stays pending."
    );
  };

  const openPublicPage = (page: KasaFundPublicPage) => {
    void openKasaFundPublicPage(page).catch(() => {
      Alert.alert("Could not open page", "Check your internet connection and try again.");
    });
  };

  const sections: { title: string; items: SettingItem[] }[] = [
    {
      title: "Account",
      items: [
        {
          id: "account",
          title: "Account settings",
          subtitle: "Personal details and verification status",
          icon: "person-outline",
          onPress: () => router.push("/profile/account"),
        },
        {
          id: "standing",
          title: "Account standing",
          subtitle: "Group eligibility, debts and suspension history",
          icon: "shield-checkmark-outline",
          onPress: () => router.push("/profile/account-standing"),
        },
        {
          id: "leaderboard",
          title: "KasaPoints leaderboard",
          subtitle: "See the community’s top achievement earners",
          icon: "trophy-outline",
          onPress: () => router.push("/profile/leaderboard"),
        },
        {
          id: "notifications",
          title: "Notification settings",
          subtitle: "Delivery channels and activity alerts",
          icon: "notifications-outline",
          onPress: () => router.push("/profile/notifications"),
        },
        {
          id: "privacy",
          title: "Privacy settings",
          subtitle: "Profile visibility and invitation controls",
          icon: "lock-closed-outline",
          onPress: () => router.push("/profile/privacy"),
        },
        {
          id: "whatsapp-assistant",
          title: "WhatsApp assistant",
          subtitle: "Securely link your account with Kasa",
          icon: "logo-whatsapp",
          onPress: () => router.push("/profile/whatsapp-assistant"),
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          id: "wallet",
          title: "Wallet settings",
          subtitle: "Balance privacy and wallet information",
          icon: "wallet-outline",
          onPress: () => router.push("/profile/wallet-settings"),
        },
        {
          id: "groups",
          title: "Group settings",
          subtitle: "Contribution, invitation and payout alerts",
          icon: "people-outline",
          onPress: () => router.push("/profile/group-settings"),
        },
        {
          id: "fundraising",
          title: "Fundraising settings",
          subtitle: "Campaign alerts and donation privacy",
          icon: "heart-outline",
          onPress: () => router.push("/profile/fundraising-settings"),
        },
      ],
    },
    {
      title: "Help & information",
      items: [
        {
          id: "onboarding",
          title: "Replay introduction",
          subtitle: "Take another look at how KasaFund works",
          icon: "play-circle-outline",
          onPress: () => router.push({ pathname: "/profile/onboarding-preview", params: { preview: "true" } }),
        },
        {
          id: "payout-guide",
          title: "How payouts work",
          subtitle: "Scheduling, wallet credits and delayed payouts",
          icon: "cash-outline",
          onPress: explainPayouts,
        },
        {
          id: "support",
          title: "Support centre",
          subtitle: "Account, payment, group and campaign help",
          icon: "help-circle-outline",
          external: true,
          onPress: () => openPublicPage("support"),
        },
        {
          id: "privacy-policy",
          title: "Privacy Policy",
          subtitle: "How KasaFund collects and protects information",
          icon: "document-lock-outline",
          external: true,
          onPress: () => openPublicPage("privacy"),
        },
        {
          id: "terms",
          title: "Terms of Service",
          subtitle: "The rules and agreements for using KasaFund",
          icon: "document-text-outline",
          external: true,
          onPress: () => openPublicPage("terms"),
        },
        {
          id: "about",
          title: "About KasaFund",
          subtitle: `Secure group savings and fundraising · Version ${version}`,
          icon: "information-circle-outline",
          info: true,
        },
      ],
    },
    {
      title: "Security",
      items: [
        {
          id: "logout",
          title: "Sign out",
          subtitle: `Signed in as ${user?.email || "KasaFund user"}`,
          icon: "log-out-outline",
          destructive: true,
          onPress: confirmLogout,
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <KasaCard padded={false} style={styles.card}>
            {section.items.map((item, index) => {
              const iconColor = item.destructive
                ? COLORS.danger
                : item.color || COLORS.primary;
              return (
                <View key={item.id}>
                  <Pressable
                    accessibilityRole={item.info ? "text" : "button"}
                    disabled={item.info}
                    onPress={item.onPress}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: `${iconColor}12` }]}>
                      <Ionicons color={iconColor} name={item.icon} size={21} />
                    </View>
                    <View style={styles.copy}>
                      <Text style={[styles.rowTitle, item.destructive && { color: COLORS.danger }]}>{item.title}</Text>
                      <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                    </View>
                    {!item.info ? (
                      <Ionicons color={COLORS.textMuted} name={item.external ? "open-outline" : "chevron-forward"} size={item.external ? 17 : 19} />
                    ) : null}
                  </Pressable>
                  {index < section.items.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              );
            })}
          </KasaCard>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, paddingBottom: 28, paddingTop: 28 },
  section: { marginBottom: 26, paddingHorizontal: 20 },
  sectionTitle: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.2, marginBottom: 9 },
  card: { overflow: "hidden" },
  row: { alignItems: "center", flexDirection: "row", minHeight: 72, paddingHorizontal: 15, paddingVertical: 12 },
  rowPressed: { backgroundColor: kasaColors.surfaceMuted },
  iconWrap: { alignItems: "center", borderRadius: 10, height: 38, justifyContent: "center", marginRight: 13, width: 38 },
  copy: { flex: 1, marginRight: 10 },
  rowTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  rowSubtitle: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  divider: { backgroundColor: kasaColors.border, height: StyleSheet.hairlineWidth, marginLeft: 66 },
});
