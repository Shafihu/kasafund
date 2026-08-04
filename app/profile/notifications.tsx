import { SettingsPage } from "@/components/settings/SettingsPage";
import { DEFAULT_USER_PREFERENCES } from "@/constants/userPreferences";
import { useAuthStore } from "@/stores/useAuthStore";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const push = user?.notificationPrefs?.push ?? user?.preferences?.notifications ?? true;
  const email = user?.notificationPrefs?.email ?? true;
  const [channels, setChannels] = useState({ push, email });
  const pendingChannels = useRef(new Map<"push" | "email", boolean>());

  useEffect(() => {
    setChannels({
      push: pendingChannels.current.get("push") ?? push,
      email: pendingChannels.current.get("email") ?? email,
    });
  }, [email, push]);

  const updateChannel = async (channel: "push" | "email", value: boolean) => {
    if (pendingChannels.current.has(channel)) return;
    const previousValue = channels[channel];
    const nextChannels = { ...channels, [channel]: value };
    pendingChannels.current.set(channel, value);
    setChannels(nextChannels);
    try {
      await updateProfile({
        notificationPrefs: {
          push: nextChannels.push,
          email: nextChannels.email,
          sms: user?.notificationPrefs?.sms ?? false,
        },
        ...(channel === "push"
          ? {
              preferences: {
                ...DEFAULT_USER_PREFERENCES,
                ...user?.preferences,
                notifications: value,
              },
            }
          : {}),
      });
    } catch (error) {
      setChannels((current) => ({ ...current, [channel]: previousValue }));
      Alert.alert("Couldn’t save notification settings", error instanceof Error ? error.message : "Please try again.");
    } finally {
      pendingChannels.current.delete(channel);
    }
  };

  return (
    <SettingsPage
      footer="Critical security and account-recovery messages cannot be disabled."
      sections={[
        {
          title: "Delivery channels",
          items: [
            { id: "push", title: "Push notifications", subtitle: "Receive KasaFund alerts on this device", icon: "phone-portrait-outline", type: "toggle", value: channels.push, onToggle: (value) => updateChannel("push", value) },
            { id: "email", title: "Email notifications", subtitle: `Send account alerts to ${user?.email || "your email"}`, icon: "mail-outline", type: "toggle", value: channels.email, onToggle: (value) => updateChannel("email", value) },
          ],
        },
        {
          title: "Activity preferences",
          items: [
            { id: "groups", title: "Group notifications", subtitle: "Contributions, invitations and payouts", icon: "people-outline", type: "navigation", onPress: () => router.push("/profile/group-settings") },
            { id: "fundraising", title: "Fundraising notifications", subtitle: "Campaign updates and donation activity", icon: "heart-outline", type: "navigation", onPress: () => router.push("/profile/fundraising-settings") },
          ],
        },
      ]}
      subtitle="Choose how KasaFund reaches you and which activity should generate alerts."
      title="Notifications"
    />
  );
}
