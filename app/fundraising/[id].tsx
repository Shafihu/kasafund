import { KasaButton, KasaStateView, KasaStatusBadge } from "@/components/ui";
import { kasaColors, kasaLayout, kasaRadii, kasaSpacing, kasaType } from "@/constants/design";
import { useKycGate } from "@/hooks/useKycGate";
import { apiService, type ApiCampaignDetail } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { consumeCampaignRefresh } from "@/utils/campaign-refresh";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: kasaColors.brand,
  primaryDark: kasaColors.brandStrong,
  accent: kasaColors.accent,
  background: kasaColors.background,
  surface: kasaColors.surface,
  border: kasaColors.border,
  text: kasaColors.text,
  textMuted: kasaColors.textMuted,
  placeholder: "#9AA8A3",
};

type ContentTab = "story" | "updates" | "supporters";

function money(amountInPesewas: number) {
  return `GH₵ ${(amountInPesewas / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function categoryLabel(category: string) {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function relativeTime(value: string) {
  const difference = Math.max(Date.now() - new Date(value).getTime(), 0);
  const hours = Math.floor(difference / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7
    ? `${days}d ago`
    : new Date(value).toLocaleDateString("en-GH", { day: "numeric", month: "short" });
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function Avatar({ name, imageUrl, size = 42 }: { name: string; imageUrl?: string; size?: number }) {
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={{ borderRadius: size / 2, height: size, width: size }} />;
  }
  return (
    <View style={[styles.avatarFallback, { borderRadius: size / 2, height: size, width: size }]}>
      <Text style={styles.avatarInitial}>{initials(name)}</Text>
    </View>
  );
}

export default function CampaignDetailScreen() {
  const { guardKyc } = useKycGate();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const [data, setData] = useState<ApiCampaignDetail | null>(null);
  const [activeTab, setActiveTab] = useState<ContentTab>("story");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadCampaign = useCallback(async (refresh = false) => {
    if (!id) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      setError("");
      const response = await apiService.getCampaign(id);
      setData(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load campaign.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void loadCampaign();
  }, [loadCampaign]);

  useFocusEffect(useCallback(() => {
    if (id && consumeCampaignRefresh(id)) {
      void loadCampaign();
    }
  }, [id, loadCampaign]));

  if (loading && !data) {
    return (
      <View style={styles.centerState}>
        <KasaStateView kind="loading" title="Loading campaign" />
      </View>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.centerState}>
        <KasaStateView
          actionLabel="Try again"
          icon="megaphone-outline"
          kind="error"
          message={error || "This campaign may have ended or the link is invalid."}
          onAction={() => void loadCampaign()}
          title="Campaign not found"
        />
        <KasaButton fullWidth={false} label="Go back" onPress={() => router.back()} variant="ghost" />
      </SafeAreaView>
    );
  }

  const { campaign, updates, comments, donations } = data;
  const progress = campaign.goalAmount > 0
    ? Math.min(Math.max(campaign.raisedAmount / campaign.goalAmount, 0), 1)
    : 0;
  const remaining = Math.max(campaign.goalAmount - campaign.raisedAmount, 0);
  const daysLeft = Math.max(0, Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86_400_000));
  const isOwner = currentUser?.id === campaign.creatorId._id;
  const canDonate = campaign.status === "active" && daysLeft > 0 && !isOwner;
  const isCompleted = campaign.status === "completed";
  const isClosed = campaign.status === "closed";
  const finalActionLabel = isCompleted
    ? "Goal reached"
    : isClosed
      ? "Campaign ended"
      : campaign.status === "flagged"
        ? "Campaign unavailable"
        : "Campaign closed";

  const shareCampaign = async () => {
    const link = Linking.createURL(`/fundraising/${campaign.shareSlug}`);
    try {
      await Share.share({ message: `Support ${campaign.title} on KasaFund: ${link}` });
    } catch (shareError) {
      Alert.alert("Could not share campaign", shareError instanceof Error ? shareError.message : "Please try again.");
    }
  };

  const donate = () => {
    if (!canDonate) return;
    guardKyc("make a donation", () => router.push({
      pathname: "/fundraising/[id]/donate",
      params: {
        id: campaign._id,
        campaignTitle: campaign.title,
        allowAnonymous: String(campaign.allowAnonymousDonations),
      },
    }));
  };

  const manageCampaign = (section: "details" | "update" = "details") => {
    router.push({
      pathname: "/fundraising/[id]/manage",
      params: { id: campaign._id, section },
    });
  };

  const reportCampaign = () => {
    if (isOwner) return;
    router.push({ pathname: "/fundraising/report", params: { id: campaign._id, title: campaign.title } });
  };

  const tabs: { key: ContentTab; label: string; count?: number }[] = [
    { key: "story", label: "Story" },
    { key: "updates", label: "Updates", count: updates.length },
    { key: "supporters", label: "Supporters", count: donations.length },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl onRefresh={() => void loadCampaign(true)} refreshing={refreshing} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground
          imageStyle={styles.heroImage}
          source={campaign.coverImageUrl ? { uri: campaign.coverImageUrl } : undefined}
          style={styles.hero}
        >
          <View style={styles.heroShade} />
          <SafeAreaView edges={["top"]} style={styles.heroSafeArea}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity accessibilityLabel="Go back" hitSlop={8} onPress={() => router.back()} style={styles.heroButton}>
                <Ionicons name="arrow-back" size={22} color={kasaColors.white} />
              </TouchableOpacity>
              <View style={styles.heroActions}><TouchableOpacity accessibilityLabel="Share campaign" hitSlop={8} onPress={() => void shareCampaign()} style={styles.heroButton}><Ionicons name="share-outline" size={20} color={kasaColors.white}/></TouchableOpacity>{!isOwner && <TouchableOpacity accessibilityHint="Opens a confidential safety report form" accessibilityLabel="Report campaign" hitSlop={8} onPress={reportCampaign} style={styles.heroButton}><Ionicons name="flag-outline" size={20} color={kasaColors.white}/></TouchableOpacity>}</View>
            </View>
            <View style={styles.heroBottom}>
              <View style={styles.categoryBadge}>
                <Ionicons name="heart" size={12} color={kasaColors.white} />
                <Text style={styles.categoryText}>{categoryLabel(campaign.category)}</Text>
              </View>
              {isOwner && <View style={styles.ownerBadge}><Text style={styles.ownerBadgeText}>Your campaign</Text></View>}
            </View>
          </SafeAreaView>
        </ImageBackground>

        <View style={styles.body}>
          <View style={styles.headingRow}>
            <Text style={styles.title}>{campaign.title}</Text>
            <KasaStatusBadge
              compact
              icon={campaign.status === "flagged" ? "flag-outline" : undefined}
              label={campaign.status === "active" ? "Open" : categoryLabel(campaign.status)}
              tone={campaign.status === "flagged" ? "danger" : campaign.status === "active" ? "success" : campaign.status === "completed" ? "info" : "neutral"}
            />
          </View>
          <Pressable
            accessibilityHint="Opens the organizer's public profile"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/users/[id]", params: { id: campaign.creatorId._id } })}
            style={({ pressed }) => [styles.organizerRow, pressed && styles.rowPressed]}
          >
            <Avatar name={campaign.creatorId.fullName} imageUrl={campaign.creatorId.avatarUrl} />
            <View style={styles.organizerCopy}>
              <Text style={styles.organizerLabel}>CAMPAIGN ORGANIZER</Text>
              <Text style={styles.organizerName}>{campaign.creatorId.fullName}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </Pressable>

          {isCompleted || isClosed ? (
            <View style={[styles.lifecycleNotice, isCompleted ? styles.completedNotice : styles.closedNotice]}>
              <View style={[styles.lifecycleIcon, isCompleted ? styles.completedIcon : styles.closedIcon]}>
                <Ionicons
                  color={isCompleted ? COLORS.primary : COLORS.textMuted}
                  name={isCompleted ? "checkmark-circle-outline" : "time-outline"}
                  size={22}
                />
              </View>
              <View style={styles.lifecycleCopy}>
                <Text style={styles.lifecycleTitle}>{isCompleted ? "Fundraising goal reached" : "This campaign has ended"}</Text>
                <Text style={styles.lifecycleText}>
                  {isCompleted
                    ? "The goal was achieved and this campaign is no longer accepting donations."
                    : "The deadline passed. The story, updates, and supporter history remain available."}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.fundingCard}>
            <View style={styles.amountRow}>
              <View>
                <Text style={styles.raisedAmount}>{money(campaign.raisedAmount)}</Text>
                <Text style={styles.goalText}>raised of {money(campaign.goalAmount)} goal</Text>
              </View>
              <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{campaign.donorCount}</Text>
                <Text style={styles.statLabel}>supporters</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{isCompleted ? "Funded" : isClosed ? "Ended" : daysLeft}</Text>
                <Text style={styles.statLabel}>{isCompleted ? "goal status" : isClosed ? "time status" : "days left"}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text numberOfLines={1} style={styles.statValue}>{money(remaining)}</Text>
                <Text style={styles.statLabel}>{isCompleted ? "goal gap" : isClosed ? "short of goal" : "still needed"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tabs}>
            {tabs.map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={({ pressed }) => [styles.tab, selected && styles.tabActive, pressed && styles.tabPressed]}
                >
                  <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}{tab.count ? ` ${tab.count}` : ""}</Text>
                </Pressable>
              );
            })}
          </View>

          {activeTab === "story" && (
            <View>
              <Text style={styles.sectionTitle}>About this campaign</Text>
              <Text style={styles.story}>{campaign.description}</Text>
              {!!comments.length && (
                <>
                  <Text style={[styles.sectionTitle, styles.supportTitle]}>Words of support</Text>
                  {comments.slice(0, 3).map((comment) => (
                    <View key={comment._id} style={styles.commentCard}>
                      <Avatar name={comment.authorId.fullName} imageUrl={comment.authorId.avatarUrl} size={36} />
                      <View style={styles.commentCopy}>
                        <Text style={styles.commentName}>{comment.authorId.fullName}</Text>
                        <Text style={styles.commentText}>{comment.content}</Text>
                        <Text style={styles.commentTime}>{relativeTime(comment.createdAt)}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          {activeTab === "updates" && (
            <View>
              {isOwner && (
                <TouchableOpacity activeOpacity={0.85} onPress={() => manageCampaign("update")} style={styles.postUpdateButton}>
                  <View style={styles.postUpdateIcon}>
                    <Ionicons name="megaphone-outline" size={18} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postUpdateTitle}>Post a campaign update</Text>
                    <Text style={styles.postUpdateText}>Share progress with your supporters</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
              {updates.length ? updates.map((update) => (
                <View key={update._id} style={styles.updateCard}>
                  <View style={styles.updateTopRow}>
                    <View style={styles.updateIcon}><Ionicons name="megaphone-outline" size={18} color={COLORS.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.updateTitle}>Campaign update</Text>
                      <Text style={styles.commentTime}>{relativeTime(update.createdAt)}</Text>
                    </View>
                  </View>
                  <Text style={styles.updateText}>{update.content}</Text>
                </View>
              )) : <KasaStateView icon="megaphone-outline" kind="empty" message="Updates from the organizer will appear here." style={styles.emptyTab} title="No updates yet" />}
            </View>
          )}

          {activeTab === "supporters" && (
            <View>
              {donations.length ? donations.map((donation) => (
                <View key={donation._id} style={styles.supporterRow}>
                  <View style={styles.supporterAvatar}><Ionicons name={donation.isAnonymous ? "person-outline" : "heart"} size={17} color={COLORS.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commentName}>{donation.isAnonymous ? "Anonymous" : donation.displayName}</Text>
                    <Text style={styles.commentTime}>{relativeTime(donation.createdAt)}</Text>
                  </View>
                  <Text style={styles.donationAmount}>{money(donation.amount)}</Text>
                </View>
              )) : <KasaStateView icon="heart-outline" kind="empty" message="Donations will appear here after payment is confirmed." style={styles.emptyTab} title="Be the first supporter" />}
            </View>
          )}
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => void shareCampaign()} style={styles.shareButton}>
          <Ionicons name="share-social-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <KasaButton
          disabled={!isOwner && !canDonate}
          label={isOwner ? "Manage campaign" : canDonate ? "Donate now" : finalActionLabel}
          leftIcon={<Ionicons name={isOwner ? "settings-outline" : isCompleted ? "checkmark-circle-outline" : isClosed ? "time-outline" : "heart"} size={18} color={kasaColors.white} />}
          onPress={() => isOwner ? manageCampaign() : donate()}
          style={styles.donateButton}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },
  scrollContent: { paddingBottom: 105 },
  centerState: { alignItems: "center", backgroundColor: COLORS.background, flex: 1, justifyContent: "center", paddingHorizontal: 30 },
  hero: { backgroundColor: COLORS.primaryDark, height: 290 },
  heroImage: { resizeMode: "cover" },
  heroShade: { backgroundColor: "rgba(3,25,20,0.38)", ...StyleSheet.absoluteFillObject },
  heroSafeArea: { flex: 1, justifyContent: "space-between", paddingBottom: 20, paddingHorizontal: 18 },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8 },
  heroActions: { flexDirection: "row", gap: 9 },
  heroButton: { alignItems: "center", backgroundColor: "rgba(7,55,44,0.72)", borderColor: "rgba(255,255,255,0.22)", borderRadius: kasaRadii.md, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  heroBottom: { alignItems: "center", flexDirection: "row", gap: 8 },
  categoryBadge: { alignItems: "center", backgroundColor: "rgba(7,55,44,0.78)", borderRadius: kasaRadii.pill, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 7 },
  categoryText: { color: kasaColors.white, fontSize: 11, fontWeight: "700" },
  ownerBadge: { backgroundColor: COLORS.accent, borderRadius: kasaRadii.pill, paddingHorizontal: 11, paddingVertical: 7 },
  ownerBadgeText: { color: COLORS.primaryDark, fontSize: 10, fontWeight: "800" },
  body: { paddingHorizontal: kasaLayout.screenInset, paddingTop: kasaSpacing.xxl },
  headingRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  title: { color: COLORS.text, flex: 1, fontSize: 27, fontWeight: "800", letterSpacing: -0.7, lineHeight: 34 },
  organizerRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", marginTop: kasaSpacing.lg, paddingBottom: kasaSpacing.lg },
  rowPressed: { opacity: 0.72 },
  organizerCopy: { flex: 1, marginLeft: 10 },
  organizerLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.55 },
  organizerName: { color: COLORS.text, fontSize: 14, fontWeight: "700", marginTop: 3 },
  lifecycleNotice: { alignItems: "flex-start", borderRadius: kasaRadii.lg, borderWidth: 1, flexDirection: "row", marginTop: kasaSpacing.lg, padding: 14 },
  completedNotice: { backgroundColor: kasaColors.brandSoft, borderColor: "#CFE3DB" },
  closedNotice: { backgroundColor: kasaColors.surfaceMuted, borderColor: COLORS.border },
  lifecycleIcon: { alignItems: "center", borderRadius: 12, height: 42, justifyContent: "center", marginRight: 11, width: 42 },
  completedIcon: { backgroundColor: COLORS.surface },
  closedIcon: { backgroundColor: COLORS.surface },
  lifecycleCopy: { flex: 1 },
  lifecycleTitle: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  lifecycleText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  avatarFallback: { alignItems: "center", backgroundColor: COLORS.primary, justifyContent: "center" },
  avatarInitial: { color: kasaColors.white, fontSize: 12, fontWeight: "800" },
  fundingCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: kasaRadii.lg, borderWidth: 1, marginTop: kasaSpacing.xl, padding: kasaSpacing.lg },
  amountRow: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" },
  raisedAmount: { color: COLORS.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  goalText: { color: COLORS.textMuted, ...kasaType.caption, marginTop: 3 },
  progressText: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  progressTrack: { backgroundColor: kasaColors.brandSoft, borderRadius: 4, height: 7, marginTop: 15, overflow: "hidden" },
  progressFill: { backgroundColor: COLORS.accent, borderRadius: 4, height: "100%" },
  statsRow: { alignItems: "center", flexDirection: "row", marginTop: 16 },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { color: COLORS.text, fontSize: 13, fontWeight: "800", maxWidth: 110, textTransform: "capitalize" },
  statLabel: { color: COLORS.textMuted, fontSize: 10, marginTop: 3 },
  statDivider: { backgroundColor: COLORS.border, height: 28, width: 1 },
  tabs: { borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", marginBottom: kasaSpacing.xxl, marginTop: kasaSpacing.xxl },
  tab: { alignItems: "center", flex: 1, minHeight: 44, paddingTop: 12 },
  tabActive: { borderBottomColor: COLORS.primary, borderBottomWidth: 2 },
  tabPressed: { opacity: 0.68 },
  tabText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  tabTextActive: { color: COLORS.primary, fontWeight: "800" },
  sectionTitle: { color: COLORS.text, marginBottom: 10, ...kasaType.sectionTitle },
  story: { color: COLORS.textMuted, fontSize: 14, lineHeight: 22 },
  supportTitle: { marginTop: 25 },
  commentCard: { alignItems: "flex-start", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", paddingVertical: 14 },
  commentCopy: { flex: 1, marginLeft: 10 },
  commentName: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  commentText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  commentTime: { color: COLORS.placeholder, fontSize: 9, marginTop: 5 },
  updateCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, marginBottom: 11, padding: 15 },
  updateTopRow: { alignItems: "center", flexDirection: "row" },
  updateIcon: { alignItems: "center", backgroundColor: "#E5F1ED", borderRadius: 11, height: 38, justifyContent: "center", marginRight: 10, width: 38 },
  updateTitle: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  updateText: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, marginTop: 12 },
  postUpdateButton: { alignItems: "center", backgroundColor: "#E8F5EE", borderRadius: 15, flexDirection: "row", marginBottom: 13, padding: 13 },
  postUpdateIcon: { alignItems: "center", backgroundColor: COLORS.background, borderRadius: 11, height: 39, justifyContent: "center", marginRight: 10, width: 39 },
  postUpdateTitle: { color: COLORS.primaryDark, fontSize: 13, fontWeight: "800" },
  postUpdateText: { color: COLORS.textMuted, fontSize: 10, marginTop: 3 },
  supporterRow: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", paddingVertical: 12 },
  supporterAvatar: { alignItems: "center", backgroundColor: "#E5F1ED", borderRadius: 18, height: 36, justifyContent: "center", marginRight: 10, width: 36 },
  donationAmount: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  emptyTab: { paddingVertical: 34 },
  footer: { alignItems: "center", backgroundColor: COLORS.surface, borderTopColor: COLORS.border, borderTopWidth: 1, bottom: 0, flexDirection: "row", gap: 10, left: 0, paddingHorizontal: kasaLayout.screenInset, paddingTop: 12, position: "absolute", right: 0 },
  shareButton: { alignItems: "center", borderColor: COLORS.border, borderRadius: kasaRadii.md, borderWidth: 1, height: 52, justifyContent: "center", width: 52 },
  donateButton: { flex: 1 },
});
