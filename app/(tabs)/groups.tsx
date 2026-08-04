import { GroupAgreementModal } from "@/components/groups/GroupAgreementModal";
import { KasaButton, KasaStateView, KasaStatusBadge } from "@/components/ui";
import { kasaColors, kasaLayout, kasaRadii, kasaSpacing, kasaType } from "@/constants/design";
import { useKycGate } from "@/hooks/useKycGate";
import {
  apiService,
  type ApiGroup,
  type ApiGroupInvitation,
} from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
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
  success: "#1E8E5A",
  warning: "#D89A2B",
  error: "#C0392B",
};

type TabKey = "my-groups" | "discover" | "invitations";

type Group = {
  id: string;
  name: string;
  type: string;
  coverColor: string;
  coverImageUrl?: string;
  memberCount: number;
  progress: number; // 0–1
  potAmount: string;
  status: ApiGroup["status"];
  unreadChatCount: number;
};

function formatMoney(amountInPesewas: number) {
  return `GH₵ ${(amountInPesewas / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function mapGroup(group: ApiGroup): Group {
  const target = group.contribution.amount * Math.max(group.memberCount, 1);
  return {
    id: group._id,
    name: group.name,
    type: `${group.type} · ${group.contribution.frequency}`,
    coverColor: {
      susu: "#0B4D3E",
      family: "#8A5E2B",
      church: "#5B4A8A",
      cooperative: "#2B5B8A",
      other: "#576460",
    }[group.type],
    coverImageUrl: group.coverImageUrl,
    memberCount: group.memberCount,
    progress: target ? Math.min(group.totalPot / target, 1) : 0,
    potAmount: formatMoney(group.totalPot),
    status: group.status,
    unreadChatCount: group.unreadChatCount || 0,
  };
}

function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  const progress = Number.isFinite(group.progress) ? Math.min(Math.max(group.progress, 0), 1) : 0;
  return (
    <TouchableOpacity style={styles.groupCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.groupCover, { backgroundColor: group.coverColor }]}> 
        {group.coverImageUrl ? (
          <ExpoImage cachePolicy="memory-disk" contentFit="cover" source={group.coverImageUrl} style={styles.groupCoverImage} />
        ) : (
          <Ionicons name="people" size={20} color="rgba(255,255,255,0.9)" />
        )}
        {!!group.unreadChatCount && (
          <View style={styles.groupChatBadge}>
            <Text style={styles.groupChatBadgeText}>{Math.min(group.unreadChatCount, 99)}</Text>
          </View>
        )}
      </View>

      <View style={styles.groupCardBody}>
        <View style={styles.groupCardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupName} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={styles.groupType}>{group.type}</Text>
          </View>
          <KasaStatusBadge
            compact
            label={group.status.charAt(0).toUpperCase() + group.status.slice(1)}
            tone={group.status === "active" ? "success" : group.status === "paused" ? "warning" : "neutral"}
          />
        </View>

        <View style={styles.groupCardBottom}>
          <View style={styles.memberCountWrap}>
            <Ionicons color={COLORS.textMuted} name="people-outline" size={14} />
            <Text style={styles.memberCountText}>{group.memberCount} members</Text>
          </View>
          <View style={styles.groupStats}>
            <Text style={styles.potAmount}>{group.potAmount}</Text>
            <Text style={styles.payoutDate}>Group balance</Text>
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{Math.round(progress * 100)}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DiscoverCard({
  group,
  joining,
  onJoin,
}: {
  group: ApiGroup;
  joining: boolean;
  onJoin: () => void;
}) {
  const requestLocked =
    group.joinRequestStatus === "pending" ||
    group.joinRequestStatus === "declined";
  return (
    <View style={styles.discoverCard}>
      <View style={styles.discoverIconWrap}>
        {group.coverImageUrl ? (
          <ExpoImage cachePolicy="memory-disk" contentFit="cover" source={group.coverImageUrl} style={styles.discoverImage} />
        ) : <Ionicons name="people-outline" size={22} color={COLORS.primary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.groupName} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.groupType}>
          {group.type} · {group.memberCount} members
        </Text>
        <Text style={styles.discoverAmount}>
          {formatMoney(group.contribution.amount)} / {group.contribution.frequency}
        </Text>
      </View>
      <KasaButton
        disabled={requestLocked}
        fullWidth={false}
        label={group.joinRequestStatus === "pending" ? "Requested" : group.joinRequestStatus === "declined" ? "Declined" : group.joinRequestStatus === "agreement_required" ? "Review" : "Request"}
        loading={joining}
        onPress={onJoin}
        size="compact"
        style={styles.joinButton}
        variant={requestLocked ? "secondary" : "primary"}
      />
    </View>
  );
}

function InvitationCard({
  invite,
  responding,
  onRespond,
}: {
  invite: ApiGroupInvitation;
  responding: boolean;
  onRespond: (accept: boolean) => void;
}) {
  return (
    <View style={styles.inviteCard}>
      <View style={styles.discoverIconWrap}>
        {invite.groupId.coverImageUrl ? (
          <ExpoImage cachePolicy="memory-disk" contentFit="cover" source={invite.groupId.coverImageUrl} style={styles.discoverImage} />
        ) : <Ionicons name="mail-open-outline" size={22} color={COLORS.primary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.groupName} numberOfLines={1}>
          {invite.groupId.name}
        </Text>
        <Text style={styles.groupType}>Invited by {invite.invitedBy.fullName}</Text>
        <Text style={styles.discoverAmount}>
          {formatMoney(invite.groupId.contribution.amount)} / {invite.groupId.contribution.frequency}
        </Text>
      </View>
      <View style={styles.inviteActions}>
        <TouchableOpacity
          disabled={responding}
          onPress={() => onRespond(true)}
          style={[styles.acceptButton, responding && styles.buttonDisabled]}
          activeOpacity={0.85}
        >
          {responding ? <ActivityIndicator color={kasaColors.white} size="small" /> : <Ionicons name="checkmark" size={17} color={kasaColors.white} />}
        </TouchableOpacity>
        <TouchableOpacity
          disabled={responding}
          onPress={() => onRespond(false)}
          style={[styles.declineButton, responding && styles.buttonDisabled]}
          activeOpacity={0.85}
        >
          <Ionicons name="close" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function GroupsScreen() {
  const { ensureKyc, guardKyc } = useKycGate();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>("my-groups");
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [discoverGroups, setDiscoverGroups] = useState<ApiGroup[]>([]);
  const [invitations, setInvitations] = useState<ApiGroupInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [agreementTarget, setAgreementTarget] = useState<
    | { type: "public"; group: ApiGroup }
    | { type: "invitation"; invitation: ApiGroupInvitation }
    | null
  >(null);

  const loadGroups = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [mine, discover, invites] = await Promise.all([
        apiService.getMyGroups(),
        apiService.discoverGroups(),
        apiService.getGroupInvitations(),
      ]);
      setMyGroups(mine.data.map(mapGroup));
      setDiscoverGroups(discover.data);
      setInvitations(invites.data);
    } catch (error) {
      Alert.alert("Could not load groups", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (tab === "my-groups" || tab === "discover" || tab === "invitations") {
      setActiveTab(tab);
    }
  }, [tab]);

  const joinGroup = async (group: ApiGroup) => {
    if (!ensureKyc("join a savings group")) return;
    setAgreementTarget({ type: "public", group });
  };

  const submitJoinRequest = async (group: ApiGroup) => {
    try {
      setBusyId(group._id);
      setAgreementTarget(null);
      const response = await apiService.joinPublicGroup(group._id, true);
      await loadGroups(true);
      Alert.alert(
        "Request sent",
        response.message || `The owner of ${group.name} will review your profile.`
      );
    } catch (error) {
      Alert.alert("Could not join group", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const respondToInvite = async (
    invite: ApiGroupInvitation,
    accept: boolean,
    agreementAccepted = false
  ) => {
    if (accept && !ensureKyc("accept a group invitation")) return;
    if (accept && !agreementAccepted) {
      setAgreementTarget({ type: "invitation", invitation: invite });
      return;
    }
    const respond = async () => {
      try {
        setBusyId(invite._id);
        setAgreementTarget(null);
        await apiService.respondToGroupInvitation(
          invite._id,
          accept,
          agreementAccepted
        );
        await loadGroups(true);
        if (accept) {
          setActiveTab("my-groups");
          Alert.alert("Invitation accepted", `You joined ${invite.groupId.name}.`);
        }
      } catch (error) {
        Alert.alert("Could not update invitation", error instanceof Error ? error.message : "Please try again.");
      } finally {
        setBusyId(null);
      }
    };

    if (accept) {
      await respond();
      return;
    }
    Alert.alert("Decline invitation?", `You will decline the invitation to ${invite.groupId.name}.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Decline", style: "destructive", onPress: () => void respond() },
    ]);
  };

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "my-groups", label: "My Groups" },
    { key: "discover", label: "Discover" },
    { key: "invitations", label: "Invitations", badge: invitations.length },
  ];

  const refreshControl = (
    <RefreshControl
      colors={[COLORS.primary]}
      onRefresh={() => loadGroups(true)}
      refreshing={refreshing}
      tintColor={COLORS.primary}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Groups</Text>
          <Text style={styles.headerSubtitle}>Save together, with clarity</Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => guardKyc("create a savings group", () => router.push("/create_group_modal"))}
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
              <Text
                style={[styles.segmentText, isActive && styles.segmentTextActive]}
              >
                {tab.label}
              </Text>
              {!!tab.badge && (
                <View style={styles.segmentBadge}>
                  <Text style={styles.segmentBadgeText}>{tab.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === "my-groups" && (
        <FlatList
          data={myGroups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          renderItem={({ item }) => (
            <GroupCard
              group={item}
              onPress={() => router.push(`/groups/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <KasaStateView
              actionLabel="Create a group"
              icon="people-outline"
              kind="empty"
              message="Create a Susu group or join one to start tracking contributions together."
              onAction={() => guardKyc("create a savings group", () => router.push("/create_group_modal"))}
              style={styles.emptyState}
              title="No groups yet"
            />
          }
        />
      )}

      {activeTab === "discover" && (
        <FlatList
          data={discoverGroups}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          renderItem={({ item }) => (
            <DiscoverCard
              group={item}
              joining={busyId === item._id}
              onJoin={() => void joinGroup(item)}
            />
          )}
          ListEmptyComponent={
            <KasaStateView
              icon="compass-outline"
              kind="empty"
              message="Public groups you can join will show up here."
              style={styles.emptyState}
              title="Nothing to discover yet"
            />
          }
        />
      )}

      {activeTab === "invitations" && (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          renderItem={({ item }) => (
            <InvitationCard
              invite={item}
              responding={busyId === item._id}
              onRespond={(accept) => void respondToInvite(item, accept)}
            />
          )}
          ListEmptyComponent={
            <KasaStateView
              icon="mail-open-outline"
              kind="empty"
              message="When someone invites you to a group, it’ll show up here."
              style={styles.emptyState}
              title="No pending invitations"
            />
          }
        />
      )}
      {loading && (
        <View style={styles.loadingOverlay}>
          <KasaStateView kind="loading" title="Loading groups" />
        </View>
      )}
      <GroupAgreementModal
        group={
          agreementTarget?.type === "public"
            ? agreementTarget.group
            : agreementTarget?.type === "invitation"
              ? agreementTarget.invitation.groupId
              : null
        }
        onAccept={() => {
          if (agreementTarget?.type === "public") {
            void submitJoinRequest(agreementTarget.group);
          } else if (agreementTarget?.type === "invitation") {
            void respondToInvite(agreementTarget.invitation, true, true);
          }
        }}
        onClose={() => setAgreementTarget(null)}
        visible={Boolean(agreementTarget)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingTop: 12,
    gap: 6,
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
  segmentBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  segmentBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: kasaColors.white,
  },

  listContent: {
    paddingHorizontal: kasaLayout.screenInset,
    paddingBottom: 120,
    gap: 14,
  },

  // Group card
  groupCard: {
    flexDirection: "row",
    borderRadius: kasaRadii.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  groupCover: {
    width: 82,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  groupCoverImage: { ...StyleSheet.absoluteFillObject },
  groupChatBadge: { alignItems: "center", backgroundColor: COLORS.error, borderColor: kasaColors.white, borderRadius: 10, borderWidth: 2, height: 21, justifyContent: "center", minWidth: 21, paddingHorizontal: 4, position: "absolute", right: 6, top: 6 },
  groupChatBadgeText: { color: kasaColors.white, fontSize: 9, fontWeight: "800" },
  groupCardBody: {
    flex: 1,
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 10,
  },
  groupCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  groupName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  groupType: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  groupCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberCountWrap: { alignItems: "center", flexDirection: "row", gap: 5 },
  memberCountText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  groupStats: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  potAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  payoutDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  progressRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  progressTrack: { backgroundColor: kasaColors.brandSoft, borderRadius: 2, flex: 1, height: 4, overflow: "hidden" },
  progressFill: { backgroundColor: COLORS.accent, borderRadius: 2, height: "100%" },
  progressLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: "700", minWidth: 26, textAlign: "right" },

  // Discover card
  discoverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: kasaRadii.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  discoverIconWrap: {
    width: 52,
    height: 52,
    borderRadius: kasaRadii.md,
    backgroundColor: kasaColors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  discoverImage: { height: "100%", width: "100%" },
  discoverAmount: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 3,
  },
  joinButton: { minWidth: 86, paddingHorizontal: 12 },
  buttonDisabled: {
    opacity: 0.55,
  },
  loadingOverlay: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },

  // Invitation card
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: kasaRadii.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inviteActions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    width: 44,
    height: 44,
    borderRadius: kasaRadii.md,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: {
    width: 44,
    height: 44,
    borderRadius: kasaRadii.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingTop: 64,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyCta: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  emptyCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.background,
  },
});
