import { kasaColors, kasaLayout, kasaRadii } from "@/constants/design";
import React, { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "regular" | "compact";

interface KasaButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

const variantStyles: Record<ButtonVariant, { button: ViewStyle; label: TextStyle }> = {
  primary: { button: { backgroundColor: kasaColors.brand }, label: { color: kasaColors.white } },
  secondary: {
    button: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderWidth: 1 },
    label: { color: kasaColors.brand },
  },
  ghost: { button: { backgroundColor: "transparent" }, label: { color: kasaColors.brand } },
  danger: { button: { backgroundColor: kasaColors.danger }, label: { color: kasaColors.white } },
};

export function KasaButton({
  label,
  variant = "primary",
  size = "regular",
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  disabled,
  style,
  labelStyle,
  accessibilityLabel,
  ...props
}: KasaButtonProps) {
  const unavailable = disabled || loading;
  const colors = variantStyles[variant];

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      style={({ pressed }) => [
        styles.base,
        size === "compact" ? styles.compact : styles.regular,
        colors.button,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        unavailable && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors.label.color} size="small" />
      ) : (
        <>
          {leftIcon}
          <Text numberOfLines={1} style={[styles.label, colors.label, labelStyle]}>{label}</Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: kasaRadii.md,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: kasaLayout.minimumTouchTarget,
    paddingHorizontal: 16,
  },
  compact: { height: 44 },
  regular: { height: 52 },
  fullWidth: { alignSelf: "stretch" },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.48 },
  label: { fontSize: 14, fontWeight: "800" },
});
