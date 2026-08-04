import { SettingsPage, type SettingsPageItem } from "@/components/settings/SettingsPage";
import { DEFAULT_USER_PREFERENCES } from "@/constants/userPreferences";
import type { UserPreferences } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import type { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

type BooleanPreferenceKey = {
  [Key in keyof UserPreferences]: UserPreferences[Key] extends boolean ? Key : never;
}[keyof UserPreferences];

export interface PreferenceItem {
  key: BooleanPreferenceKey;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export function PreferenceSettingsScreen({
  title,
  subtitle,
  sectionTitle,
  items,
  infoItems = [],
  footer,
}: {
  title: string;
  subtitle: string;
  sectionTitle: string;
  items: PreferenceItem[];
  infoItems?: SettingsPageItem[];
  footer?: string;
}) {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const preferences = { ...DEFAULT_USER_PREFERENCES, ...user?.preferences };
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const pendingPreferences = useRef(new Map<BooleanPreferenceKey, boolean>());

  useEffect(() => {
    setLocalPreferences({
      ...DEFAULT_USER_PREFERENCES,
      ...user?.preferences,
      ...Object.fromEntries(pendingPreferences.current),
    });
  }, [user?.preferences]);

  const updatePreference = async (key: BooleanPreferenceKey, value: boolean) => {
    if (pendingPreferences.current.has(key)) return;
    const previousValue = localPreferences[key];
    const nextPreferences = { ...localPreferences, [key]: value };
    pendingPreferences.current.set(key, value);
    setLocalPreferences(nextPreferences);
    try {
      await updateProfile({ preferences: nextPreferences });
    } catch (error) {
      setLocalPreferences((current) => ({ ...current, [key]: previousValue }));
      Alert.alert(
        "Couldn’t save preference",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      pendingPreferences.current.delete(key);
    }
  };

  return (
    <SettingsPage
      footer={footer}
      sections={[
        {
          title: sectionTitle,
          items: items.map((item) => ({
            id: item.key,
            title: item.title,
            subtitle: item.subtitle,
            icon: item.icon,
            type: "toggle",
            value: localPreferences[item.key],
            onToggle: (value) => updatePreference(item.key, value),
          })),
        },
        ...(infoItems.length ? [{ title: "Information", items: infoItems }] : []),
      ]}
      subtitle={subtitle}
      title={title}
    />
  );
}
