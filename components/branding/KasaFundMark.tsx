import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type KasaFundMarkProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function KasaFundMark({ size = 82, style }: KasaFundMarkProps) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      style={style}
      viewBox="0 0 1024 1024"
      width={size}
    >
      <Rect fill="#0B4D3E" height="1024" rx="220" width="1024" />
      <Circle cx="330" cy="270" fill="#FFF9ED" r="78" />
      <Circle cx="694" cy="270" fill="#FFF9ED" r="78" />
      <Path
        d="M445 354C337 398 274 493 274 616C274 748 346 843 455 873"
        fill="none"
        stroke="#FFF9ED"
        strokeLinecap="round"
        strokeWidth="112"
      />
      <Path
        d="M579 354C687 398 750 493 750 616C750 748 678 843 569 873"
        fill="none"
        stroke="#FFF9ED"
        strokeLinecap="round"
        strokeWidth="112"
      />
      <Circle cx="512" cy="610" fill="#E8B84B" r="126" />
    </Svg>
  );
}
