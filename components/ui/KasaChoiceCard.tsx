import { kasaColors, kasaRadii, kasaSpacing } from "@/constants/design";
import React, { PropsWithChildren } from "react";
import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";

interface KasaChoiceCardProps extends PropsWithChildren {
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function KasaChoiceCard({ children, selected, onPress, accessibilityLabel, style }: KasaChoiceCardProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: kasaColors.surface,
    borderColor: kasaColors.border,
    borderRadius: kasaRadii.md,
    borderWidth: 1,
    padding: kasaSpacing.lg,
  },
  selected: { backgroundColor: kasaColors.brandSoft, borderColor: kasaColors.brand },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
});
