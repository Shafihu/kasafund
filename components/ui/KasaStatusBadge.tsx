import { kasaColors, kasaRadii } from "@/constants/design";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

interface KasaStatusBadgeProps {
  label: string;
  tone?: StatusTone;
  icon?: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
}

const tones = {
  neutral: { background: kasaColors.surfaceMuted, foreground: kasaColors.textMuted },
  success: { background: kasaColors.successSoft, foreground: kasaColors.success },
  warning: { background: kasaColors.warningSoft, foreground: kasaColors.warning },
  danger: { background: kasaColors.dangerSoft, foreground: kasaColors.danger },
  info: { background: kasaColors.infoSoft, foreground: kasaColors.info },
} as const;

export function KasaStatusBadge({ label, tone = "neutral", icon, compact = false }: KasaStatusBadgeProps) {
  const colors = tones[tone];
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="text"
      style={[styles.badge, compact && styles.compact, { backgroundColor: colors.background }]}
    >
      {icon ? <Ionicons color={colors.foreground} name={icon} size={13} /> : null}
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", alignSelf: "flex-start", borderRadius: kasaRadii.pill, flexDirection: "row", gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  compact: { paddingHorizontal: 7, paddingVertical: 4 },
  label: { fontSize: 11, fontWeight: "700" },
});
