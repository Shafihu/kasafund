import { KasaFundMark } from "@/components/branding/KasaFundMark";
import { DEFAULT_USER_PREFERENCES } from "@/constants/userPreferences";
import { kasaColors } from "@/constants/design";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SlideId = "circle" | "personal-savings" | "fundraising" | "clarity" | "first-step";
type FirstStep = "groups" | "fundraising" | "explore";

type Slide = {
  description: string;
  id: SlideId;
  title: string;
  highlights: string[];
};

const SLIDES: Slide[] = [
  {
    id: "circle",
    title: "Susu, without the uncertainty.",
    description: "Build a trusted circle with clear commitments, a fair payout order, and records everyone can understand.",
    highlights: ["Verified members", "Shared payout order", "Clear due dates"],
  },
  {
    id: "personal-savings",
    title: "Make room for your own goals.",
    description: "Create personal susu pots, save at your pace, and keep each goal separate from group money.",
    highlights: ["Flexible deposits", "Optional auto-save", "Goal-by-goal progress"],
  },
  {
    id: "fundraising",
    title: "Help good causes move forward.",
    description: "Start a campaign or support someone’s story with transparent progress and secure donations.",
    highlights: ["Shareable campaigns", "Secure donations", "Organizer updates"],
  },
  {
    id: "clarity",
    title: "Know where every cedi goes.",
    description: "Contributions, personal savings, donations, and payouts stay securely recorded in one wallet.",
    highlights: ["Secure payments", "Instant records", "Timely updates"],
  },
  {
    id: "first-step",
    title: "Where would you like to begin?",
    description: "Choose your first stop. Nothing is locked—you can explore all of KasaFund whenever you want.",
    highlights: [],
  },
];

const FIRST_STEPS: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  id: FirstStep;
  label: string;
}[] = [
  { id: "groups", icon: "people-outline", label: "Savings groups", description: "Create or find a trusted circle" },
  { id: "fundraising", icon: "heart-outline", label: "Fundraising", description: "Discover causes and campaigns" },
  { id: "explore", icon: "grid-outline", label: "Home", description: "Take a quick look around" },
];

function CircleVisual() {
  return (
    <View style={[styles.visual, styles.circleVisual]}>
      <View style={styles.visualHeader}>
        <View>
          <Text style={styles.visualKicker}>YOUR SAVINGS CIRCLE</Text>
          <Text style={styles.visualTitle}>Everyone knows the plan</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Active</Text>
        </View>
      </View>

      <View style={styles.rotationTrack} />
      {["01", "02", "03"].map((position, index) => (
        <View key={position} style={styles.memberRow}>
          <View style={[styles.memberAvatar, index === 0 && styles.memberAvatarCurrent]}>
            <Ionicons color={index === 0 ? kasaColors.brandStrong : kasaColors.brand} name="person" size={15} />
          </View>
          <View style={styles.memberCopy}>
            <Text style={styles.memberLabel}>{index === 0 ? "Your position" : `Member ${position}`}</Text>
            <Text style={styles.memberMeta}>{index === 0 ? "Next in the payout order" : "Commitment confirmed"}</Text>
          </View>
          <View style={styles.positionBadge}><Text style={styles.positionText}>{position}</Text></View>
        </View>
      ))}
    </View>
  );
}

function ClarityVisual() {
  return (
    <View style={[styles.visual, styles.clarityVisual]}>
      <View style={styles.walletTopRow}>
        <View>
          <Text style={styles.walletLabel}>KasaFund wallet</Text>
          <Text style={styles.walletTitle}>Every movement, accounted for.</Text>
        </View>
        <View style={styles.shieldIcon}>
          <Ionicons color={kasaColors.accent} name="shield-checkmark" size={20} />
        </View>
      </View>

      <View style={styles.moneyPath}>
        <View style={styles.pathIcon}><Ionicons color={kasaColors.brand} name="wallet-outline" size={20} /></View>
        <View style={styles.pathLine}><View style={styles.pathLineFill} /></View>
        <View style={[styles.pathIcon, styles.pathIconDone]}><Ionicons color={kasaColors.white} name="checkmark" size={20} /></View>
      </View>

      <View style={styles.receipt}>
        <View style={styles.receiptIcon}><Ionicons color={kasaColors.brand} name="arrow-up" size={17} /></View>
        <View style={styles.receiptCopy}>
          <Text style={styles.receiptTitle}>Contribution recorded</Text>
          <Text style={styles.receiptMeta}>Visible in your wallet and group ledger</Text>
        </View>
        <Ionicons color={kasaColors.success} name="checkmark-circle" size={20} />
      </View>
    </View>
  );
}

function PersonalSavingsVisual() {
  return (
    <View style={[styles.visual, styles.savingsVisual]}>
      <View style={styles.savingsTopRow}>
        <View>
          <Text style={styles.savingsKicker}>PERSONAL SUSU</Text>
          <Text style={styles.savingsTitle}>A pot for every plan</Text>
        </View>
        <View style={styles.savingsIcon}>
          <Ionicons color={kasaColors.brand} name="leaf" size={20} />
        </View>
      </View>

      <View style={styles.goalCard}>
        <View style={styles.goalTopRow}>
          <View>
            <Text style={styles.goalLabel}>Your next goal</Text>
            <Text style={styles.goalName}>Growing steadily</Text>
          </View>
          <Text style={styles.goalPercent}>64%</Text>
        </View>
        <View style={styles.goalTrack}><View style={styles.goalFill} /></View>
        <View style={styles.goalFooter}>
          <View style={styles.goalMeta}><Ionicons color={kasaColors.brand} name="calendar-outline" size={14} /><Text style={styles.goalMetaText}>Save on your schedule</Text></View>
          <Ionicons color={kasaColors.success} name="checkmark-circle" size={18} />
        </View>
      </View>
    </View>
  );
}

function FundraisingVisual() {
  return (
    <View style={[styles.visual, styles.fundraisingVisual]}>
      <View style={styles.campaignArt}>
        <View style={styles.campaignArtIcon}>
          <Ionicons color={kasaColors.brandStrong} name="heart" size={25} />
        </View>
        <View style={styles.supporterStack}>
          {[kasaColors.brand, kasaColors.accent, kasaColors.info].map((color, index) => (
            <View key={color} style={[styles.supporter, { backgroundColor: color, marginLeft: index ? -7 : 0 }]}>
              <Ionicons color={kasaColors.white} name="person" size={9} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.campaignCopy}>
        <Text style={styles.campaignKicker}>COMMUNITY FUNDRAISING</Text>
        <Text style={styles.campaignTitle}>Every contribution builds momentum.</Text>
        <View style={styles.campaignProgress}><View style={styles.campaignProgressFill} /></View>
        <View style={styles.campaignFooter}>
          <Text style={styles.campaignMeta}>72% of the goal reached</Text>
          <Text style={styles.campaignSupporters}>Community supported</Text>
        </View>
      </View>
    </View>
  );
}

function StartVisual() {
  return (
    <View style={[styles.visual, styles.startVisual]}>
      <View style={styles.startMark}><KasaFundMark size={58} /></View>
      <Text style={styles.startTitle}>One account. Many ways to move forward.</Text>
      <View style={styles.startIcons}>
        {(["people-outline", "wallet-outline", "heart-outline"] as const).map((icon) => (
          <View key={icon} style={styles.startIcon}>
            <Ionicons color={kasaColors.brand} name={icon} size={19} />
          </View>
        ))}
      </View>
    </View>
  );
}

function ProductVisual({ id }: { id: SlideId }) {
  if (id === "circle") return <CircleVisual />;
  if (id === "personal-savings") return <PersonalSavingsVisual />;
  if (id === "fundraising") return <FundraisingVisual />;
  if (id === "clarity") return <ClarityVisual />;
  return <StartVisual />;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const isPreview = preview === "true";
  const { width, height } = useWindowDimensions();
  const compact = height < 740;
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const listRef = useRef<FlatList<Slide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [firstStep, setFirstStep] = useState<FirstStep>("groups");
  const [saving, setSaving] = useState(false);

  const closePreview = () => router.back();

  const finishOnboarding = async (destination = firstStep) => {
    if (saving) return;
    if (isPreview) {
      closePreview();
      return;
    }

    try {
      setSaving(true);
      await updateProfile({
        preferences: {
          ...DEFAULT_USER_PREFERENCES,
          ...user?.preferences,
          onboardingCompleted: true,
        },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

      if (destination === "groups") router.replace("/(tabs)/groups");
      else if (destination === "fundraising") router.replace("/(tabs)/fundraising");
      else router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Couldn’t finish setup", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const goTo = (index: number) => {
    listRef.current?.scrollToIndex({ animated: true, index });
    setCurrentIndex(index);
  };

  const goNext = () => {
    if (currentIndex === SLIDES.length - 1) {
      void finishOnboarding();
      return;
    }
    void Haptics.selectionAsync().catch(() => undefined);
    goTo(currentIndex + 1);
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrentIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <KasaFundMark size={36} />
          <Text style={styles.brandName}>KasaFund</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={isPreview ? closePreview : () => void finishOnboarding("explore")}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
        >
          <Text style={styles.headerActionText}>{isPreview ? "Close" : "Skip"}</Text>
        </Pressable>
      </View>

      <View accessibilityLabel={`Step ${currentIndex + 1} of ${SLIDES.length}`} style={styles.progressTrack}>
        {SLIDES.map((slide, index) => (
          <Pressable
            accessibilityLabel={`Go to onboarding step ${index + 1}`}
            accessibilityRole="button"
            key={slide.id}
            onPress={() => goTo(index)}
            style={[styles.progressSegment, index <= currentIndex && styles.progressSegmentActive]}
          />
        ))}
      </View>

      <Animated.FlatList
        data={SLIDES}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ index, length: width, offset: width * index })}
        horizontal
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleMomentumEnd}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        pagingEnabled
        ref={listRef}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.visualWrap, compact && styles.visualWrapCompact]}>
              <ProductVisual id={item.id} />
            </View>
            <View style={[styles.copyBlock, compact && styles.copyBlockCompact]}>
              <Text style={[styles.title, compact && styles.titleCompact]}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>

              {item.id === "first-step" ? (
                <View accessibilityRole="radiogroup" style={styles.choices}>
                  {FIRST_STEPS.map((choice) => {
                    const selected = choice.id === firstStep;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        key={choice.id}
                        onPress={() => {
                          setFirstStep(choice.id);
                          void Haptics.selectionAsync().catch(() => undefined);
                        }}
                        style={({ pressed }) => [
                          styles.choice,
                          selected && styles.choiceSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={[styles.choiceIcon, selected && styles.choiceIconSelected]}>
                          <Ionicons color={selected ? kasaColors.white : kasaColors.brand} name={choice.icon} size={19} />
                        </View>
                        <View style={styles.choiceCopy}>
                          <Text style={styles.choiceLabel}>{choice.label}</Text>
                          <Text style={styles.choiceDescription}>{choice.description}</Text>
                        </View>
                        <Ionicons color={selected ? kasaColors.brand : kasaColors.border} name={selected ? "checkmark-circle" : "ellipse-outline"} size={20} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.highlights}>
                  {item.highlights.map((highlight) => (
                    <View key={highlight} style={styles.highlightRow}>
                      <Ionicons color={kasaColors.success} name="checkmark-circle" size={17} />
                      <Text style={styles.highlightText}>{highlight}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={goNext}
          style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed, saving && styles.disabled]}
        >
          {saving ? <ActivityIndicator color={kasaColors.white} /> : (
            <>
              <Text style={styles.nextText}>
                {currentIndex === SLIDES.length - 1 ? (isPreview ? "Done" : "Enter KasaFund") : "Continue"}
              </Text>
              <Ionicons color={kasaColors.white} name={currentIndex === SLIDES.length - 1 ? "checkmark" : "arrow-forward"} size={20} />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: kasaColors.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 58, paddingHorizontal: 20 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 9 },
  brandName: { color: kasaColors.text, fontSize: 15, fontWeight: "900", letterSpacing: -0.3 },
  headerAction: { alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: 8 },
  headerActionText: { color: kasaColors.textMuted, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  progressTrack: { flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingVertical: 8 },
  progressSegment: { backgroundColor: kasaColors.border, borderRadius: 2, flex: 1, height: 3 },
  progressSegmentActive: { backgroundColor: kasaColors.brand },
  slide: { flex: 1 },
  visualWrap: { paddingHorizontal: 20, paddingTop: 20 },
  visualWrapCompact: { paddingTop: 10 },
  visual: { borderRadius: 22, height: 260, overflow: "hidden", padding: 20 },
  circleVisual: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderWidth: 1 },
  visualHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  visualKicker: { color: kasaColors.brand, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  visualTitle: { color: kasaColors.text, fontSize: 16, fontWeight: "800", marginTop: 4 },
  liveBadge: { alignItems: "center", backgroundColor: kasaColors.successSoft, borderRadius: 13, flexDirection: "row", paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { backgroundColor: kasaColors.success, borderRadius: 4, height: 7, marginRight: 5, width: 7 },
  liveText: { color: kasaColors.success, fontSize: 9, fontWeight: "800" },
  rotationTrack: { backgroundColor: kasaColors.border, bottom: 31, left: 37, position: "absolute", top: 87, width: 2 },
  memberRow: { alignItems: "center", flexDirection: "row", marginBottom: 13 },
  memberAvatar: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderColor: kasaColors.surface, borderRadius: 16, borderWidth: 3, height: 34, justifyContent: "center", width: 34, zIndex: 1 },
  memberAvatarCurrent: { backgroundColor: kasaColors.accent },
  memberCopy: { flex: 1, marginLeft: 10 },
  memberLabel: { color: kasaColors.text, fontSize: 11, fontWeight: "800" },
  memberMeta: { color: kasaColors.textMuted, fontSize: 9, marginTop: 2 },
  positionBadge: { alignItems: "center", borderColor: kasaColors.border, borderRadius: 12, borderWidth: 1, height: 25, justifyContent: "center", width: 32 },
  positionText: { color: kasaColors.brand, fontSize: 9, fontWeight: "900" },
  clarityVisual: { backgroundColor: kasaColors.brandStrong },
  walletTopRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  walletLabel: { color: "rgba(255,255,255,0.58)", fontSize: 9, fontWeight: "700" },
  walletTitle: { color: kasaColors.white, fontSize: 16, fontWeight: "800", marginTop: 5, maxWidth: 230 },
  shieldIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  moneyPath: { alignItems: "center", flexDirection: "row", marginTop: 30 },
  pathIcon: { alignItems: "center", backgroundColor: kasaColors.white, borderRadius: 17, height: 44, justifyContent: "center", width: 44 },
  pathIconDone: { backgroundColor: kasaColors.success },
  pathLine: { backgroundColor: "rgba(255,255,255,0.14)", flex: 1, height: 3, marginHorizontal: 9 },
  pathLineFill: { backgroundColor: kasaColors.accent, borderRadius: 2, height: 3, width: "82%" },
  receipt: { alignItems: "center", backgroundColor: kasaColors.surface, borderRadius: 15, flexDirection: "row", marginTop: 25, padding: 12 },
  receiptIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 10, height: 34, justifyContent: "center", width: 34 },
  receiptCopy: { flex: 1, marginHorizontal: 10 },
  receiptTitle: { color: kasaColors.text, fontSize: 10, fontWeight: "800" },
  receiptMeta: { color: kasaColors.textMuted, fontSize: 8, marginTop: 2 },
  savingsVisual: { backgroundColor: kasaColors.brandSoft },
  savingsTopRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  savingsKicker: { color: kasaColors.brand, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  savingsTitle: { color: kasaColors.text, fontSize: 16, fontWeight: "800", marginTop: 5 },
  savingsIcon: { alignItems: "center", backgroundColor: kasaColors.surface, borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  goalCard: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 17, borderWidth: 1, marginTop: 27, padding: 16 },
  goalTopRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  goalLabel: { color: kasaColors.textMuted, fontSize: 9 },
  goalName: { color: kasaColors.text, fontSize: 13, fontWeight: "800", marginTop: 4 },
  goalPercent: { color: kasaColors.brand, fontSize: 15, fontWeight: "900" },
  goalTrack: { backgroundColor: kasaColors.border, borderRadius: 4, height: 7, marginTop: 18, overflow: "hidden" },
  goalFill: { backgroundColor: kasaColors.accent, borderRadius: 4, height: 7, width: "64%" },
  goalFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  goalMeta: { alignItems: "center", flexDirection: "row", gap: 6 },
  goalMetaText: { color: kasaColors.textMuted, fontSize: 9, fontWeight: "600" },
  fundraisingVisual: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderWidth: 1, padding: 0 },
  campaignArt: { alignItems: "center", backgroundColor: kasaColors.accent, flexDirection: "row", height: 104, justifyContent: "space-between", paddingHorizontal: 20 },
  campaignArtIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.66)", borderRadius: 22, height: 52, justifyContent: "center", width: 52 },
  supporterStack: { flexDirection: "row" },
  supporter: { alignItems: "center", borderColor: kasaColors.accent, borderRadius: 13, borderWidth: 2, height: 26, justifyContent: "center", width: 26 },
  campaignCopy: { padding: 17 },
  campaignKicker: { color: kasaColors.brand, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  campaignTitle: { color: kasaColors.text, fontSize: 14, fontWeight: "800", marginTop: 5 },
  campaignProgress: { backgroundColor: kasaColors.border, borderRadius: 4, height: 7, marginTop: 16, overflow: "hidden" },
  campaignProgressFill: { backgroundColor: kasaColors.brand, borderRadius: 4, height: 7, width: "72%" },
  campaignFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 9 },
  campaignMeta: { color: kasaColors.textMuted, fontSize: 8, fontWeight: "600" },
  campaignSupporters: { color: kasaColors.brand, fontSize: 8, fontWeight: "800" },
  startVisual: { alignItems: "center", backgroundColor: kasaColors.brandSoft, height: 220, justifyContent: "center" },
  startMark: { marginBottom: 11 },
  startTitle: { color: kasaColors.text, fontSize: 16, fontWeight: "800", lineHeight: 21, maxWidth: 245, textAlign: "center" },
  startIcons: { flexDirection: "row", gap: 8, marginTop: 17 },
  startIcon: { alignItems: "center", backgroundColor: kasaColors.surface, borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  copyBlock: { paddingHorizontal: 24, paddingTop: 25 },
  copyBlockCompact: { paddingTop: 17 },
  title: { color: kasaColors.text, fontSize: 29, fontWeight: "900", letterSpacing: -1, lineHeight: 34 },
  titleCompact: { fontSize: 25, lineHeight: 29 },
  description: { color: kasaColors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 10, maxWidth: 345 },
  highlights: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 18 },
  highlightRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  highlightText: { color: kasaColors.text, fontSize: 10, fontWeight: "700" },
  choices: { gap: 8, marginTop: 15 },
  choice: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", minHeight: 58, paddingHorizontal: 11 },
  choiceSelected: { borderColor: kasaColors.brand },
  choiceIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 11, height: 38, justifyContent: "center", width: 38 },
  choiceIconSelected: { backgroundColor: kasaColors.brand },
  choiceCopy: { flex: 1, marginHorizontal: 10 },
  choiceLabel: { color: kasaColors.text, fontSize: 11, fontWeight: "800" },
  choiceDescription: { color: kasaColors.textMuted, fontSize: 9, marginTop: 3 },
  footer: { paddingBottom: 8, paddingHorizontal: 20, paddingTop: 10 },
  nextButton: { alignItems: "center", backgroundColor: kasaColors.brand, borderRadius: 15, flexDirection: "row", gap: 9, height: 56, justifyContent: "center" },
  nextButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  nextText: { color: kasaColors.white, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.62 },
});
