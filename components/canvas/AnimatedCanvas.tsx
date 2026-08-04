import { DYNAMIC_ISLAND_HEIGHT, DYNAMIC_ISLAND_WIDTH } from "@/constants";
import { AnimationValues } from "@/types";
import {
    Blur,
    Canvas,
    Circle,
    ColorMatrix,
    Group,
    Image,
    Paint,
    RoundedRect,
    SkImage,
} from "@shopify/react-native-skia";
import React from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { animatedCanvasStyles as styles } from "./AnimatedCanvas.styles";

interface AnimatedCanvasProps {
  animationValues: AnimationValues;
  canvasStyle: any;
  avatarImageSource: SkImage | null;
  avatarInitials: string;
  screenWidth: number;
}

export const AnimatedCanvas: React.FC<AnimatedCanvasProps> = ({
  animationValues,
  canvasStyle,
  avatarImageSource,
  avatarInitials,
  screenWidth,
}) => {
  const {
    avatarWidth,
    avatarPositionX,
    avatarPositionY,
    blurRadius,
    overlayTint,
    avatarBounds,
    avatarCenter,
    colorTransform,
  } = animationValues;

  const initialsAvatarStyle = useAnimatedStyle(() => ({
    left: avatarPositionX.value,
    top: avatarPositionY.value,
    width: avatarWidth.value,
    height: avatarWidth.value,
    borderRadius: avatarWidth.value / 2,
    opacity: avatarWidth.value > 1 ? 1 : 0,
  }));

  const initialsTextStyle = useAnimatedStyle(() => ({
    fontSize: avatarWidth.value * 0.3,
  }));

  return (
    <Animated.View style={canvasStyle}>
      <Canvas style={styles.canvas}>
        <Group
          layer={
            <Paint>
              <Blur blur={blurRadius} />
              <ColorMatrix matrix={colorTransform} />
            </Paint>
          }
        >
          <Group clip={avatarBounds}>
            <Image
              image={avatarImageSource}
              height={avatarWidth}
              width={avatarWidth}
              fit="cover"
              x={avatarPositionX}
              y={avatarPositionY}
            />
            <Circle r={avatarWidth} c={avatarCenter} color={overlayTint} />
          </Group>
          <RoundedRect
            r={28}
            width={DYNAMIC_ISLAND_WIDTH}
            height={DYNAMIC_ISLAND_HEIGHT}
            x={(screenWidth - DYNAMIC_ISLAND_WIDTH) / 2}
            y={18}
          />
        </Group>
      </Canvas>
      {!avatarImageSource && (
        <Animated.View
          pointerEvents="none"
          style={[styles.initialsAvatar, initialsAvatarStyle]}
        >
          <Animated.Text style={[styles.initialsText, initialsTextStyle]}>
            {avatarInitials}
          </Animated.Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};
