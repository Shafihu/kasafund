import { KasaSectionHeader, KasaStateView, KasaStatusBadge } from "@/components/ui";
import { kasaColors, kasaLayout, kasaRadii, kasaSpacing, kasaType } from "@/constants/design";
import { useKycGate } from "@/hooks/useKycGate";
import { apiService, type ApiCampaign, type ApiDonatedCampaign } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
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
  success: "#1E8E5A",
  successSurface: "#E8F5EE",
  warning: "#D89A2B",
  error: "#C0392B",
};

type TabKey = "my-campaigns" | "explore" | "donated";

type Campaign = {
  id: string;
  title: string;
  category: string;
  coverColor: string;
  coverImageUrl?: string;
  raised: number;
  goal: number;
  donorCount: number;
  daysLeft: number;
  isUrgent?: boolean;
  status: ApiCampaign["status"];
};

type DonatedCampaign = {
  donationId: string;
  id: string;
  title: string;
  category: string;
  coverColor: string;
  coverImageUrl?: string;
  amountDonated: string;
  date: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  medical: "#0B4D3E",
  funeral: "#626965",
  wedding: "#8A5E2B",
  school_fees: "#5B4A8A",
  charity: "#8A5E2B",
  community: "#2B5B8A",
  disaster_relief: "#A25B32",
  business: "#5B4A8A",
  other: "#576460",
};

function categoryLabel(category: string) {
  return category.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function mapCampaign(campaign: ApiCampaign): Campaign {
  return {
    id: campaign._id,
    title: campaign.title,
    category: categoryLabel(campaign.category),
    coverColor: CATEGORY_COLORS[campaign.category] || COLORS.primary,
    coverImageUrl: campaign.coverImageUrl,
    raised: campaign.raisedAmount / 100,
    goal: campaign.goalAmount / 100,
    donorCount: campaign.donorCount,
    daysLeft: Math.max(0, Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86_400_000)),
    isUrgent: Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86_400_000) <= 7,
    status: campaign.status,
  };
}

function mapDonation(donation: ApiDonatedCampaign): DonatedCampaign {
  return {
    donationId: donation._id,
    id: donation.campaignId._id,
    title: donation.campaignId.title,
    category: categoryLabel(donation.campaignId.category),
    coverColor: CATEGORY_COLORS[donation.campaignId.category] || COLORS.primary,
    coverImageUrl: donation.campaignId.coverImageUrl,
    amountDonated: `GH₵ ${(donation.amount / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`,
    date: new Date(donation.createdAt).toLocaleDateString("en-GH", { day: "numeric", month: "short" }),
  };
}

function ProgressBar({ progress }: { progress: number }) {
  const safeProgress = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${safeProgress * 100}%` }]} />
    </View>
  );
}

function FeaturedCard({ campaign, onPress, width }: { campaign: Campaign; onPress: () => void; width: number }) {
  const progress = campaign.goal > 0 ? campaign.raised / campaign.goal : 0;
  return (
    <TouchableOpacity style={[styles.featuredCard, { width }]} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.featuredCover, { backgroundColor: campaign.coverColor }]}>
        {campaign.coverImageUrl ? (
          <>
            <ExpoImage
              cachePolicy="memory-disk"
              contentFit="cover"
              source={campaign.coverImageUrl}
              style={styles.featuredCoverImage}
            />
            <View style={styles.featuredCoverShade} />
          </>
        ) : null}
        {campaign.isUrgent && (
          <View style={styles.urgentBadge}>
            <Ionicons name="flash" size={12} color={kasaColors.white} />
            <Text style={styles.urgentBadgeText}>Urgent</Text>
          </View>
        )}
        <View style={styles.featuredCategoryBadge}>
          <Text style={styles.featuredCategoryText}>{campaign.category}</Text>
        </View>
      </View>

      <View style={styles.featuredBody}>
        <Text style={styles.featuredTitle} numberOfLines={2}>
          {campaign.title}
        </Text>

        <ProgressBar progress={progress} />

        <View style={styles.featuredStatsRow}>
          <View>
            <Text style={styles.featuredRaised}>
              GH₵ {campaign.raised.toLocaleString()}
            </Text>
            <Text style={styles.featuredGoal}>
              raised of GH₵ {campaign.goal.toLocaleString()} goal
            </Text>
          </View>
          <View style={styles.featuredMetaRight}>
            <Text style={styles.featuredMetaValue}>{campaign.donorCount}</Text>
            <Text style={styles.featuredMetaLabel}>supporters</Text>
          </View>
          <View style={styles.featuredMetaRight}>
            <Text style={styles.featuredMetaValue}>{campaign.daysLeft}</Text>
            <Text style={styles.featuredMetaLabel}>days left</Text>
          </View>
        </View>

        <View style={styles.featuredActionRow}>
          <Text style={styles.featuredAction}>View campaign</Text>
          <Ionicons color={COLORS.primary} name="arrow-forward" size={17} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CampaignCard({ campaign, onPress }: { campaign: Campaign; onPress: () => void }) {
  const progress = campaign.goal > 0 ? campaign.raised / campaign.goal : 0;
  return (
    <TouchableOpacity style={styles.campaignCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.campaignThumb, { backgroundColor: campaign.coverColor }]}>
        {campaign.coverImageUrl ? (
          <ExpoImage
            cachePolicy="memory-disk"
            contentFit="cover"
            source={campaign.coverImageUrl}
            style={styles.thumbImage}
          />
        ) : (
          <Ionicons name="heart" size={18} color="rgba(255,255,255,0.9)" />
        )}
      </View>

      <View style={styles.campaignBody}>
        <View style={styles.campaignTopRow}>
          <Text style={styles.campaignCategory}>{campaign.category}</Text>
          {campaign.status === "flagged" ? (
            <KasaStatusBadge compact icon="flag-outline" label="Flagged" tone="danger" />
          ) : campaign.daysLeft <= 5 && (
            <View style={styles.daysLeftBadge}>
              <Text style={styles.daysLeftText}>{campaign.daysLeft}d left</Text>
            </View>
          )}
        </View>

        <Text style={styles.campaignTitle} numberOfLines={2}>
          {campaign.title}
        </Text>

        <ProgressBar progress={progress} />

        <View style={styles.campaignBottomRow}>
          <Text style={styles.campaignRaised}>
            GH₵ {campaign.raised.toLocaleString()}{" "}
            <Text style={styles.campaignGoal}>
              of GH₵ {campaign.goal.toLocaleString()}
            </Text>
          </Text>
          <Text style={styles.campaignDonors}>{campaign.donorCount} donors</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DonatedCard({ item, onPress }: { item: DonatedCampaign; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.donatedCard}>
      <View style={[styles.donatedThumb, { backgroundColor: item.coverColor }]}>
        {item.coverImageUrl ? (
          <ExpoImage
            cachePolicy="memory-disk"
            contentFit="cover"
            source={item.coverImageUrl}
            style={styles.thumbImage}
          />
        ) : (
          <Ionicons name="heart" size={16} color="rgba(255,255,255,0.9)" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.campaignTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.campaignCategory}>
          {item.category} · {item.date}
        </Text>
      </View>
      <Text style={styles.donatedAmount}>{item.amountDonated}</Text>
    </TouchableOpacity>
  );
}

export default function FundraisingScreen() {
  const { guardKyc } = useKycGate();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<TabKey>("explore");
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [exploreCampaigns, setExploreCampaigns] = useState<Campaign[]>([]);
  const [donatedCampaigns, setDonatedCampaigns] = useState<DonatedCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const loadCampaigns = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [mine, explore, donated] = await Promise.all([
        apiService.getCampaigns(true),
        apiService.getCampaigns(),
        apiService.getDonatedCampaigns(),
      ]);
      setMyCampaigns(mine.data.map(mapCampaign));
      setExploreCampaigns(explore.data.map(mapCampaign));
      setDonatedCampaigns(donated.data.filter((item) => item.campaignId).map(mapDonation));
    } catch (error) {
      Alert.alert("Could not load fundraising", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadCampaigns();
  }, [loadCampaigns]));

  const tabs: { key: TabKey; label: string }[] = [
    { key: "my-campaigns", label: "My Campaigns" },
    { key: "explore", label: "Explore" },
    { key: "donated", label: "Donated" },
  ];

  const refreshControl = (
    <RefreshControl onRefresh={() => void loadCampaigns(true)} refreshing={refreshing} tintColor={COLORS.primary} />
  );

  const featuredCampaigns = useMemo(() => exploreCampaigns.slice(0, 4), [exploreCampaigns]);
  const featuredIds = useMemo(() => new Set(featuredCampaigns.map((campaign) => campaign.id)), [featuredCampaigns]);
  const remainingCampaigns = useMemo(
    () => exploreCampaigns.filter((campaign) => !featuredIds.has(campaign.id)),
    [exploreCampaigns, featuredIds],
  );
  const featuredWidth = Math.min(screenWidth - 40, 390);
  const visibleFeaturedIndex = Math.min(featuredIndex, Math.max(featuredCampaigns.length - 1, 0));

  if (loading && !myCampaigns.length && !exploreCampaigns.length && !donatedCampaigns.length) {
    return (
      <SafeAreaView style={styles.loadingState}>
        <KasaStateView kind="loading" title="Loading campaigns" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Fundraising</Text>
          <Text style={styles.headerSubtitle}>Support causes that matter</Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => guardKyc("create a fundraiser", () => router.push("/create_campaign_modal"))}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color={kasaColors.white} />
        </TouchableOpacity>
      </View>

      {/* Segmented control */}
      <View style={styles.segmentWrap}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.segmentItem, isActive && styles.segmentItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === "explore" && (
        <FlatList
          data={remainingCampaigns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          ListHeaderComponent={featuredCampaigns.length ? (
            <View style={styles.exploreHeader}>
              <View style={styles.featuredHeading}>
                <Text style={styles.sectionTitle}>Featured campaigns</Text>
                <Text style={styles.featuredCount}>{visibleFeaturedIndex + 1} of {featuredCampaigns.length}</Text>
              </View>
              <FlatList
                data={featuredCampaigns}
                contentContainerStyle={styles.featuredListContent}
                decelerationRate="fast"
                horizontal
                keyExtractor={(item) => `featured-${item.id}`}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / (featuredWidth + 12));
                  setFeaturedIndex(Math.min(Math.max(nextIndex, 0), featuredCampaigns.length - 1));
                }}
                renderItem={({ item }) => (
                  <FeaturedCard
                    campaign={item}
                    onPress={() => router.push(`/fundraising/${item.id}`)}
                    width={featuredWidth}
                  />
                )}
                showsHorizontalScrollIndicator={false}
                snapToAlignment="start"
                snapToInterval={featuredWidth + 12}
                style={styles.featuredList}
                ItemSeparatorComponent={() => <View style={styles.featuredSeparator} />}
              />
              <View accessibilityLabel={`Featured campaign ${visibleFeaturedIndex + 1} of ${featuredCampaigns.length}`} style={styles.pageDots}>
                {featuredCampaigns.map((campaign, index) => (
                  <View key={campaign.id} style={[styles.pageDot, index === visibleFeaturedIndex && styles.pageDotActive]} />
                ))}
              </View>
              {remainingCampaigns.length ? <View style={styles.moreHeader}><KasaSectionHeader title="More campaigns" /></View> : null}
            </View>
          ) : null}
          renderItem={({ item }) => (
            <CampaignCard
              campaign={item}
              onPress={() => router.push(`/fundraising/${item.id}`)}
            />
          )}
          ListEmptyComponent={!featuredCampaigns.length ? <KasaStateView icon="compass-outline" kind="empty" message="Public campaigns will appear here once they are published." style={styles.emptyState} title="No campaigns to explore" /> : null}
        />
      )}

      {activeTab === "my-campaigns" && (
        <FlatList
          data={myCampaigns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          renderItem={({ item }) => (
            <CampaignCard
              campaign={item}
              onPress={() => router.push(`/fundraising/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <KasaStateView
              actionLabel="Start a campaign"
              icon="megaphone-outline"
              kind="empty"
              message="Start a fundraiser for a cause, emergency, or celebration."
              onAction={() => guardKyc("create a fundraiser", () => router.push("/create_campaign_modal"))}
              style={styles.emptyState}
              title="No campaigns yet"
            />
          }
        />
      )}

      {activeTab === "donated" && (
        <FlatList
          data={donatedCampaigns}
          keyExtractor={(item) => item.donationId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          renderItem={({ item }) => <DonatedCard item={item} onPress={() => router.push(`/fundraising/${item.id}`)} />}
          ListEmptyComponent={
            <KasaStateView
              icon="heart-outline"
              kind="empty"
              message="Campaigns you support will show up here."
              style={styles.emptyState}
              title="No donations yet"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingState: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    flex: 1,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: kasaLayout.screenInset,
    paddingTop: 10,
    paddingBottom: kasaSpacing.xl,
  },
  headerTitle: {
    ...kasaType.screenTitle,
    color: COLORS.text,
  },
  headerSubtitle: { color: COLORS.textMuted, marginTop: 3, ...kasaType.caption },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: kasaRadii.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // Segmented control
  segmentWrap: {
    flexDirection: "row",
    marginHorizontal: kasaLayout.screenInset,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    marginBottom: kasaSpacing.lg,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingTop: 12,
  },
  segmentItemActive: {
    borderBottomColor: COLORS.primary,
    borderBottomWidth: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  segmentTextActive: {
    color: COLORS.primary,
    fontWeight: "800",
  },

  listContent: {
    paddingHorizontal: kasaLayout.screenInset,
    paddingBottom: 120,
    gap: 14,
  },
  exploreHeader: { marginBottom: 2 },
  featuredHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: COLORS.text, ...kasaType.sectionTitle },
  featuredCount: { color: COLORS.textMuted, ...kasaType.caption },
  featuredList: { marginHorizontal: -kasaLayout.screenInset },
  featuredListContent: { paddingHorizontal: kasaLayout.screenInset },
  featuredSeparator: { width: 12 },
  pageDots: { alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 12 },
  pageDot: { backgroundColor: COLORS.border, borderRadius: 3, height: 5, width: 5 },
  pageDotActive: { backgroundColor: COLORS.primary, width: 18 },
  moreHeader: { marginTop: kasaSpacing.xxl },

  // Progress bar (shared)
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: kasaColors.brandSoft,
    overflow: "hidden",
    marginVertical: 10,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },

  // Featured card
  featuredCard: {
    borderRadius: kasaRadii.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 2,
  },
  featuredCover: {
    height: 164,
    padding: 14,
    justifyContent: "space-between",
    alignItems: "flex-start",
    overflow: "hidden",
  },
  featuredCoverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredCoverShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7,35,28,0.3)",
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.error,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 1,
  },
  urgentBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: kasaColors.white,
  },
  featuredCategoryBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 1,
  },
  featuredCategoryText: {
    fontSize: 11,
    fontWeight: "700",
    color: kasaColors.white,
  },
  featuredBody: {
    padding: 16,
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 23,
  },
  featuredStatsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  featuredRaised: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  featuredGoal: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  featuredMetaRight: {
    alignItems: "center",
  },
  featuredMetaValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  featuredMetaLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  featuredActionRow: { alignItems: "center", borderTopColor: COLORS.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingTop: 12 },
  featuredAction: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },

  // Regular campaign card
  campaignCard: {
    flexDirection: "row",
    borderRadius: kasaRadii.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  campaignThumb: {
    width: 92,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: {
    ...StyleSheet.absoluteFillObject,
  },
  campaignBody: {
    flex: 1,
    padding: 13,
  },
  campaignTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  campaignCategory: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 0.1,
  },
  daysLeftBadge: {
    backgroundColor: "#FBEAE8",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  daysLeftText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.error,
  },
  campaignTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    lineHeight: 19,
  },
  campaignBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  campaignRaised: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  campaignGoal: {
    fontSize: 12,
    fontWeight: "400",
    color: COLORS.textMuted,
  },
  campaignDonors: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Donated card
  donatedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  donatedThumb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  donatedAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Empty state
  emptyState: { minHeight: 330 },
});
