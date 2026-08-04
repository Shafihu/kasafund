import LottieView from "lottie-react-native";
import React from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

type LoaderSize = "compact" | "regular";

type AnimatedLoaderProps = {
  accessibilityLabel?: string;
  size?: LoaderSize;
  style?: StyleProp<ViewStyle>;
};

const SIZES: Record<LoaderSize, number> = {
  compact: 44,
  regular: 76,
};

export function AnimatedLoader({
  accessibilityLabel = "Loading",
  size = "regular",
  style,
}: AnimatedLoaderProps) {
  const dimension = SIZES[size];

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[styles.container, style]}
    >
      <View
        style={[
          styles.animationFrame,
          {
            borderRadius: dimension / 2,
            height: dimension,
            width: dimension,
          },
        ]}
      >
        <LottieView
          autoPlay
          loop
          source={require("../../assets/animations/kasafund-loader.json")}
          style={{ height: dimension, width: dimension }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  animationFrame: {
    backgroundColor: "#F6F8F7",
    borderColor: "#E2E8E5",
    borderWidth: 1,
    overflow: "hidden",
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
