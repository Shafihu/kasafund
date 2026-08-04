import type { AchievementBadge as AchievementBadgeData } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  primary: "#0B4D3E",
  surface: "#FFFFFF",
  text: "#12211C",
  muted: "#697873",
  border: "#DFE7E3",
};

const BADGE_VISUALS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; soft: string }> = {
  verified_member: { icon: "checkmark-circle", color: "#1687D9", soft: "#E5F4FF" },
  first_contribution: { icon: "footsteps-outline", color: "#7A5AF8", soft: "#F0ECFF" },
  consistent_contributor: { icon: "repeat-outline", color: "#0B8F78", soft: "#DFF6F0" },
  contribution_champion: { icon: "trophy-outline", color: "#C98708", soft: "#FFF2D0" },
  on_time_star: { icon: "time-outline", color: "#E0643B", soft: "#FFF0EA" },
  reliability_pro: { icon: "shield-checkmark-outline", color: "#2962C8", soft: "#E7EFFF" },
  first_payout: { icon: "cash-outline", color: "#159447", soft: "#E2F6E9" },
  payout_veteran: { icon: "ribbon-outline", color: "#B04BBC", soft: "#F7E8FA" },
  long_term_member: { icon: "calendar-outline", color: "#D54F68", soft: "#FFE9EE" },
};

function visualFor(id: string) {
  return BADGE_VISUALS[id] || { icon: "ribbon-outline" as const, color: COLORS.primary, soft: "#E5F2ED" };
}

export function AnimatedAchievementBadge({
  badge,
  index,
  onPress,
}: {
  badge: AchievementBadgeData;
  index: number;
  onPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.72)).current;
  const visual = visualFor(badge.id);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active || reduceMotion) {
        opacity.setValue(1);
        scale.setValue(1);
        return;
      }
      Animated.parallel([
        Animated.timing(opacity, {
          delay: index * 65,
          duration: 260,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          delay: index * 65,
          damping: 11,
          mass: 0.8,
          stiffness: 170,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => {
      active = false;
    };
  }, [index, opacity, scale]);

  return (
    <Animated.View style={[styles.badgeTile, { opacity, transform: [{ scale }] }]}>
      <TouchableOpacity activeOpacity={0.72} onPress={onPress} style={styles.badgePressable}>
        <View style={[styles.badgeGlow, { backgroundColor: visual.soft }]}>
          <Ionicons name={visual.icon} size={23} color={visual.color} />
          <View style={[styles.badgeSpark, { backgroundColor: visual.color }]} />
        </View>
        <Text numberOfLines={2} style={styles.badgeName}>{badge.title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function AchievementBadgeModal({
  badge,
  onClose,
}: {
  badge: AchievementBadgeData | null;
  onClose: () => void;
}) {
  if (!badge) return null;
  const visual = visualFor(badge.id);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <Pressable onPress={onClose} style={styles.overlay}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalCard}>
          <TouchableOpacity accessibilityLabel="Close badge" hitSlop={8} onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.celebrationFrame}>
            <LottieView
              autoPlay
              loop={false}
              source={require("../../assets/animations/achievement-reward.json")}
              style={styles.celebration}
            />
            <View style={[styles.modalBadgeIcon, { backgroundColor: visual.soft }]}>
              <Ionicons name={visual.icon} size={29} color={visual.color} />
            </View>
          </View>
          <Text style={styles.unlocked}>ACHIEVEMENT UNLOCKED</Text>
          <Text style={styles.modalTitle}>{badge.title}</Text>
          <Text style={styles.modalDescription}>{badge.description}</Text>
          <View style={styles.pointsPill}>
            <Ionicons name="sparkles" size={15} color="#A96F00" />
            <Text style={styles.pointsText}>+{badge.points} KasaPoints</Text>
          </View>
          <Text style={styles.earnedDate}>
            Earned {new Date(badge.earnedAt).toLocaleDateString("en-GH", { dateStyle: "long" })}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  badgeTile: { minHeight: 96, width: "30.5%" },
  badgePressable: { alignItems: "center", backgroundColor: "#F7F9F8", borderRadius: 14, flex: 1, paddingHorizontal: 5, paddingVertical: 11 },
  badgeGlow: { alignItems: "center", borderRadius: 24, height: 48, justifyContent: "center", marginBottom: 8, width: 48 },
  badgeSpark: { borderColor: COLORS.surface, borderRadius: 5, borderWidth: 2, height: 9, position: "absolute", right: 1, top: 1, width: 9 },
  badgeName: { color: COLORS.text, fontSize: 9, fontWeight: "700", lineHeight: 12, textAlign: "center" },
  overlay: { alignItems: "center", backgroundColor: "rgba(7,24,19,0.58)", flex: 1, justifyContent: "center", padding: 24 },
  modalCard: { alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 26, maxWidth: 370, overflow: "hidden", paddingBottom: 27, paddingHorizontal: 24, paddingTop: 18, width: "100%" },
  closeButton: { alignItems: "center", alignSelf: "flex-end", backgroundColor: "#F1F4F3", borderRadius: 11, height: 38, justifyContent: "center", width: 38, zIndex: 2 },
  celebrationFrame: { alignItems: "center", height: 172, justifyContent: "center", marginTop: -10, width: 180 },
  celebration: { height: 172, width: 110 },
  modalBadgeIcon: { alignItems: "center", borderColor: COLORS.surface, borderRadius: 29, borderWidth: 4, bottom: 5, height: 58, justifyContent: "center", position: "absolute", right: 5, width: 58 },
  unlocked: { color: "#A96F00", fontSize: 10, fontWeight: "900", letterSpacing: 1.15, marginTop: 2 },
  modalTitle: { color: COLORS.text, fontSize: 23, fontWeight: "800", letterSpacing: -0.4, marginTop: 7, textAlign: "center" },
  modalDescription: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: "center" },
  pointsPill: { alignItems: "center", backgroundColor: "#FFF4D8", borderRadius: 16, flexDirection: "row", gap: 6, marginTop: 18, paddingHorizontal: 13, paddingVertical: 9 },
  pointsText: { color: "#8B5C00", fontSize: 12, fontWeight: "800" },
  earnedDate: { color: COLORS.muted, fontSize: 10, marginTop: 11 },
});
