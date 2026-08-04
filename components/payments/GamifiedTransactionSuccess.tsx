import { KasaButton } from "@/components/ui";
import { kasaColors, kasaRadii } from "@/constants/design";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface GamifiedTransactionSuccessProps {
  visible: boolean;
  amountLabel: string;
  eyebrow: string;
  title: string;
  message: string;
  rewardText: string;
  contextIcon: keyof typeof Ionicons.glyphMap;
  doneLabel: string;
  onDone: () => void;
}

export function GamifiedTransactionSuccess({
  visible,
  amountLabel,
  eyebrow,
  title,
  message,
  rewardText,
  contextIcon,
  doneLabel,
  onDone,
}: GamifiedTransactionSuccessProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!visible) {
      entrance.setValue(0);
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }

    Animated.spring(entrance, {
      damping: 13,
      stiffness: 150,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entrance, reduceMotion, visible]);

  const scale = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDone}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView
        accessibilityLabel={`${amountLabel}. ${message}`}
        accessibilityLiveRegion="polite"
        accessibilityViewIsModal
        style={styles.screen}
      >
        <Animated.View
          style={[
            styles.content,
            { opacity: entrance, transform: [{ translateY }, { scale }] },
          ]}
        >
          <View style={styles.celebration}>
            <View style={[styles.sparkle, styles.sparkleOne]}>
              <Ionicons color={kasaColors.accent} name="sparkles" size={22} />
            </View>
            <View style={[styles.sparkle, styles.sparkleTwo]}>
              <Ionicons color={kasaColors.brand} name="star" size={14} />
            </View>
            <View style={[styles.sparkle, styles.sparkleThree]}>
              <Ionicons color={kasaColors.accent} name="ellipse" size={12} />
            </View>
            <View style={styles.haloOuter}>
              <View style={styles.haloInner}>
                <Ionicons color={kasaColors.white} name="checkmark" size={54} />
              </View>
              <View style={styles.contextBadge}>
                <Ionicons color={kasaColors.brand} name={contextIcon} size={18} />
              </View>
            </View>
          </View>

          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.amount}>{amountLabel}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.reward}>
            <Ionicons color={kasaColors.warning} name="flame" size={17} />
            <Text style={styles.rewardText}>{rewardText}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: entrance }]}> 
          <KasaButton
            label={doneLabel}
            leftIcon={<Ionicons color={kasaColors.white} name="checkmark-circle" size={18} />}
            onPress={onDone}
          />
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: kasaColors.background, flex: 1, paddingHorizontal: 24 },
  content: { alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: 82 },
  celebration: { alignItems: "center", height: 210, justifyContent: "center", position: "relative", width: 250 },
  haloOuter: { alignItems: "center", backgroundColor: kasaColors.successSoft, borderRadius: 76, height: 152, justifyContent: "center", width: 152 },
  haloInner: { alignItems: "center", backgroundColor: kasaColors.success, borderColor: kasaColors.surface, borderRadius: 52, borderWidth: 7, elevation: 8, height: 104, justifyContent: "center", shadowColor: kasaColors.brandStrong, shadowOffset: { height: 12, width: 0 }, shadowOpacity: 0.18, shadowRadius: 18, width: 104 },
  contextBadge: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 19, borderWidth: 1, bottom: 15, elevation: 3, height: 38, justifyContent: "center", position: "absolute", right: 15, shadowColor: kasaColors.brandStrong, shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.12, shadowRadius: 8, width: 38 },
  sparkle: { alignItems: "center", justifyContent: "center", position: "absolute" },
  sparkleOne: { right: 18, top: 26, transform: [{ rotate: "12deg" }] },
  sparkleTwo: { left: 23, top: 65, transform: [{ rotate: "-14deg" }] },
  sparkleThree: { bottom: 29, right: 36 },
  eyebrow: { color: kasaColors.brand, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginTop: 8, textAlign: "center" },
  title: { color: kasaColors.text, fontSize: 31, fontWeight: "900", letterSpacing: -1, marginTop: 8, textAlign: "center" },
  amount: { color: kasaColors.brand, fontSize: 24, fontWeight: "900", letterSpacing: -0.5, marginTop: 16 },
  message: { color: kasaColors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 5, maxWidth: 310, textAlign: "center" },
  reward: { alignItems: "center", backgroundColor: kasaColors.warningSoft, borderRadius: kasaRadii.pill, flexDirection: "row", gap: 7, marginTop: 24, paddingHorizontal: 14, paddingVertical: 10 },
  rewardText: { color: kasaColors.warning, fontSize: 11, fontWeight: "800" },
  footer: { bottom: 12, left: 24, position: "absolute", right: 24 },
});
