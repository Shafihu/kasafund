import { KasaFundMark } from "@/components/branding/KasaFundMark";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

type AnimatedAppSplashProps = {
  appIsReady: boolean;
  onFinish: () => void;
  onLayoutReady: () => void;
};

const MINIMUM_DISPLAY_TIME = 900;

export function AnimatedAppSplash({
  appIsReady,
  onFinish,
  onLayoutReady,
}: AnimatedAppSplashProps) {
  const [introFinished, setIntroFinished] = useState(false);
  const hasStartedExit = useRef(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const copyTranslateY = useRef(new Animated.Value(14)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.78)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;
  const progressScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.spring(logoScale, {
        damping: 12,
        mass: 0.8,
        stiffness: 125,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        duration: 380,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacity, {
        duration: 500,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(ringScale, {
        damping: 15,
        stiffness: 90,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(170),
        Animated.parallel([
          Animated.timing(copyOpacity, {
            duration: 420,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(copyTranslateY, {
            duration: 420,
            easing: Easing.out(Easing.cubic),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.timing(progressScale, {
        duration: MINIMUM_DISPLAY_TIME,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    const rotation = Animated.loop(
      Animated.timing(ringRotation, {
        duration: 6000,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      })
    );

    intro.start();
    rotation.start();
    const timer = setTimeout(() => setIntroFinished(true), MINIMUM_DISPLAY_TIME);

    return () => {
      clearTimeout(timer);
      intro.stop();
      rotation.stop();
    };
  }, [
    copyOpacity,
    copyTranslateY,
    logoOpacity,
    logoScale,
    progressScale,
    ringOpacity,
    ringRotation,
    ringScale,
  ]);

  useEffect(() => {
    if (!appIsReady || !introFinished || hasStartedExit.current) return;
    hasStartedExit.current = true;

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        duration: 320,
        easing: Easing.inOut(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        duration: 320,
        easing: Easing.in(Easing.cubic),
        toValue: 1.06,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [appIsReady, introFinished, logoScale, onFinish, overlayOpacity]);

  const rotate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      accessibilityLabel="KasaFund is starting"
      accessibilityRole="progressbar"
      onLayout={onLayoutReady}
      style={[styles.container, { opacity: overlayOpacity }]}
    >
      <Animated.View
        style={[
          styles.ringLarge,
          {
            opacity: ringOpacity,
            transform: [{ rotate }, { scale: ringScale }],
          },
        ]}
      >
        <View style={styles.ringAccent} />
      </Animated.View>
      <Animated.View
        style={[
          styles.ringSmall,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      />

      <View style={styles.content}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <KasaFundMark style={styles.markSpacing} />
        </Animated.View>

        <Animated.View
          style={{
            opacity: copyOpacity,
            transform: [{ translateY: copyTranslateY }],
          }}
        >
          <Text style={styles.wordmark}>KasaFund</Text>
          <Text style={styles.tagline}>Save together. Grow together.</Text>
        </Animated.View>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { transform: [{ scaleX: progressScale }] }]}
          />
        </View>
      </View>

      <Text style={styles.footer}>SECURE COMMUNITY FINANCE</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#0B4D3E",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 999,
  },
  content: {
    alignItems: "center",
    zIndex: 2,
  },
  footer: {
    bottom: 48,
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.8,
    position: "absolute",
  },
  markSpacing: {
    marginBottom: 23,
  },
  progressFill: {
    backgroundColor: "#E8B84B",
    borderRadius: 2,
    height: "100%",
    transformOrigin: "left",
    width: "100%",
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 2,
    height: 3,
    marginTop: 28,
    overflow: "hidden",
    width: 104,
  },
  ringAccent: {
    backgroundColor: "#E8B84B",
    borderRadius: 4,
    height: 8,
    position: "absolute",
    right: 12,
    top: 38,
    width: 8,
  },
  ringLarge: {
    borderColor: "rgba(255,255,255,0.075)",
    borderRadius: 230,
    borderWidth: 1,
    height: 460,
    position: "absolute",
    width: 460,
  },
  ringSmall: {
    borderColor: "rgba(232,184,75,0.12)",
    borderRadius: 145,
    borderWidth: 1,
    height: 290,
    position: "absolute",
    width: 290,
  },
  tagline: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    letterSpacing: 0.25,
    marginTop: 7,
    textAlign: "center",
  },
  wordmark: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    textAlign: "center",
  },
});
