import { kasaColors, kasaLayout, kasaType } from "@/constants/design";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface KasaSectionHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  inset?: boolean;
}

export function KasaSectionHeader({
  title,
  description,
  actionLabel,
  onAction,
  inset = false,
}: KasaSectionHeaderProps) {
  return (
    <View style={[styles.row, inset && styles.inset]}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  inset: { paddingHorizontal: kasaLayout.screenInset },
  copy: { flex: 1, paddingRight: 12 },
  title: { color: kasaColors.text, ...kasaType.sectionTitle },
  description: { color: kasaColors.textMuted, marginTop: 4, ...kasaType.caption },
  action: { alignItems: "center", justifyContent: "center", minHeight: kasaLayout.minimumTouchTarget, marginTop: -10 },
  actionText: { color: kasaColors.brand, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.58 },
});
