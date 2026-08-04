import type { SharedValue } from "react-native-reanimated";

export interface AnimationValues {
  avatarWidth: SharedValue<number>;
  avatarPositionX: SharedValue<number>;
  avatarPositionY: SharedValue<number>;
  currentScrollY: SharedValue<number>;
  blurRadius: SharedValue<number>;
  overlayTint: SharedValue<string>;
  avatarBounds: SharedValue<any>;
  avatarCenter: SharedValue<{ x: number; y: number }>;
  colorTransform: SharedValue<number[]>;
  headerOpacity: SharedValue<number>;
}
