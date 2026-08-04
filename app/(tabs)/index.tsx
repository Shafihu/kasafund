import { AnimatedLoader } from "@/components/ui/AnimatedLoader";
import { useKycGate } from "@/hooks/useKycGate";
import { apiService, type DashboardData } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: "#0B4D3E",
  primaryDark: "#07372C",
  primaryLight: "#E8F2EE",
  accent: "#E8B84B",
  background: "#F6F8F7",
  surface: "#FFFFFF",
  border: "#E2E9E6",
  text: "#12211C",
  textMuted: "#64736E",
  success: "#1E7A50",
  successSurface: "#E9F5EF",
  warning: "#9B6617",
  warningSurface: "#FFF5E3",
  error: "#B83B31",
  errorSurface: "#FCEDEA",
};

const GROUP_COLORS: Record<string, string> = {
  susu: COLORS.primary,
  family: "#8A5E2B",
  church: "#65548E",
  cooperative: "#35658D",
  other: "#596762",
};

const ReducedMotionContext = createContext(false);
const PRESS_EASING = Easing.bezier(0.23, 1, 0.32, 1);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MotionPressableProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  children: React.ReactNode;
  hitSlop?: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

function MotionPressable({
  accessibilityHint,
  accessibilityLabel,
  children,
  hitSlop,
  onPress,
  style,
}: MotionPressableProps) {
  const reduceMotion = useContext(ReducedMotionContext);
  const scale = useRef(new Animated.Value(1)).current;

  const animateScale = (toValue: number, duration: number) => {
    if (reduceMotion) return;
    scale.stopAnimation();
    Animated.timing(scale, {
      duration,
      easing: PRESS_EASING,
      toValue,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={hitSlop}
      onPress={onPress}
      onPressIn={() => animateScale(0.975, 110)}
      onPressOut={() => animateScale(1, 140)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

function formatMoney(amountInPesewas: number) {
  return `GH₵ ${(amountInPesewas / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function today() {
  return new Date().toLocaleDateString("en-GH", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

function relativeDate(value: string) {
  const difference = new Date(value).getTime() - Date.now();
  const days = Math.ceil(difference / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function relativeTime(value: string) {
  const difference = Math.max(Date.now() - new Date(value).getTime(), 0);
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <MotionPressable accessibilityLabel={label} onPress={onPress} style={styles.quickAction}>
      <View style={styles.quickActionIcon}>
        <Ionicons color={COLORS.primary} name={icon} size={20} />
      </View>
      <Text numberOfLines={2} style={styles.quickActionLabel}>{label}</Text>
    </MotionPressable>
  );
}

function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll ? (
        <MotionPressable hitSlop={10} onPress={onSeeAll}>
          <View style={styles.seeAllButton}>
            <Text style={styles.seeAll}>See all</Text>
            <Ionicons color={COLORS.primary} name="arrow-forward" size={14} />
          </View>
        </MotionPressable>
      ) : null}
    </View>
  );
}

function NextContribution({
  item,
  onPay,
}: {
  item: DashboardData["dueSoon"][number];
  onPay: () => void;
}) {
  const dueLabel = relativeDate(item.dueDate);
  const urgent = new Date(item.dueDate).getTime() - Date.now() <= 86_400_000;

  return (
    <View style={[styles.contributionCard, urgent && styles.contributionCardUrgent]}>
      <View style={styles.contributionHeader}>
        <View style={[styles.contributionIcon, urgent && styles.contributionIconUrgent]}>
          <Ionicons
            color={urgent ? COLORS.error : COLORS.primary}
            name="arrow-up-circle-outline"
            size={22}
          />
        </View>
        <View style={styles.contributionCopy}>
          <Text numberOfLines={1} style={styles.contributionGroup}>{item.groupName}</Text>
          <Text style={[styles.contributionDue, urgent && styles.contributionDueUrgent]}>
            {dueLabel} · {item.frequency}
          </Text>
        </View>
      </View>

      <View style={styles.contributionBottom}>
        <View>
          <Text style={styles.amountLabel}>Amount due</Text>
          <Text style={styles.contributionAmount}>{formatMoney(item.amount)}</Text>
        </View>
        <MotionPressable
          accessibilityLabel={`Pay ${formatMoney(item.amount)} to ${item.groupName}`}
          onPress={onPay}
          style={styles.payButton}
        >
          <Text style={styles.payButtonText}>Pay now</Text>
          <Ionicons color={COLORS.surface} name="arrow-forward" size={15} />
        </MotionPressable>
      </View>
    </View>
  );
}

function GroupCard({
  group,
  onPress,
}: {
  group: DashboardData["groups"][number];
  onPress: () => void;
}) {
  const color = GROUP_COLORS[group.type] || GROUP_COLORS.other;
  const percentage = Math.min(Math.max(Math.round(group.progress * 100), 0), 100);

  return (
    <MotionPressable
      accessibilityHint="Opens group details"
      accessibilityLabel={group.name}
      onPress={onPress}
      style={styles.groupCard}
    >
      <View style={styles.groupTopRow}>
        <View style={[styles.groupImageFrame, { backgroundColor: `${color}14` }]}>
          {group.coverImageUrl ? (
            <ExpoImage
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: group.coverImageUrl }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Ionicons color={color} name="people-outline" size={23} />
          )}
        </View>

        <View style={styles.groupInfo}>
          <View style={styles.groupNameRow}>
            <Text numberOfLines={1} style={styles.groupName}>{group.name}</Text>
            <View style={[styles.groupStatus, { backgroundColor: `${color}12` }]}>
              <Text style={[styles.groupStatusText, { color }]}>{group.status}</Text>
            </View>
          </View>
          <Text style={styles.groupSchedule}>
            {formatMoney(group.contributionAmount)} · {group.frequency}
          </Text>
        </View>

        <Ionicons color={COLORS.textMuted} name="chevron-forward" size={18} />
      </View>

      <View style={styles.groupMetrics}>
        <View>
          <Text style={styles.metricLabel}>Current pot</Text>
          <Text style={styles.metricValue}>{formatMoney(group.totalPot)}</Text>
        </View>
        <Text style={styles.progressValue}>{percentage}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { backgroundColor: color, width: `${percentage}%` }]} />
      </View>

      <View style={styles.groupFooter}>
        <View style={styles.membersRow}>
          <View style={styles.initialStack}>
            {group.memberNames.slice(0, 3).map((name, index) => (
              <View
                key={`${name}-${index}`}
                style={[styles.memberInitial, { marginLeft: index ? -7 : 0, zIndex: 3 - index }]}
              >
                <Text style={styles.memberInitialText}>{initials(name)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.memberCount}>{group.memberCount} members</Text>
        </View>
        <View style={styles.payoutMeta}>
          <Ionicons color={COLORS.textMuted} name="calendar-outline" size={13} />
          <Text numberOfLines={1} style={styles.payoutMetaText}>
            {group.nextPayoutDate ? relativeDate(group.nextPayoutDate) : "Payout pending"}
          </Text>
        </View>
      </View>
    </MotionPressable>
  );
}

function ActivityRow({ item }: { item: DashboardData["recentActivity"][number] }) {
  const isPayout = item.type === "payout";
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, isPayout ? styles.payoutIcon : styles.paymentIcon]}>
        <Ionicons
          color={isPayout ? COLORS.success : COLORS.primary}
          name={isPayout ? "arrow-down" : "arrow-up"}
          size={17}
        />
      </View>
      <View style={styles.activityCopy}>
        <Text numberOfLines={1} style={styles.activityTitle}>{item.description}</Text>
        <Text style={styles.activityMeta}>{item.status} · {relativeTime(item.occurredAt)}</Text>
      </View>
      <Text style={[styles.activityAmount, isPayout && styles.incomingAmount]}>
        {isPayout ? "+" : "−"}{formatMoney(item.amount)}
      </Text>
    </View>
  );
}

function EmptySection({
  actionLabel,
  compact = false,
  contained = false,
  icon,
  onAction,
  text,
  title,
}: {
  actionLabel?: string;
  compact?: boolean;
  contained?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  text: string;
  title: string;
}) {
  return (
    <View style={[
      styles.emptySection,
      compact && styles.emptySectionCompact,
      contained && styles.emptySectionContained,
    ]}>
      <View style={styles.emptyIcon}>
        <Ionicons color={COLORS.primary} name={icon} size={21} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{text}</Text>
      </View>
      {actionLabel && onAction ? (
        <MotionPressable onPress={onAction} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </MotionPressable>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const { guardKyc } = useKycGate();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedDashboard = useRef(false);

  const firstName = useMemo(() => user?.fullName?.split(/\s+/)[0] || "there", [user?.fullName]);
  const activeGroupCount = useMemo(
    () => dashboard?.groups.filter((group) => group.status === "active").length ?? 0,
    [dashboard?.groups],
  );

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const loadDashboard = useCallback(async (refresh = false, silent = false) => {
    if (refresh) setRefreshing(true);
    else if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await apiService.getDashboard();
      setDashboard(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load your dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard(false, hasLoadedDashboard.current);
      hasLoadedDashboard.current = true;
    }, [loadDashboard]),
  );

  const openContribution = (item: DashboardData["dueSoon"][number]) => {
    router.push({
      pathname: "/groups/[id]/contribute",
      params: {
        contributionAmount: formatMoney(item.amount),
        frequency: item.frequency,
        groupName: item.groupName,
        id: item.groupId,
      },
    });
  };

  const balance = dashboard?.walletBalance ?? user?.walletBalance ?? 0;
  const nextContribution = dashboard?.dueSoon[0];

  return (
    <ReducedMotionContext.Provider value={reduceMotion}>
      <SafeAreaView edges={["top"]} style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              colors={[COLORS.primary]}
              onRefresh={() => loadDashboard(true)}
              refreshing={refreshing}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.greeting}>{greeting()}, {firstName}</Text>
              <Text style={styles.date}>{today()}</Text>
            </View>
            <MotionPressable
              accessibilityLabel={
                dashboard?.unreadNotificationCount
                  ? `${dashboard.unreadNotificationCount} unread notifications`
                  : "Notifications"
              }
              onPress={() => router.push("/notifications_modal")}
              style={styles.notificationButton}
            >
              <Ionicons color={COLORS.text} name="notifications-outline" size={21} />
              {!!dashboard?.unreadNotificationCount && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {dashboard.unreadNotificationCount > 99 ? "99+" : dashboard.unreadNotificationCount}
                  </Text>
                </View>
              )}
            </MotionPressable>
          </View>

          <MotionPressable
            accessibilityHint="Opens your wallet"
            accessibilityLabel={`Available wallet balance ${formatMoney(balance)}`}
            onPress={() => router.push("/(tabs)/wallet")}
            style={styles.balanceCard}
          >
            <View style={styles.balanceTopRow}>
              <Text style={styles.balanceLabel}>Available balance</Text>
              <View style={styles.walletShortcut}>
                <Text style={styles.walletShortcutText}>Wallet</Text>
                <Ionicons color={COLORS.surface} name="arrow-forward" size={14} />
              </View>
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.balanceValue}>
              {formatMoney(balance)}
            </Text>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStats}>
              <View style={styles.balanceStat}>
                <Text style={styles.balanceStatValue}>{dashboard?.dueSoon.length ?? 0}</Text>
                <Text style={styles.balanceStatLabel}>Payments due</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.balanceStat}>
                <Text style={styles.balanceStatValue}>{activeGroupCount}</Text>
                <Text style={styles.balanceStatLabel}>Active groups</Text>
              </View>
              <View style={styles.balanceSecurity}>
                <Ionicons color={COLORS.accent} name="shield-checkmark" size={17} />
              </View>
            </View>
          </MotionPressable>

          <View style={styles.quickSection}>
            <Text style={styles.quickTitle}>Quick actions</Text>
            <View style={styles.quickActions}>
              <QuickAction
                icon="add-outline"
                label="Create group"
                onPress={() => guardKyc("create a savings group", () => router.push("/create_group_modal"))}
              />
              <QuickAction
                icon="people-outline"
                label="Find groups"
                onPress={() => router.push("/(tabs)/groups")}
              />
              <QuickAction
                icon="megaphone-outline"
                label="Fundraise"
                onPress={() => guardKyc("create a fundraiser", () => router.push("/create_campaign_modal"))}
              />
              <QuickAction
                icon="arrow-up-outline"
                label="Contribute"
                onPress={() => nextContribution
                  ? openContribution(nextContribution)
                  : router.push("/(tabs)/groups")}
              />
            </View>
          </View>

          {error ? (
            <MotionPressable onPress={() => loadDashboard()} style={styles.errorCard}>
              <Ionicons color={COLORS.error} name="cloud-offline-outline" size={19} />
              <Text style={styles.errorText}>{error}. Tap to retry.</Text>
            </MotionPressable>
          ) : null}

          {loading && !dashboard ? (
            <View style={styles.loadingState}>
              <AnimatedLoader accessibilityLabel="Loading dashboard" size="compact" />
            </View>
          ) : (
            <>
              <SectionHeader
                onSeeAll={() => router.push("/(tabs)/groups")}
                title="Next contribution"
              />
              {nextContribution ? (
                <View style={styles.sectionBody}>
                  <NextContribution
                    item={nextContribution}
                    onPay={() => openContribution(nextContribution)}
                  />
                  {(dashboard?.dueSoon.length ?? 0) > 1 ? (
                    <Text style={styles.moreDueText}>
                      +{(dashboard?.dueSoon.length ?? 1) - 1} more upcoming payment
                    </Text>
                  ) : null}
                </View>
              ) : (
                <EmptySection
                  compact
                  icon="checkmark-circle-outline"
                  text="No group contributions need your attention."
                  title="You're all caught up"
                />
              )}

              <SectionHeader onSeeAll={() => router.push("/(tabs)/groups")} title="My groups" />
              <View style={styles.groupList}>
                {dashboard?.groups.length ? (
                  dashboard.groups.slice(0, 3).map((group) => (
                    <GroupCard
                      group={group}
                      key={group.id}
                      onPress={() => router.push(`/groups/${group.id}`)}
                    />
                  ))
                ) : (
                  <EmptySection
                    actionLabel="Create group"
                    contained
                    icon="people-outline"
                    onAction={() => guardKyc(
                      "create a savings group",
                      () => router.push("/create_group_modal"),
                    )}
                    text="Start a savings circle or discover a public group."
                    title="Build your first circle"
                  />
                )}
              </View>

              <SectionHeader title="Recent activity" />
              {dashboard?.recentActivity.length ? (
                <View style={styles.activityList}>
                  {dashboard.recentActivity.slice(0, 5).map((item) => (
                    <ActivityRow item={item} key={`${item.type}-${item.id}`} />
                  ))}
                </View>
              ) : (
                <EmptySection
                  compact
                  icon="receipt-outline"
                  text="Your contributions and payouts will appear here."
                  title="No recent activity"
                />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ReducedMotionContext.Provider>
  );
}

const styles = StyleSheet.create({
  activityAmount: { color: COLORS.text, fontSize: 12, fontWeight: "700", marginLeft: 8 },
  activityCopy: { flex: 1 },
  activityIcon: { alignItems: "center", borderRadius: 12, height: 40, justifyContent: "center", marginRight: 12, width: 40 },
  activityList: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, marginHorizontal: 20, overflow: "hidden" },
  activityMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 3, textTransform: "capitalize" },
  activityRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 66, paddingHorizontal: 14, paddingVertical: 12 },
  activityTitle: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  amountLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  balanceCard: { backgroundColor: COLORS.primaryDark, borderColor: "rgba(255,255,255,0.08)", borderRadius: 22, borderWidth: 1, marginHorizontal: 20, padding: 20, shadowColor: COLORS.primaryDark, shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.16, shadowRadius: 20 },
  balanceDivider: { backgroundColor: "rgba(255,255,255,0.12)", height: StyleSheet.hairlineWidth, marginVertical: 18 },
  balanceLabel: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "600" },
  balanceSecurity: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.09)", borderRadius: 14, height: 36, justifyContent: "center", marginLeft: "auto", width: 36 },
  balanceStat: { minWidth: 72 },
  balanceStatLabel: { color: "rgba(255,255,255,0.58)", fontSize: 10, marginTop: 3 },
  balanceStatValue: { color: COLORS.surface, fontSize: 15, fontWeight: "700" },
  balanceStats: { alignItems: "center", flexDirection: "row" },
  balanceTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  balanceValue: { color: COLORS.surface, fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 8 },
  container: { backgroundColor: COLORS.background, flex: 1 },
  content: { paddingBottom: 120 },
  contributionAmount: { color: COLORS.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.4, marginTop: 3 },
  contributionBottom: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  contributionCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, padding: 16, shadowColor: COLORS.primaryDark, shadowOffset: { height: 5, width: 0 }, shadowOpacity: 0.04, shadowRadius: 14 },
  contributionCardUrgent: { backgroundColor: "#FFFAF9", borderColor: "#F1D2CD" },
  contributionCopy: { flex: 1 },
  contributionDue: { color: COLORS.textMuted, fontSize: 11, marginTop: 4, textTransform: "capitalize" },
  contributionDueUrgent: { color: COLORS.error, fontWeight: "600" },
  contributionGroup: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  contributionHeader: { alignItems: "center", flexDirection: "row" },
  contributionIcon: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 14, height: 46, justifyContent: "center", marginRight: 12, width: 46 },
  contributionIconUrgent: { backgroundColor: COLORS.errorSurface },
  date: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  emptyAction: { backgroundColor: COLORS.primaryLight, borderRadius: 10, marginLeft: 12 },
  emptyActionText: { color: COLORS.primary, fontSize: 11, fontWeight: "700", paddingHorizontal: 12, paddingVertical: 10 },
  emptyCopy: { flex: 1 },
  emptyIcon: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 14, height: 44, justifyContent: "center", marginRight: 12, width: 44 },
  emptySection: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, flexDirection: "row", marginHorizontal: 20, padding: 16 },
  emptySectionContained: { alignSelf: "stretch", marginHorizontal: 0 },
  emptySectionCompact: { marginBottom: 28 },
  emptyText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  emptyTitle: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  errorCard: { alignItems: "center", backgroundColor: COLORS.errorSurface, borderColor: "#F1D2CD", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginBottom: 24, marginHorizontal: 20, minHeight: 50, paddingHorizontal: 14 },
  errorText: { color: COLORS.error, flex: 1, fontSize: 12, lineHeight: 17, marginLeft: 10 },
  greeting: { color: COLORS.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  groupCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, padding: 15, shadowColor: COLORS.primaryDark, shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.035, shadowRadius: 12 },
  groupFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 13 },
  groupImageFrame: { alignItems: "center", borderRadius: 14, height: 52, justifyContent: "center", marginRight: 12, overflow: "hidden", width: 52 },
  groupInfo: { flex: 1, marginRight: 8 },
  groupList: { gap: 12, marginBottom: 30, paddingHorizontal: 20 },
  groupMetrics: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between", marginBottom: 8, marginTop: 16 },
  groupName: { color: COLORS.text, flex: 1, fontSize: 14, fontWeight: "700", marginRight: 7 },
  groupNameRow: { alignItems: "center", flexDirection: "row" },
  groupSchedule: { color: COLORS.textMuted, fontSize: 11, marginTop: 5, textTransform: "capitalize" },
  groupStatus: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4 },
  groupStatusText: { fontSize: 8, fontWeight: "800", textTransform: "uppercase" },
  groupTopRow: { alignItems: "center", flexDirection: "row" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingBottom: 20, paddingHorizontal: 20, paddingTop: 10 },
  headerCopy: { flex: 1, paddingRight: 12 },
  incomingAmount: { color: COLORS.success },
  initialStack: { alignItems: "center", flexDirection: "row" },
  loadingState: { alignItems: "center", minHeight: 280, paddingTop: 72 },
  memberCount: { color: COLORS.textMuted, fontSize: 10, marginLeft: 7 },
  memberInitial: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderColor: COLORS.surface, borderRadius: 11, borderWidth: 1.5, height: 23, justifyContent: "center", width: 23 },
  memberInitialText: { color: COLORS.primary, fontSize: 7, fontWeight: "800" },
  membersRow: { alignItems: "center", flexDirection: "row", flexShrink: 1 },
  metricLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600" },
  metricValue: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginTop: 2 },
  moreDueText: { color: COLORS.textMuted, fontSize: 11, marginTop: 9, textAlign: "center" },
  notificationBadge: { alignItems: "center", backgroundColor: COLORS.error, borderColor: COLORS.surface, borderRadius: 9, borderWidth: 1.5, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 4, position: "absolute", right: -5, top: -5 },
  notificationBadgeText: { color: COLORS.surface, fontSize: 9, fontWeight: "800", lineHeight: 11 },
  notificationButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, height: 46, justifyContent: "center", shadowColor: COLORS.primaryDark, shadowOffset: { height: 3, width: 0 }, shadowOpacity: 0.04, shadowRadius: 10, width: 46 },
  payButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 12, flexDirection: "row", justifyContent: "center", minHeight: 44, minWidth: 104, paddingHorizontal: 15 },
  payButtonText: { color: COLORS.surface, fontSize: 12, fontWeight: "700", marginRight: 6 },
  paymentIcon: { backgroundColor: COLORS.primaryLight },
  payoutIcon: { backgroundColor: COLORS.successSurface },
  payoutMeta: { alignItems: "center", flexDirection: "row", flexShrink: 1, marginLeft: 10 },
  payoutMetaText: { color: COLORS.textMuted, flexShrink: 1, fontSize: 10, marginLeft: 5 },
  progressFill: { borderRadius: 3, height: "100%" },
  progressTrack: { backgroundColor: COLORS.border, borderRadius: 3, height: 5, overflow: "hidden" },
  progressValue: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  quickAction: { alignItems: "center", flex: 1, minHeight: 72 },
  quickActionIcon: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, height: 46, justifyContent: "center", marginBottom: 8, shadowColor: COLORS.primaryDark, shadowOffset: { height: 3, width: 0 }, shadowOpacity: 0.035, shadowRadius: 8, width: 46 },
  quickActionLabel: { color: COLORS.text, fontSize: 10, fontWeight: "600", lineHeight: 13, textAlign: "center" },
  quickActions: { flexDirection: "row", gap: 6 },
  quickSection: { marginBottom: 28, marginHorizontal: 20, marginTop: 24 },
  quickTitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, marginBottom: 13, textTransform: "uppercase" },
  sectionBody: { marginBottom: 29, marginHorizontal: 20 },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 13, paddingHorizontal: 20 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  seeAll: { color: COLORS.primary, fontSize: 11, fontWeight: "700", marginRight: 5 },
  seeAllButton: { alignItems: "center", flexDirection: "row", minHeight: 40, paddingLeft: 10 },
  statDivider: { backgroundColor: "rgba(255,255,255,0.12)", height: 30, marginHorizontal: 18, width: StyleSheet.hairlineWidth },
  walletShortcut: { alignItems: "center", flexDirection: "row" },
  walletShortcutText: { color: COLORS.surface, fontSize: 11, fontWeight: "700", marginRight: 5 },
});
