import { kasaColors, kasaRadii, kasaSpacing } from "@/constants/design";
import React, { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

type CardVariant = "plain" | "outlined" | "soft" | "elevated";

interface KasaCardProps extends PropsWithChildren {
  variant?: CardVariant;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function KasaCard({ children, variant = "outlined", padded = true, style }: KasaCardProps) {
  return (
    <View style={[styles.base, styles[variant], padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: kasaRadii.lg },
  padded: { padding: kasaSpacing.lg },
  plain: { backgroundColor: kasaColors.surface },
  outlined: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderWidth: 1 },
  soft: { backgroundColor: kasaColors.surfaceMuted },
  elevated: {
    backgroundColor: kasaColors.surface,
    shadowColor: kasaColors.brandStrong,
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
});
