import { AnimatedLoader, KasaStateView } from "@/components/ui";
import { KasaPointAvatar } from "@/components/users/KasaPointAvatar";
import { kasaColors } from "@/constants/design";
import {
  apiService,
  type KasaPointsLeaderboard,
  type LeaderboardPeriod,
} from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: kasaColors.brand,
  primaryDark: kasaColors.brandStrong,
  soft: kasaColors.brandSoft,
  background: kasaColors.background,
  surface: kasaColors.surface,
  border: kasaColors.border,
  text: kasaColors.text,
  muted: kasaColors.textMuted,
  accent: kasaColors.accent,
  verified: "#1D9BF0",
};

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "weekly", label: "7 days" },
  { key: "monthly", label: "30 days" },
  { key: "all", label: "All time" },
];

type Entry = KasaPointsLeaderboard["entries"][number];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function PodiumMember({ entry, place }: { entry: Entry; place: 1 | 2 | 3 }) {
  const router = useRouter();
  const isWinner = place === 1;
  return (
    <Pressable
      accessibilityLabel={`${entry.fullName}, rank ${place}, ${entry.points} KasaPoints`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/users/[id]", params: { id: entry.userId } })}
      style={({ pressed }) => [
        styles.podiumMember,
        isWinner && styles.podiumWinner,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.placeBadge, isWinner && styles.winnerPlaceBadge]}>
        {isWinner ? (
          <Ionicons name="trophy" size={13} color="#805600" />
        ) : (
          <Text style={styles.placeBadgeText}>{place}</Text>
        )}
      </View>
      <KasaPointAvatar
        imageUrl={entry.avatarUrl}
        initials={initials(entry.fullName)}
        showTierBadge={false}
        size={isWinner ? 78 : 62}
        tier={entry.tier}
      />
      <View style={styles.podiumNameRow}>
        <Text numberOfLines={1} style={[styles.podiumName, isWinner && styles.podiumWinnerName]}>
          {entry.fullName.split(" ")[0]}
        </Text>
        {entry.identityVerified ? (
          <Ionicons name="checkmark-circle" size={13} color={COLORS.verified} />
        ) : null}
      </View>
      <Text style={[styles.podiumPoints, isWinner && styles.podiumWinnerPoints]}>
        {entry.points.toLocaleString()} pts
      </Text>
      <View style={[styles.podiumBase, isWinner && styles.podiumBaseWinner]}>
        <Text style={styles.podiumRank}>{place}</Text>
      </View>
    </Pressable>
  );
}

function LeaderboardRow({ entry }: { entry: Entry }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel={`${entry.fullName}, rank ${entry.rank}, ${entry.points} KasaPoints`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/users/[id]", params: { id: entry.userId } })}
      style={({ pressed }) => [styles.rankRow, pressed && styles.pressed]}
    >
      <Text style={styles.rankNumber}>{entry.rank}</Text>
      <KasaPointAvatar
        imageUrl={entry.avatarUrl}
        initials={initials(entry.fullName)}
        showTierBadge={false}
        size={46}
        tier={entry.tier}
      />
      <View style={styles.rankIdentity}>
        <View style={styles.rankNameRow}>
          <Text numberOfLines={1} style={styles.rankName}>{entry.fullName}</Text>
          {entry.identityVerified ? (
            <Ionicons name="checkmark-circle" size={14} color={COLORS.verified} />
          ) : null}
        </View>
        <Text style={styles.rankTier}>{entry.tier} tier</Text>
      </View>
      <Text style={styles.rankPoints}>{entry.points.toLocaleString()}</Text>
      <Text style={styles.rankPointsLabel}>pts</Text>
    </Pressable>
  );
}

export default function KasaPointsLeaderboardScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [data, setData] = useState<KasaPointsLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await apiService.getKasaPointsLeaderboard(period);
      setData(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t load rankings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const podiumEntries = data?.entries.slice(0, 3) || [];
  const podiumOrder = [podiumEntries[1], podiumEntries[0], podiumEntries[2]].filter(
    (entry): entry is Entry => Boolean(entry)
  );
  const remainingEntries = data?.entries.slice(3) || [];

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={21} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>KASAPOINTS</Text>
          <Text style={styles.title}>Leaderboard</Text>
        </View>
        <Pressable
          accessibilityLabel="Leaderboard privacy settings"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.push("/profile/privacy")}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="shield-outline" size={20} color={COLORS.primary} />
        </Pressable>
      </View>

      <View accessibilityRole="tablist" style={styles.periodTabs}>
        {PERIODS.map((item) => {
          const active = item.key === period;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={item.key}
              onPress={() => setPeriod(item.key)}
              style={({ pressed }) => [
                styles.periodTab,
                active && styles.periodTabActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <AnimatedLoader accessibilityLabel="Loading KasaPoints leaderboard" size="compact" />
        </View>
      ) : error && !data ? (
        <View style={styles.centered}>
          <KasaStateView
            actionLabel="Try again"
            icon="cloud-offline-outline"
            kind="error"
            message={error}
            onAction={() => void load()}
            title="Couldn’t load rankings"
          />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={remainingEntries}
          keyExtractor={(entry) => entry.userId}
          refreshControl={
            <RefreshControl
              onRefresh={() => void load(true)}
              refreshing={refreshing}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            <>
              {!data?.viewer.participating ? (
                <Pressable
                  onPress={() => router.push("/profile/privacy")}
                  style={({ pressed }) => [styles.optOutCard, pressed && styles.pressed]}
                >
                  <Ionicons name="eye-off-outline" size={20} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optOutTitle}>You’re hidden from rankings</Text>
                    <Text style={styles.optOutText}>Turn on leaderboard visibility in Privacy settings to participate.</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={17} color={COLORS.primary} />
                </Pressable>
              ) : null}

              {podiumOrder.length ? (
                <View style={styles.podium}>
                  {podiumOrder.map((entry) => (
                    <PodiumMember
                      entry={entry}
                      key={entry.userId}
                      place={entry.rank as 1 | 2 | 3}
                    />
                  ))}
                </View>
              ) : (
                <KasaStateView
                  icon="trophy-outline"
                  kind="empty"
                  message="Earn verified achievement badges to start this leaderboard."
                  style={styles.emptyState}
                  title="No KasaPoints earned yet"
                />
              )}

              {data?.viewer.participating ? (
                <View style={styles.viewerCard}>
                  <View style={styles.viewerIcon}>
                    <Ionicons name="person" size={18} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewerLabel}>Your position</Text>
                    <Text style={styles.viewerRank}>
                      {data.viewer.rank ? `#${data.viewer.rank}` : "Not ranked yet"}
                    </Text>
                  </View>
                  <View style={styles.viewerPointsWrap}>
                    <Text style={styles.viewerPoints}>{data.viewer.points.toLocaleString()}</Text>
                    <Text style={styles.viewerPointsLabel}>points this period</Text>
                  </View>
                </View>
              ) : null}

              {remainingEntries.length ? <Text style={styles.rankingTitle}>Community ranking</Text> : null}
            </>
          }
          ListEmptyComponent={podiumOrder.length ? null : <View />}
          renderItem={({ item }) => <LeaderboardRow entry={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", paddingHorizontal: 20, paddingTop: 8 },
  headerButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 13, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  headerCopy: { flex: 1, paddingHorizontal: 14 },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  title: { color: COLORS.text, fontSize: 25, fontWeight: "800", letterSpacing: -0.6, marginTop: 2 },
  periodTabs: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", marginHorizontal: 20, marginTop: 18, padding: 4 },
  periodTab: { alignItems: "center", borderRadius: 10, flex: 1, justifyContent: "center", minHeight: 38 },
  periodTabActive: { backgroundColor: COLORS.primary },
  periodText: { color: COLORS.muted, fontSize: 11, fontWeight: "700" },
  periodTextActive: { color: COLORS.surface },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  centered: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { paddingBottom: 40, paddingHorizontal: 20, paddingTop: 14 },
  optOutCard: { alignItems: "center", backgroundColor: COLORS.soft, borderRadius: 15, flexDirection: "row", gap: 11, marginBottom: 14, padding: 14 },
  optOutTitle: { color: COLORS.text, fontSize: 12, fontWeight: "800" },
  optOutText: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  podium: { alignItems: "flex-end", backgroundColor: COLORS.primaryDark, borderRadius: 22, flexDirection: "row", justifyContent: "center", minHeight: 270, overflow: "hidden", paddingHorizontal: 10, paddingTop: 24 },
  podiumMember: { alignItems: "center", flex: 1, maxWidth: 116 },
  podiumWinner: { alignSelf: "flex-start" },
  placeBadge: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 10, height: 24, justifyContent: "center", marginBottom: 7, width: 24 },
  winnerPlaceBadge: { backgroundColor: "#FFE39A" },
  placeBadgeText: { color: COLORS.surface, fontSize: 11, fontWeight: "800" },
  podiumNameRow: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 9, maxWidth: "94%" },
  podiumName: { color: "rgba(255,255,255,0.76)", flexShrink: 1, fontSize: 11, fontWeight: "700" },
  podiumWinnerName: { color: COLORS.surface, fontSize: 12 },
  podiumPoints: { color: "rgba(255,255,255,0.58)", fontSize: 9, marginTop: 3 },
  podiumWinnerPoints: { color: COLORS.accent, fontWeight: "800" },
  podiumBase: { alignItems: "center", alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.09)", borderTopLeftRadius: 12, borderTopRightRadius: 12, height: 54, justifyContent: "center", marginHorizontal: 3, marginTop: 11 },
  podiumBaseWinner: { height: 76 },
  podiumRank: { color: "rgba(255,255,255,0.18)", fontSize: 28, fontWeight: "900" },
  viewerCard: { alignItems: "center", backgroundColor: COLORS.soft, borderColor: "#CFE1DA", borderRadius: 16, borderWidth: 1, flexDirection: "row", marginTop: 14, padding: 14 },
  viewerIcon: { alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 11, height: 40, justifyContent: "center", marginRight: 11, width: 40 },
  viewerLabel: { color: COLORS.muted, fontSize: 10 },
  viewerRank: { color: COLORS.text, fontSize: 15, fontWeight: "800", marginTop: 2 },
  viewerPointsWrap: { alignItems: "flex-end" },
  viewerPoints: { color: COLORS.primary, fontSize: 16, fontWeight: "800" },
  viewerPointsLabel: { color: COLORS.muted, fontSize: 8, marginTop: 2 },
  rankingTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800", marginBottom: 10, marginTop: 24 },
  rankRow: { alignItems: "center", backgroundColor: COLORS.surface, borderBottomColor: COLORS.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 68, paddingHorizontal: 12, paddingVertical: 10 },
  rankNumber: { color: COLORS.muted, fontSize: 12, fontWeight: "800", textAlign: "center", width: 30 },
  rankIdentity: { flex: 1, marginLeft: 11 },
  rankNameRow: { alignItems: "center", flexDirection: "row", gap: 4 },
  rankName: { color: COLORS.text, flexShrink: 1, fontSize: 13, fontWeight: "700" },
  rankTier: { color: COLORS.muted, fontSize: 9, marginTop: 3, textTransform: "capitalize" },
  rankPoints: { color: COLORS.text, fontSize: 14, fontWeight: "800", marginLeft: 8 },
  rankPointsLabel: { color: COLORS.muted, fontSize: 8, marginLeft: 3 },
  emptyState: { minHeight: 250 },
});
