import { KasaButton } from "@/components/ui";
import { kasaColors, kasaRadii, kasaSpacing } from "@/constants/design";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import LottieView from "lottie-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

interface PlayfulSavingsDepositProps {
  visible: boolean;
  amountLabel: string;
  potName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function PlayfulSavingsDeposit({
  visible,
  amountLabel,
  potName,
  onClose,
  onConfirm,
}: PlayfulSavingsDepositProps) {
  const insets = useSafeAreaInsets();
  const position = useRef(new Animated.ValueXY()).current;
  const cashOpacity = useRef(new Animated.Value(1)).current;
  const cashScale = useRef(new Animated.Value(1)).current;
  const pigScale = useRef(new Animated.Value(1)).current;
  const pigLift = useRef(new Animated.Value(0)).current;
  const pigGlow = useRef(new Animated.Value(0)).current;
  const pigTilt = useRef(new Animated.Value(0)).current;
  const savingTransition = useRef(new Animated.Value(0)).current;
  const successTransition = useRef(new Animated.Value(0)).current;
  const pigHoveredRef = useRef(false);
  const playTransition = useRef(new Animated.Value(1)).current;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isPigHovered, setIsPigHovered] = useState(false);
  const [playgroundHeight, setPlaygroundHeight] = useState(0);
  const dropOffsetY = Math.max(playgroundHeight - 265, 75);

  const resetCash = useCallback(() => {
    cashOpacity.setValue(1);
    cashScale.setValue(1);
    playTransition.setValue(1);
    pigGlow.setValue(0);
    pigHoveredRef.current = false;
    pigLift.setValue(0);
    pigScale.setValue(1);
    pigTilt.setValue(0);
    position.setValue({ x: 0, y: 0 });
    savingTransition.setValue(0);
    successTransition.setValue(0);
    setSaved(false);
    setIsPigHovered(false);
  }, [cashOpacity, cashScale, pigGlow, pigLift, pigScale, pigTilt, playTransition, position, savingTransition, successTransition]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (visible) {
      setSaving(false);
      resetCash();
    }
  }, [resetCash, visible]);

  const returnCash = useCallback(() => {
    Animated.parallel([
      Animated.spring(position.x, {
        damping: 16,
        stiffness: 190,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(position.y, {
        damping: 16,
        stiffness: 190,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [position]);

  const completeSaving = useCallback(async () => {
    if (saving) return;
    playTransition.setValue(1);
    savingTransition.setValue(0);
    setSaving(true);
    let entranceFinished: Promise<void> = Promise.resolve();
    if (reduceMotion) {
      playTransition.setValue(0);
      savingTransition.setValue(1);
    } else {
      entranceFinished = new Promise((resolve) => {
        Animated.parallel([
          Animated.timing(playTransition, {
            duration: 300,
            easing: Easing.inOut(Easing.quad),
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(190),
            Animated.timing(savingTransition, {
              duration: 560,
              easing: Easing.out(Easing.cubic),
              toValue: 1,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => resolve());
      });
    }
    try {
      await Promise.all([onConfirm(), entranceFinished]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setSaved(true);
      if (reduceMotion) {
        savingTransition.setValue(0);
        successTransition.setValue(1);
      } else {
        Animated.sequence([
          Animated.delay(420),
          Animated.parallel([
            Animated.timing(savingTransition, {
              duration: 220,
              easing: Easing.inOut(Easing.quad),
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(90),
              Animated.spring(successTransition, {
                damping: 13,
                stiffness: 150,
                toValue: 1,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]).start();
      }
    } catch {
      playTransition.stopAnimation();
      savingTransition.stopAnimation();
      if (reduceMotion) {
        setSaving(false);
        resetCash();
      } else {
        Animated.parallel([
          Animated.timing(savingTransition, {
            duration: 180,
            easing: Easing.in(Easing.quad),
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(90),
            Animated.timing(playTransition, {
              duration: 300,
              easing: Easing.out(Easing.cubic),
              toValue: 1,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          setSaving(false);
          resetCash();
        });
      }
    }
  }, [onConfirm, playTransition, reduceMotion, resetCash, saving, savingTransition, successTransition]);

  const dropCash = useCallback(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(position.x, {
          duration: reduceMotion ? 0 : 260,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(position.y, {
          duration: reduceMotion ? 0 : 260,
          easing: Easing.in(Easing.quad),
          toValue: dropOffsetY,
          useNativeDriver: true,
        }),
        Animated.timing(cashScale, {
          duration: reduceMotion ? 0 : 260,
          easing: Easing.in(Easing.quad),
          toValue: 0.62,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(cashOpacity, {
        duration: reduceMotion ? 0 : 140,
        easing: Easing.out(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.delay(reduceMotion ? 0 : 140),
    ]).start(({ finished }) => {
      if (finished) void completeSaving();
    });
  }, [cashOpacity, cashScale, completeSaving, dropOffsetY, position, reduceMotion]);

  const isCashOverPig = useCallback((dx: number, dy: number) => {
    const cashCenterY = 71 + dy;
    const pigCenterY = playgroundHeight - 136;
    return Math.abs(dx) < 126 && Math.abs(cashCenterY - pigCenterY) < 112;
  }, [playgroundHeight]);

  const setPigHover = useCallback((hovered: boolean) => {
    if (pigHoveredRef.current === hovered) return;
    pigHoveredRef.current = hovered;
    setIsPigHovered(hovered);

    pigGlow.stopAnimation();
    pigLift.stopAnimation();
    pigScale.stopAnimation();
    pigTilt.stopAnimation();

    if (reduceMotion) {
      pigGlow.setValue(hovered ? 1 : 0);
      return;
    }

    Animated.parallel([
      Animated.spring(pigScale, {
        damping: hovered ? 9 : 14,
        stiffness: hovered ? 230 : 190,
        toValue: hovered ? 1.075 : 1,
        useNativeDriver: true,
      }),
      Animated.spring(pigLift, {
        damping: 12,
        stiffness: 210,
        toValue: hovered ? -8 : 0,
        useNativeDriver: true,
      }),
      Animated.timing(pigGlow, {
        duration: hovered ? 150 : 120,
        toValue: hovered ? 1 : 0,
        useNativeDriver: true,
      }),
      hovered
        ? Animated.sequence([
            Animated.timing(pigTilt, { duration: 80, toValue: -1, useNativeDriver: true }),
            Animated.timing(pigTilt, { duration: 110, toValue: 1, useNativeDriver: true }),
            Animated.spring(pigTilt, { damping: 9, stiffness: 210, toValue: 0, useNativeDriver: true }),
          ])
        : Animated.spring(pigTilt, {
            damping: 12,
            stiffness: 190,
            toValue: 0,
            useNativeDriver: true,
          }),
    ]).start();
  }, [pigGlow, pigLift, pigScale, pigTilt, reduceMotion]);

  const pigRotation = pigTilt.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-2deg", "2deg"],
  });
  const loadingScale = savingTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [0.975, 1],
  });
  const loadingTranslateY = savingTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const playScale = playTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });
  const playTranslateY = playTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });
  const successScale = successTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const successTranslateY = successTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => !saving,
      onStartShouldSetPanResponderCapture: () => !saving,
      onMoveShouldSetPanResponder: () => !saving,
      onMoveShouldSetPanResponderCapture: () => !saving,
      onPanResponderGrant: () => {
        position.stopAnimation();
        void Haptics.selectionAsync().catch(() => undefined);
      },
      onPanResponderMove: (_event, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
        setPigHover(isCashOverPig(gesture.dx, gesture.dy));
      },
      onPanResponderRelease: (_event, gesture) => {
        const isOverPig = isCashOverPig(gesture.dx, gesture.dy);
        if (isOverPig) dropCash();
        else {
          setPigHover(false);
          returnCash();
        }
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminate: () => {
        setPigHover(false);
        returnCash();
      },
    }),
    [dropCash, isCashOverPig, position, returnCash, saving, setPigHover],
  );

  return (
    <Modal animationType="slide" onRequestClose={() => !saving && onClose()} presentationStyle="fullScreen" visible={visible}>
      <View style={styles.modalRoot}>
      <Animated.View
        style={[
          styles.playLayer,
          {
            opacity: playTransition,
            transform: [{ translateY: playTranslateY }, { scale: playScale }],
          },
        ]}
      >
      <SafeAreaView
        edges={["left", "right", "bottom"]}
        importantForAccessibility={saving ? "no-hide-descendants" : "auto"}
        style={styles.overlay}
      >
        <View accessibilityViewIsModal style={[styles.sheet, { paddingTop: insets.top + 14 }]}> 
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Close playful savings"
              accessibilityRole="button"
              disabled={saving}
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <Ionicons color={kasaColors.text} name="close" size={20} />
            </Pressable>
          </View>

          <Text style={styles.instruction}>{reduceMotion ? "Use the button below to save" : "Drag the cash into the piggy bank"}</Text>
          {/* <Text style={styles.amount}>{amountLabel}</Text> */}

          <View
            onLayout={(event) => setPlaygroundHeight(event.nativeEvent.layout.height)}
            pointerEvents="box-none"
            style={styles.playground}
          >
            <View pointerEvents="none" style={styles.dropGuide}>
              <Ionicons color={kasaColors.textMuted} name="arrow-down" size={18} />
            </View>
            <Animated.View
              accessible={false}
              pointerEvents={reduceMotion ? "none" : "auto"}
              style={[
                styles.cash,
                {
                  opacity: cashOpacity,
                  transform: [...position.getTranslateTransform(), { scale: cashScale }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <Image
                accessible={false}
                contentFit="contain"
                source={require("../../assets/images/savings/stack-green-money-bills_634677-8707-remove-bg-io.png")}
                style={styles.cashImage}
              />
              <View pointerEvents="none" style={styles.cashAmountBadge}>
                <Text style={styles.cashText}>{amountLabel}</Text>
              </View>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.pigWrap,
                { transform: [{ translateY: pigLift }, { scale: pigScale }, { rotate: pigRotation }] },
              ]}
            >
              <Animated.View pointerEvents="none" style={[styles.pigGlow, { opacity: pigGlow }]} />
              <Image
                accessibilityLabel="Piggy bank savings target"
                contentFit="contain"
                source={require("../../assets/images/savings/piggy-bank.png")}
                style={styles.pigImage}
              />
              <Text style={[styles.pigLabel, isPigHovered && styles.pigLabelActive]}>
                {isPigHovered ? "Release to save" : "Drop here"}
              </Text>
            </Animated.View>
          </View>

          <KasaButton
            disabled={saving}
            label={`Save ${amountLabel} normally`}
            onPress={() => void completeSaving()}
            variant="secondary"
          />
          <Text style={styles.securityText}>Your balance changes only after KasaFund confirms the transfer.</Text>
        </View>
      </SafeAreaView>
      </Animated.View>

      {saving && (
        <Animated.View
          style={[
            styles.loadingLayer,
            {
              opacity: savingTransition,
              transform: [{ translateY: loadingTranslateY }, { scale: loadingScale }],
            },
          ]}
        >
          <SafeAreaView
            accessibilityLabel={`Saving ${amountLabel} to ${potName}`}
            accessibilityLiveRegion="polite"
            accessibilityRole="progressbar"
            style={styles.loadingScreen}
          >
            {reduceMotion ? (
              <View style={styles.reducedMotionIcon}>
                <Ionicons color={kasaColors.brand} name="cash-outline" size={56} />
              </View>
            ) : (
              <LottieView
                autoPlay
                loop
                source={require("../../assets/animations/money-wings.json")}
                style={styles.moneyAnimation}
              />
            )}
            <Text style={styles.loadingTitle}>Your money is on its way</Text>
            <Text style={styles.loadingAmount}>{amountLabel}</Text>
            <Text numberOfLines={2} style={styles.loadingText}>Moving securely to {potName}</Text>
            <View style={styles.loadingStatus}>
              <View style={styles.loadingPulse} />
              <Text style={styles.loadingStatusText}>Confirming with KasaFund</Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      {saved && (
        <Animated.View
          style={[
            styles.successLayer,
            {
              opacity: successTransition,
              transform: [{ translateY: successTranslateY }, { scale: successScale }],
            },
          ]}
        >
          <SafeAreaView
            accessibilityLabel={`${amountLabel} saved successfully to ${potName}`}
            accessibilityLiveRegion="polite"
            accessibilityViewIsModal
            style={styles.successScreen}
          >
            <View style={styles.successCelebration}>
              <View style={[styles.sparkle, styles.sparkleOne]}>
                <Ionicons color={kasaColors.accent} name="sparkles" size={22} />
              </View>
              <View style={[styles.sparkle, styles.sparkleTwo]}>
                <Ionicons color={kasaColors.brand} name="star" size={14} />
              </View>
              <View style={[styles.sparkle, styles.sparkleThree]}>
                <Ionicons color={kasaColors.accent} name="ellipse" size={12} />
              </View>
              <View style={styles.successHaloOuter}>
                <View style={styles.successHaloInner}>
                  <Ionicons color={kasaColors.white} name="checkmark" size={54} />
                </View>
              </View>
            </View>

            <Text style={styles.successEyebrow}>SAVINGS LEVELLED UP</Text>
            <Text style={styles.successTitle}>You did it!</Text>
            <Text style={styles.successAmount}>{amountLabel}</Text>
            <Text numberOfLines={2} style={styles.successText}>
              is now tucked safely into {potName}.
            </Text>

            <View style={styles.successReward}>
              <Ionicons color={kasaColors.warning} name="flame" size={17} />
              <Text style={styles.successRewardText}>Keep the saving streak going</Text>
            </View>

            <View style={styles.successFooter}>
              <KasaButton
                label="Back to my savings pot"
                leftIcon={<Ionicons color={kasaColors.white} name="arrow-back" size={17} />}
                onPress={onClose}
              />
            </View>
          </SafeAreaView>
        </Animated.View>
      )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { backgroundColor: kasaColors.background, flex: 1 },
  playLayer: { flex: 1 },
  overlay: { backgroundColor: kasaColors.background, flex: 1 },
  sheet: { backgroundColor: kasaColors.background, flex: 1, paddingBottom: 12, paddingHorizontal: 20 },
  header: { alignItems: "center", borderBottomColor: kasaColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", marginHorizontal: -20, minHeight: 54, paddingBottom: 12, paddingHorizontal: 20, paddingRight: 76, position: "relative" },
  headerIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: kasaRadii.md, height: 42, justifyContent: "center", marginRight: 11, width: 42 },
  headerCopy: { flex: 1 },
  title: { color: kasaColors.text, fontSize: 19, fontWeight: "800", letterSpacing: -0.35 },
  subtitle: { color: kasaColors.textMuted, fontSize: 11, marginTop: 2 },
  closeButton: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: kasaRadii.md, borderWidth: 1, height: 40, justifyContent: "center", position: "absolute", right: 20, top: 1, width: 40 },
  closeButtonPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  instruction: { color: kasaColors.textMuted, fontSize: 13, marginTop: 24, textAlign: "center" },
  amount: { color: kasaColors.text, fontSize: 20, fontWeight: "800", marginTop: 4, textAlign: "center" },
  playground: { flex: 1, marginHorizontal: -20, marginVertical: 12, minHeight: 340, overflow: "visible", position: "relative", zIndex: 3 },
  dropGuide: { alignItems: "center", left: 0, position: "absolute", right: 0, top: "42%" },
  cash: { alignItems: "center", alignSelf: "center", height: 132, justifyContent: "center", position: "absolute", top: 5, width: 180, zIndex: 2 },
  cashImage: { height: 132, width: 180 },
  cashAmountBadge: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: kasaRadii.pill, borderWidth: 1, bottom: 0, paddingHorizontal: 10, paddingVertical: 5, position: "absolute" },
  cashText: { color: kasaColors.brandStrong, fontSize: 11, fontWeight: "800" },
  pigWrap: { alignItems: "center", bottom: 22, left: 0, position: "absolute", right: 0 },
  pigGlow: { backgroundColor: "rgba(232,184,75,.24)", borderRadius: 90, height: 148, position: "absolute", top: 22, width: 186 },
  pigImage: { height: 184, width: 184 },
  pigLabel: { color: kasaColors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 7 },
  pigLabelActive: { color: kasaColors.brand, fontWeight: "800" },
  securityText: { color: kasaColors.textMuted, fontSize: 10, lineHeight: 15, marginTop: kasaSpacing.sm, textAlign: "center" },
  loadingLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: kasaColors.background, zIndex: 10 },
  loadingScreen: { alignItems: "center", backgroundColor: kasaColors.background, flex: 1, justifyContent: "center", paddingHorizontal: 30 },
  moneyAnimation: { height: 220, width: 220 },
  reducedMotionIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 56, height: 112, justifyContent: "center", marginBottom: 38, width: 112 },
  loadingTitle: { color: kasaColors.text, fontSize: 23, fontWeight: "800", letterSpacing: -0.5, marginTop: -8, textAlign: "center" },
  loadingAmount: { color: kasaColors.brand, fontSize: 19, fontWeight: "800", marginTop: 7 },
  loadingText: { color: kasaColors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 280, textAlign: "center" },
  loadingStatus: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: kasaRadii.pill, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 24, paddingHorizontal: 13, paddingVertical: 9 },
  loadingPulse: { backgroundColor: kasaColors.accent, borderRadius: 4, height: 7, width: 7 },
  loadingStatusText: { color: kasaColors.textMuted, fontSize: 11, fontWeight: "700" },
  successLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: kasaColors.background, zIndex: 20 },
  successScreen: { alignItems: "center", backgroundColor: kasaColors.background, flex: 1, paddingHorizontal: 24, paddingTop: 54 },
  successCelebration: { alignItems: "center", height: 210, justifyContent: "center", position: "relative", width: 250 },
  successHaloOuter: { alignItems: "center", backgroundColor: kasaColors.successSoft, borderRadius: 76, height: 152, justifyContent: "center", width: 152 },
  successHaloInner: { alignItems: "center", backgroundColor: kasaColors.success, borderColor: kasaColors.surface, borderRadius: 52, borderWidth: 7, height: 104, justifyContent: "center", shadowColor: kasaColors.brandStrong, shadowOffset: { height: 12, width: 0 }, shadowOpacity: 0.18, shadowRadius: 18, width: 104, elevation: 8 },
  sparkle: { alignItems: "center", justifyContent: "center", position: "absolute" },
  sparkleOne: { right: 18, top: 26, transform: [{ rotate: "12deg" }] },
  sparkleTwo: { left: 23, top: 65, transform: [{ rotate: "-14deg" }] },
  sparkleThree: { bottom: 29, right: 36 },
  successEyebrow: { color: kasaColors.brand, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginTop: 8 },
  successTitle: { color: kasaColors.text, fontSize: 31, fontWeight: "900", letterSpacing: -1, marginTop: 8 },
  successAmount: { color: kasaColors.brand, fontSize: 24, fontWeight: "900", letterSpacing: -0.5, marginTop: 16 },
  successText: { color: kasaColors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 5, maxWidth: 300, textAlign: "center" },
  successReward: { alignItems: "center", backgroundColor: kasaColors.warningSoft, borderRadius: kasaRadii.pill, flexDirection: "row", gap: 7, marginTop: 24, paddingHorizontal: 14, paddingVertical: 10 },
  successRewardText: { color: kasaColors.warning, fontSize: 11, fontWeight: "800" },
  successFooter: { bottom: 12, left: 24, position: "absolute", right: 24 },
});
