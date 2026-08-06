import { kasaColors } from "@/constants/design";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React from "react";

type PayoutProviderType = "mobile_money" | "bank";

const MOBILE_PROVIDER_LOGOS: Record<string, number> = {
  MTN: require("../../assets/images/providers/mtn-momo.png"),
  ATL: require("../../assets/images/providers/at-money.webp"),
  VOD: require("../../assets/images/providers/telecel-cash.webp"),
};

type PayoutProviderLogoProps = {
  providerCode?: string;
  size?: number;
  type: PayoutProviderType;
};

export function PayoutProviderLogo({ providerCode, size = 36, type }: PayoutProviderLogoProps) {
  const source = providerCode ? MOBILE_PROVIDER_LOGOS[providerCode.toUpperCase()] : undefined;

  if (type === "mobile_money" && source) {
    return (
      <ExpoImage
        accessible={false}
        contentFit="contain"
        source={source}
        style={{ height: size * 0.72, width: size }}
      />
    );
  }

  return (
    <Ionicons
      color={kasaColors.brand}
      name={type === "bank" ? "business-outline" : "cellular-outline"}
      size={Math.round(size * 0.52)}
    />
  );
}
