import { kasaColors, kasaSpacing, kasaType } from "@/constants/design";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { AnimatedLoader } from "./AnimatedLoader";
import { KasaButton } from "./KasaButton";

type StateKind = "empty" | "error" | "loading";

interface KasaStateViewProps {
  kind: StateKind;
  title?: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function KasaStateView({ kind, title, message, icon, actionLabel, onAction, style }: KasaStateViewProps) {
  if (kind === "loading") {
    return (
      <View accessibilityLabel={title || "Loading"} accessibilityRole="progressbar" style={[styles.container, style]}>
        <AnimatedLoader size="compact" />
      </View>
    );
  }

  const isError = kind === "error";
  const foreground = isError ? kasaColors.danger : kasaColors.brand;
  const background = isError ? kasaColors.dangerSoft : kasaColors.brandSoft;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.icon, { backgroundColor: background }]}>
        <Ionicons color={foreground} name={icon || (isError ? "alert-circle-outline" : "file-tray-outline")} size={24} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <KasaButton fullWidth={false} label={actionLabel} onPress={onAction} size="compact" variant={isError ? "secondary" : "primary"} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingHorizontal: kasaSpacing.xxl, paddingVertical: 30 },
  icon: { alignItems: "center", borderRadius: 16, height: 52, justifyContent: "center", marginBottom: 13, width: 52 },
  title: { color: kasaColors.text, textAlign: "center", ...kasaType.cardTitle },
  message: { color: kasaColors.textMuted, marginBottom: 16, marginTop: 5, maxWidth: 300, textAlign: "center", ...kasaType.caption },
});
