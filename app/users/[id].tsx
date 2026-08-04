import { AnimatedLoader } from "@/components/ui/AnimatedLoader";
import { AchievementBadgeModal, AnimatedAchievementBadge } from "@/components/users/AchievementBadge";
import { KasaPointAvatar } from "@/components/users/KasaPointAvatar";
import {
  apiService,
  type AchievementBadge,
  type ApiGroupJoinRequest,
  type PublicUserProfile,
} from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: "#0B4D3E",
  primaryDark: "#07372C",
  soft: "#E5F2ED",
  accent: "#E8B84B",
  background: "#F5F7F6",
  surface: "#FFFFFF",
  border: "#DFE7E3",
  text: "#12211C",
  muted: "#697873",
  verified: "#1D9BF0",
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function memberSince(value: string) {
  return new Date(value).toLocaleDateString("en-GH", { month: "long", year: "numeric" });
}

function groupTypeLabel(value: string) {
  return value === "susu" ? "Susu group" : `${value.charAt(0).toUpperCase()}${value.slice(1)} group`;
}

function trustLevelLabel(level: PublicUserProfile["trustMetrics"]["level"]) {
  return {
    new: "New member",
    building: "Building trust",
    reliable: "Reliable",
    trusted: "Trusted",
    exceptional: "Exceptional",
  }[level];
}

function accountAgeLabel(days: number) {
  if (days < 30) return `${Math.max(days, 1)} ${days === 1 ? "day" : "days"}`;
  if (days < 365) return `${Math.floor(days / 30)} ${Math.floor(days / 30) === 1 ? "month" : "months"}`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "year" : "years"}`;
}

function rewardTierLabel(tier: PublicUserProfile["achievements"]["tier"]) {
  return `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
}

function rewardTierColor(tier: PublicUserProfile["achievements"]["tier"]) {
  return {
    starter: "#697873",
    bronze: "#A66A35",
    silver: "#667085",
    gold: "#B9850D",
    platinum: "#176C73",
  }[tier];
}

export default function MemberProfileScreen() {
  const router = useRouter();
  const { id, reviewGroupId } = useLocalSearchParams<{
    id: string;
    reviewGroupId?: string;
  }>();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatingBlock, setUpdatingBlock] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<AchievementBadge | null>(null);
  const [joinRequest, setJoinRequest] = useState<ApiGroupJoinRequest | null>(null);
  const [reviewingRequest, setReviewingRequest] = useState(false);

  const loadProfile = useCallback(async (refresh = false) => {
    if (!id) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await apiService.getPublicUserProfile(id);
      setProfile(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn’t load this member.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!id || !reviewGroupId) return;
    apiService
      .getGroupJoinRequest(reviewGroupId, id)
      .then((response) => setJoinRequest(response.data))
      .catch(() => setJoinRequest(null));
  }, [id, reviewGroupId]);

  const respondToJoinRequest = (accept: boolean) => {
    if (!id || !reviewGroupId || !joinRequest || reviewingRequest) return;
    const action = accept ? "Accept" : "Decline";
    Alert.alert(
      `${action} membership request?`,
      accept
        ? `${profile?.user.fullName || "This member"} will join ${joinRequest.groupId.name} and enter its payout rotation.`
        : `${profile?.user.fullName || "This member"} will not be able to join ${joinRequest.groupId.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action,
          style: accept ? "default" : "destructive",
          onPress: async () => {
            setReviewingRequest(true);
            try {
              await apiService.respondToGroupJoinRequest(reviewGroupId, id, accept);
              setJoinRequest(null);
              Alert.alert(
                accept ? "Member accepted" : "Request declined",
                accept
                  ? `${profile?.user.fullName || "The member"} has joined the group.`
                  : "The membership request has been declined.",
                [{ text: "Done", onPress: () => router.back() }]
              );
            } catch (requestError) {
              Alert.alert(
                "Couldn’t update request",
                requestError instanceof Error ? requestError.message : "Please try again."
              );
            } finally {
              setReviewingRequest(false);
            }
          },
        },
      ]
    );
  };

  const updateBlock = async () => {
    if (!profile || !id || updatingBlock) return;
    setUpdatingBlock(true);
    try {
      if (profile.viewerHasBlocked) await apiService.unblockUser(id);
      else await apiService.blockUser(id);
      setProfile((current) => current ? { ...current, viewerHasBlocked: !current.viewerHasBlocked } : current);
    } catch (requestError) {
      Alert.alert("Couldn’t update block", requestError instanceof Error ? requestError.message : "Please try again.");
    } finally {
      setUpdatingBlock(false);
    }
  };

  const showMemberActions = () => {
    if (!profile || profile.isOwnProfile) return;
    const blocked = profile.viewerHasBlocked;
    Alert.alert(profile.user.fullName, undefined, [
      {
        text: "Report member",
        onPress: () => router.push({ pathname: "/users/report", params: { id: profile.user._id, name: profile.user.fullName } }),
      },
      {
        text: blocked ? "Unblock member" : "Block member",
        style: blocked ? "default" : "destructive",
        onPress: () => {
          if (blocked) {
            void updateBlock();
            return;
          }
          Alert.alert(
            `Block ${profile.user.fullName}?`,
            "They won’t be able to view your profile or exchange new group invitations with you.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Block", style: "destructive", onPress: () => void updateBlock() },
            ]
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const explainTrustMetrics = () => {
    Alert.alert(
      "How trust is calculated",
      "KasaFund uses identity verification, account age, successful and on-time group contributions, completed payout history, and the amount of history available. Wallet balance, contribution amounts, popularity, roles, and unresolved reports are never used."
    );
  };

  const explainRewards = () => {
    Alert.alert(
      "KasaPoints and badges",
      "Badges are automatically earned from verified KasaFund milestones. Their points build your recognition tier, but have no cash value and cannot be transferred or purchased."
    );
  };

  if (loading) {
    return <SafeAreaView style={styles.centered}><AnimatedLoader size="regular" /></SafeAreaView>;
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.errorIcon}><Ionicons name="person-outline" size={28} color={COLORS.primary} /></View>
        <Text style={styles.errorTitle}>Profile unavailable</Text>
        <Text style={styles.errorText}>{error || "This member’s profile could not be found."}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void loadProfile()}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { user } = profile;
  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={21} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Member profile</Text>
        {profile.isOwnProfile ? (
          <View style={styles.headerButton} />
        ) : (
          <TouchableOpacity
            accessibilityLabel="Member actions"
            disabled={updatingBlock}
            hitSlop={8}
            onPress={showMemberActions}
            style={styles.headerButton}
          >
            <Ionicons name="ellipsis-horizontal" size={21} color={COLORS.text} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadProfile(true)} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <KasaPointAvatar
            accessibilityLabel={`${user.fullName}'s ${rewardTierLabel(profile.achievements.tier)} KasaPoints profile`}
            imageUrl={user.profileImage}
            initials={initials(user.fullName)}
            size={108}
            tier={profile.achievements.tier}
          />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.fullName}</Text>
            {user.isIdentityVerified && <Ionicons name="checkmark-circle" size={19} color={COLORS.verified} />}
          </View>
          <Text style={styles.joined}>Kasafund member since {memberSince(user.joinedAt)}</Text>
          {profile.viewerHasBlocked && <Text style={styles.blockedLabel}>You blocked this member</Text>}
          {profile.isOwnProfile && (
            <TouchableOpacity style={styles.editButton} onPress={() => router.push("/profile/account")}>
              <Ionicons name="create-outline" size={16} color={COLORS.primary} />
              <Text style={styles.editButtonText}>Edit profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {joinRequest?.status === "pending" && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewIcon}>
                <Ionicons name="person-add-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.reviewCopy}>
                <Text style={styles.reviewTitle}>Membership request</Text>
                <Text style={styles.reviewSubtitle}>
                  Review this profile before adding them to {joinRequest.groupId.name}.
                </Text>
              </View>
            </View>
            {!!joinRequest.agreement?.acceptedAt && (
              <View style={styles.agreementAcceptedRow}>
                <Ionicons name="shield-checkmark" size={15} color={COLORS.primary} />
                <Text style={styles.agreementAcceptedText}>
                  Digital group agreement accepted
                </Text>
              </View>
            )}
            <View style={styles.reviewActions}>
              <TouchableOpacity
                disabled={reviewingRequest}
                onPress={() => respondToJoinRequest(false)}
                style={styles.declineRequestButton}
              >
                <Text style={styles.declineRequestText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={reviewingRequest}
                onPress={() => respondToJoinRequest(true)}
                style={styles.acceptRequestButton}
              >
                <Ionicons name="checkmark" size={17} color={COLORS.surface} />
                <Text style={styles.acceptRequestText}>
                  {reviewingRequest ? "Updating…" : "Accept member"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.card, styles.trustCard]}>
          <View style={styles.trustHeader}>
            <View style={styles.trustIdentity}>
              <View style={styles.trustIcon}>
                <Ionicons name="shield-checkmark" size={21} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Trust profile</Text>
                <Text style={styles.trustLevel}>{trustLevelLabel(profile.trustMetrics.level)}</Text>
              </View>
            </View>
            <TouchableOpacity accessibilityLabel="How trust is calculated" hitSlop={8} onPress={explainTrustMetrics}>
              <Ionicons name="information-circle-outline" size={21} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{profile.trustMetrics.score}</Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>
          <View style={styles.scoreTrack}>
            <View style={[styles.scoreFill, { width: `${profile.trustMetrics.score}%` as `${number}%` }]} />
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {profile.trustMetrics.contributionReliabilityPercent === null ? "New" : `${profile.trustMetrics.contributionReliabilityPercent}%`}
              </Text>
              <Text style={styles.metricLabel}>Contribution reliability</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {profile.trustMetrics.onTimeContributionPercent === null ? "New" : `${profile.trustMetrics.onTimeContributionPercent}%`}
              </Text>
              <Text style={styles.metricLabel}>Paid on time</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{profile.trustMetrics.successfulContributions}</Text>
              <Text style={styles.metricLabel}>Successful contributions</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{profile.trustMetrics.completedPayouts}</Text>
              <Text style={styles.metricLabel}>Completed payouts</Text>
            </View>
          </View>
          <View style={styles.trustEvidence}>
            <View style={styles.evidenceItem}>
              <Ionicons name={profile.trustMetrics.identityVerified ? "checkmark-circle" : "ellipse-outline"} size={15} color={profile.trustMetrics.identityVerified ? COLORS.verified : COLORS.muted} />
              <Text style={styles.evidenceText}>{profile.trustMetrics.identityVerified ? "Identity verified" : "Identity not verified"}</Text>
            </View>
            <View style={styles.evidenceDot} />
            <Text style={styles.evidenceText}>{accountAgeLabel(profile.trustMetrics.accountAgeDays)} on KasaFund</Text>
          </View>
        </View>

        <View style={[styles.card, styles.achievementCard]}>
          <View style={styles.achievementHeader}>
            <View style={styles.trustIdentity}>
              <View style={styles.rewardIcon}>
                <Ionicons name="trophy" size={21} color="#9A6A00" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Achievements & rewards</Text>
                <Text style={styles.achievementSubtitle}>Milestones earned on KasaFund</Text>
              </View>
            </View>
            <TouchableOpacity accessibilityLabel="About KasaPoints" hitSlop={8} onPress={explainRewards}>
              <Ionicons name="information-circle-outline" size={21} color={COLORS.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.rewardSummary}>
            <View>
              <Text style={styles.rewardPoints}>{profile.achievements.points}</Text>
              <Text style={styles.rewardPointsLabel}>KasaPoints</Text>
            </View>
            <View style={[styles.tierPill, { backgroundColor: `${rewardTierColor(profile.achievements.tier)}16` }]}>
              <Ionicons name="diamond-outline" size={14} color={rewardTierColor(profile.achievements.tier)} />
              <Text style={[styles.tierText, { color: rewardTierColor(profile.achievements.tier) }]}>
                {rewardTierLabel(profile.achievements.tier)}
              </Text>
            </View>
          </View>

          <View style={styles.rewardTrack}>
            <View style={[styles.rewardFill, { width: `${profile.achievements.tierProgressPercent}%` as `${number}%` }]} />
          </View>
          <Text style={styles.rewardProgressText}>
            {profile.achievements.nextTier
              ? `${profile.achievements.pointsToNextTier} points to ${rewardTierLabel(profile.achievements.nextTier)}`
              : "Highest recognition tier reached"}
          </Text>

          <Text style={styles.badgesTitle}>Earned badges</Text>
          {profile.achievements.badges.length ? (
            <View style={styles.badgeGrid}>
              {profile.achievements.badges.map((badge, index) => (
                <AnimatedAchievementBadge
                  badge={badge}
                  index={index}
                  key={badge.id}
                  onPress={() => setSelectedBadge(badge)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.noBadges}>
              <Ionicons name="ribbon-outline" size={22} color={COLORS.muted} />
              <Text style={styles.noBadgesText}>Badges will appear as this member reaches verified milestones.</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardIcon}><Ionicons name="person-outline" size={18} color={COLORS.primary} /></View>
            <Text style={styles.cardTitle}>About</Text>
          </View>
          <Text style={[styles.body, !user.bio && styles.mutedBody]}>
            {profile.visibility.bio
              ? user.bio || "This member hasn’t added a bio yet."
              : "This member keeps their bio private."}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardIcon}><Ionicons name="people-outline" size={18} color={COLORS.primary} /></View>
            <View style={styles.cardTitleCopy}>
              <Text style={styles.cardTitle}>Groups you share</Text>
              <Text style={styles.cardSubtitle}>{profile.sharedGroupCount} shared {profile.sharedGroupCount === 1 ? "group" : "groups"}</Text>
            </View>
          </View>
          {!profile.visibility.sharedGroups ? (
            <Text style={styles.mutedBody}>This member keeps their shared group list private.</Text>
          ) : profile.sharedGroups.length ? profile.sharedGroups.map((group) => (
            <TouchableOpacity
              key={group._id}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: "/groups/[id]", params: { id: group._id } })}
              style={styles.groupRow}
            >
              {group.coverImageUrl ? (
                <Image source={{ uri: group.coverImageUrl }} style={styles.groupImage} />
              ) : (
                <View style={[styles.groupImage, styles.groupImageFallback]}>
                  <Ionicons name="people" size={18} color={COLORS.primary} />
                </View>
              )}
              <View style={styles.groupCopy}>
                <Text numberOfLines={1} style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupType}>{groupTypeLabel(group.type)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          )) : (
            <Text style={styles.mutedBody}>You don’t currently share an active group with this member.</Text>
          )}
        </View>

        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={17} color={COLORS.primary} />
          <Text style={styles.privacyText}>Private contact, wallet, and verification details are never shown here.</Text>
        </View>
      </ScrollView>
      <AchievementBadgeModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  centered: { alignItems: "center", backgroundColor: COLORS.background, flex: 1, justifyContent: "center", padding: 28 },
  header: { alignItems: "center", backgroundColor: COLORS.background, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  headerTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  content: { paddingBottom: 48, paddingHorizontal: 20 },
  hero: { alignItems: "center", paddingBottom: 26, paddingTop: 28 },
  avatarRing: { borderColor: COLORS.surface, borderRadius: 54, borderWidth: 4, elevation: 3, shadowColor: COLORS.primaryDark, shadowOffset: { height: 5, width: 0 }, shadowOpacity: 0.12, shadowRadius: 10 },
  avatar: { borderRadius: 50, height: 100, width: 100 },
  avatarFallback: { alignItems: "center", backgroundColor: COLORS.primary, justifyContent: "center" },
  avatarInitials: { color: COLORS.surface, fontSize: 32, fontWeight: "800", letterSpacing: 0.5 },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: 17 },
  name: { color: COLORS.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  joined: { color: COLORS.muted, fontSize: 12, marginTop: 5 },
  blockedLabel: { color: "#C0392B", fontSize: 11, fontWeight: "700", marginTop: 8 },
  editButton: { alignItems: "center", backgroundColor: COLORS.soft, borderRadius: 12, flexDirection: "row", gap: 7, marginTop: 15, paddingHorizontal: 15, paddingVertical: 10 },
  editButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  reviewCard: { backgroundColor: "#EDF7F3", borderColor: "#CFE5DC", borderRadius: 18, borderWidth: 1, marginBottom: 14, padding: 17 },
  reviewHeader: { alignItems: "center", flexDirection: "row" },
  reviewIcon: { alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 12, height: 42, justifyContent: "center", marginRight: 11, width: 42 },
  reviewCopy: { flex: 1 },
  reviewTitle: { color: COLORS.primaryDark, fontSize: 15, fontWeight: "800" },
  reviewSubtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  agreementAcceptedRow: { alignItems: "center", flexDirection: "row", marginTop: 12 },
  agreementAcceptedText: { color: COLORS.primary, fontSize: 10, fontWeight: "700", marginLeft: 6 },
  reviewActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  declineRequestButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: "center", paddingVertical: 12 },
  declineRequestText: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  acceptRequestButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 12, flex: 1.35, flexDirection: "row", gap: 7, justifyContent: "center", paddingVertical: 12 },
  acceptRequestText: { color: COLORS.surface, fontSize: 13, fontWeight: "800" },
  card: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, marginBottom: 14, padding: 17 },
  trustCard: { padding: 18 },
  trustHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  trustIdentity: { alignItems: "center", flexDirection: "row" },
  trustIcon: { alignItems: "center", backgroundColor: COLORS.soft, borderRadius: 12, height: 42, justifyContent: "center", marginRight: 11, width: 42 },
  trustLevel: { color: COLORS.primary, fontSize: 11, fontWeight: "700", marginTop: 2 },
  scoreRow: { alignItems: "baseline", flexDirection: "row", marginTop: 19 },
  score: { color: COLORS.text, fontSize: 31, fontWeight: "800", letterSpacing: -1 },
  scoreOutOf: { color: COLORS.muted, fontSize: 12, fontWeight: "600", marginLeft: 3 },
  scoreTrack: { backgroundColor: COLORS.soft, borderRadius: 4, height: 7, marginBottom: 19, marginTop: 9, overflow: "hidden" },
  scoreFill: { backgroundColor: COLORS.primary, borderRadius: 4, height: 7 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  metricItem: { backgroundColor: COLORS.background, borderRadius: 12, margin: 5, minHeight: 72, padding: 11, width: "46.8%" },
  metricValue: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  metricLabel: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  trustEvidence: { alignItems: "center", borderTopColor: COLORS.border, borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", marginTop: 14, paddingTop: 13 },
  evidenceItem: { alignItems: "center", flexDirection: "row", gap: 5 },
  evidenceText: { color: COLORS.muted, fontSize: 10, fontWeight: "600" },
  evidenceDot: { backgroundColor: COLORS.border, borderRadius: 2, height: 3, marginHorizontal: 8, width: 3 },
  achievementCard: { padding: 18 },
  achievementHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  achievementSubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  rewardIcon: { alignItems: "center", backgroundColor: "#FFF4D8", borderRadius: 12, height: 42, justifyContent: "center", marginRight: 11, width: 42 },
  rewardSummary: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  rewardPoints: { color: COLORS.text, fontSize: 29, fontWeight: "800", letterSpacing: -0.8 },
  rewardPointsLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "600", marginTop: 1 },
  tierPill: { alignItems: "center", borderRadius: 14, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 8 },
  tierText: { fontSize: 11, fontWeight: "800" },
  rewardTrack: { backgroundColor: "#F2E8CB", borderRadius: 4, height: 6, marginTop: 14, overflow: "hidden" },
  rewardFill: { backgroundColor: COLORS.accent, borderRadius: 4, height: 6 },
  rewardProgressText: { color: COLORS.muted, fontSize: 10, marginTop: 7 },
  badgesTitle: { color: COLORS.text, fontSize: 12, fontWeight: "800", marginBottom: 11, marginTop: 22 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  noBadges: { alignItems: "center", backgroundColor: COLORS.background, borderRadius: 13, flexDirection: "row", gap: 10, padding: 14 },
  noBadgesText: { color: COLORS.muted, flex: 1, fontSize: 10, lineHeight: 15 },
  cardTitleRow: { alignItems: "center", flexDirection: "row", marginBottom: 14 },
  cardIcon: { alignItems: "center", backgroundColor: COLORS.soft, borderRadius: 11, height: 38, justifyContent: "center", marginRight: 11, width: 38 },
  cardTitleCopy: { flex: 1 },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  cardSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  body: { color: COLORS.text, fontSize: 14, lineHeight: 21 },
  mutedBody: { color: COLORS.muted },
  groupRow: { alignItems: "center", borderTopColor: COLORS.border, borderTopWidth: 1, flexDirection: "row", minHeight: 64, paddingVertical: 10 },
  groupImage: { borderRadius: 11, height: 42, marginRight: 11, width: 42 },
  groupImageFallback: { alignItems: "center", backgroundColor: COLORS.soft, justifyContent: "center" },
  groupCopy: { flex: 1 },
  groupName: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  groupType: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  privacyNote: { alignItems: "flex-start", backgroundColor: COLORS.soft, borderRadius: 14, flexDirection: "row", gap: 10, padding: 14 },
  privacyText: { color: COLORS.muted, flex: 1, fontSize: 11, lineHeight: 16 },
  errorIcon: { alignItems: "center", backgroundColor: COLORS.soft, borderRadius: 22, height: 64, justifyContent: "center", marginBottom: 15, width: 64 },
  errorTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  errorText: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: "center" },
  retryButton: { backgroundColor: COLORS.primary, borderRadius: 12, marginTop: 18, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { color: COLORS.surface, fontSize: 13, fontWeight: "700" },
});
