import type { KasaPointTier } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const TIER_STYLE: Record<KasaPointTier, {
  colors: readonly [string, string, ...string[]];
  foreground: string;
  label: string;
  shadow: string;
}> = {
  starter: {
    colors: ["#B8C2BE", "#E7ECEA", "#87958F"],
    foreground: "#53615C",
    label: "Starter",
    shadow: "#53615C",
  },
  bronze: {
    colors: ["#75401F", "#D99A61", "#9A552D", "#F0C08C"],
    foreground: "#6F3518",
    label: "Bronze",
    shadow: "#8C4D27",
  },
  silver: {
    colors: ["#7D8792", "#F1F4F6", "#AAB3BC", "#FFFFFF"],
    foreground: "#5D6874",
    label: "Silver",
    shadow: "#75808A",
  },
  gold: {
    colors: ["#9D6900", "#FFD86B", "#C88A08", "#FFF0A8"],
    foreground: "#805600",
    label: "Gold",
    shadow: "#B9850D",
  },
  platinum: {
    colors: ["#176C73", "#BDEFF0", "#3EA4A8", "#E4FFFF"],
    foreground: "#0D5B61",
    label: "Platinum",
    shadow: "#176C73",
  },
};

export function KasaPointAvatar({
  accessibilityLabel,
  imageUrl,
  initials,
  showTierBadge = true,
  size = 72,
  tier = "starter",
}: {
  accessibilityLabel?: string;
  imageUrl?: string;
  initials: string;
  showTierBadge?: boolean;
  size?: number;
  tier?: KasaPointTier;
}) {
  const config = TIER_STYLE[tier];
  const ringWidth = Math.max(3, Math.round(size * 0.055));
  const innerSize = size - ringWidth * 2;
  const badgeSize = Math.max(20, Math.round(size * 0.27));

  return (
    <View
      accessibilityLabel={accessibilityLabel || `${config.label} KasaPoints profile`}
      style={[
        styles.frame,
        {
          borderRadius: size / 2,
          height: size,
          shadowColor: config.shadow,
          width: size,
        },
      ]}
    >
      <LinearGradient
        colors={[...config.colors]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.ring,
          {
            borderRadius: size / 2,
            height: size,
            padding: ringWidth,
            width: size,
          },
        ]}
      >
        {imageUrl ? (
          <ExpoImage
            accessibilityLabel={accessibilityLabel}
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: imageUrl }}
            style={{ borderRadius: innerSize / 2, height: innerSize, width: innerSize }}
          />
        ) : (
          <View
            style={[
              styles.fallback,
              {
                borderRadius: innerSize / 2,
                height: innerSize,
                width: innerSize,
              },
            ]}
          >
            <Text style={[styles.initials, { fontSize: Math.max(16, size * 0.29) }]}>
              {initials}
            </Text>
          </View>
        )}
      </LinearGradient>

      {showTierBadge ? (
        <View
          accessibilityLabel={`${config.label} KasaPoints tier`}
          style={[
            styles.badge,
            {
              borderRadius: badgeSize / 2,
              height: badgeSize,
              right: -Math.round(size * 0.025),
              width: badgeSize,
            },
          ]}
        >
          <Ionicons
            color={config.foreground}
            name={tier === "starter" ? "sparkles" : "diamond"}
            size={Math.max(11, Math.round(badgeSize * 0.54))}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(255,255,255,0.92)",
    borderWidth: 2,
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    shadowColor: "#071F18",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
  },
  fallback: {
    alignItems: "center",
    backgroundColor: "#0B4D3E",
    justifyContent: "center",
  },
  frame: {
    elevation: 5,
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  initials: {
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  ring: {
    alignItems: "center",
    justifyContent: "center",
  },
});
