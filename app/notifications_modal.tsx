import { KasaStateView } from "@/components/ui";
import { kasaColors, kasaLayout, kasaRadii, kasaSpacing, kasaType } from "@/constants/design";
import { apiService, type ApiNotification } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: kasaColors.brand,
  background: kasaColors.background,
  surface: kasaColors.surface,
  border: kasaColors.border,
  text: kasaColors.text,
  textMuted: kasaColors.textMuted,
  accent: kasaColors.accent,
};

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString("en-GH", { day: "numeric", month: "short" });
}

function notificationIcon(type: ApiNotification["type"]): keyof typeof Ionicons.glyphMap {
  if (type === "invitation") return "people-outline";
  if (type === "join_request") return "person-add-outline";
  if (type === "debt_repayment") return "shield-checkmark-outline";
  if (type === "role_changed") return "shield-checkmark-outline";
  if (type === "payment_due" || type === "penalty_applied") return "time-outline";
  if (type === "payment_confirmed") return "checkmark-circle-outline";
  if (type === "contribution_refunded") return "return-down-back-outline";
  if (type === "payout_scheduled" || type === "payout_completed") return "cash-outline";
  if (type === "donation_received") return "heart-outline";
  if (type === "campaign_moderation") return "flag-outline";
  if (type === "report_update") return "shield-checkmark-outline";
  if (type === "identity_verification") return "finger-print-outline";
  if (type === "savings_update") return "leaf-outline";
  if (type === "resolution_created" || type === "resolution_completed") {
    return "checkmark-done-circle-outline";
  }
  return "megaphone-outline";
}

function notificationTone(type: ApiNotification["type"]) {
  if (type === "payment_confirmed" || type === "payout_completed" || type === "debt_repayment") {
    return { background: kasaColors.successSoft, foreground: kasaColors.success };
  }
  if (type === "payment_due" || type === "penalty_applied") {
    return { background: kasaColors.warningSoft, foreground: kasaColors.warning };
  }
  if (type === "donation_received" || type === "campaign_update") {
    return { background: "#FCEFF3", foreground: "#A33D60" };
  }
  if (type === "campaign_moderation") {
    return { background: kasaColors.warningSoft, foreground: kasaColors.warning };
  }
  if (type === "report_update") {
    return { background: kasaColors.infoSoft, foreground: kasaColors.info };
  }
  if (type === "identity_verification" || type === "role_changed") {
    return { background: kasaColors.infoSoft, foreground: kasaColors.info };
  }
  return { background: kasaColors.brandSoft, foreground: kasaColors.brand };
}

function notificationSection(value: string) {
  const now = new Date();
  const createdAt = new Date(value);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const createdDay = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
  const daysAgo = Math.floor((today.getTime() - createdDay.getTime()) / 86_400_000);
  if (daysAgo <= 0) return "Today";
  if (daysAgo <= 7) return "Earlier this week";
  return "Older";
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await apiService.getNotifications();
      setNotifications(response.data);
    } catch (error) {
      Alert.alert("Could not load notifications", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const openNotification = async (notification: ApiNotification) => {
    if (!notification.isRead) {
      setNotifications((items) =>
        items.map((item) => item._id === notification._id ? { ...item, isRead: true } : item)
      );
      try {
        await apiService.markNotificationRead(notification._id);
      } catch {
        setNotifications((items) =>
          items.map((item) => item._id === notification._id ? { ...item, isRead: false } : item)
        );
      }
    }

    const invitationTitle = notification.title.toLowerCase();
    const isInvitationResponse =
      invitationTitle.includes("accepted") || invitationTitle.includes("declined");
    const isNewInvitation = notification.type === "invitation" && !isInvitationResponse;
    const isDeclinedJoinRequest =
      notification.type === "join_request" && invitationTitle.includes("declined");

    if (isDeclinedJoinRequest) {
      Alert.alert(notification.title, notification.body, [
        { text: "Close", style: "cancel" },
        {
          text: "Browse other groups",
          onPress: () =>
            router.replace({
              pathname: "/(tabs)/groups",
              params: { tab: "discover" },
            }),
        },
      ]);
      return;
    }

    if (
      notification.type === "join_request" &&
      notification.relatedUserId &&
      notification.relatedGroupId
    ) {
      router.replace({
        pathname: "/users/[id]",
        params: {
          id: notification.relatedUserId,
          reviewGroupId: notification.relatedGroupId,
        },
      });
    } else if (notification.type === "debt_repayment") {
      router.replace("/(tabs)/wallet");
    } else if (notification.type === "identity_verification") {
      router.replace("/profile/identity-verification");
    } else if (notification.relatedSavingsPotId) {
      router.replace({ pathname: "/wallet/susu/[id]", params: { id: notification.relatedSavingsPotId } });
    } else if (notification.relatedCampaignId) {
      router.replace({ pathname: "/fundraising/[id]", params: { id: notification.relatedCampaignId } });
    } else if (isNewInvitation) {
      router.replace({ pathname: "/(tabs)/groups", params: { tab: "invitations" } });
    } else if (notification.relatedGroupId) {
      try {
        const access = await apiService.getGroupAccess(notification.relatedGroupId);
        if (!access.data.canView) {
          const suspended = access.data.reason === "suspended";
          Alert.alert(
            suspended ? "Group access suspended" : "Group unavailable",
            suspended
              ? "You can no longer open this group because your membership was suspended. Previous notifications remain in your account history."
              : "You no longer have access to this group.",
            suspended
              ? [
                  { text: "Close", style: "cancel" },
                  {
                    text: "View wallet",
                    onPress: () => router.replace("/(tabs)/wallet"),
                  },
                ]
              : [{ text: "Close" }]
          );
          return;
        }
        router.replace(`/groups/${notification.relatedGroupId}`);
      } catch (error) {
        Alert.alert(
          "Couldn’t open group",
          error instanceof Error ? error.message : "Please try again."
        );
      }
    }
  };

  const markAllRead = async () => {
    if (markingAll || !notifications.some((item) => !item.isRead)) return;
    setMarkingAll(true);
    try {
      await apiService.markAllNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      Alert.alert("Could not update notifications", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setMarkingAll(false);
    }
  };

  const sections = ["Today", "Earlier this week", "Older"]
    .map((title) => ({
      title,
      data: notifications.filter((notification) => notificationSection(notification.createdAt) === title),
    }))
    .filter((section) => section.data.length > 0);
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity hitSlop={8} onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={21} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{unreadCount ? `${unreadCount} unread` : "You’re up to date"}</Text>
        </View>
        <TouchableOpacity disabled={markingAll || !unreadCount} hitSlop={8} onPress={() => void markAllRead()} style={styles.markAllButton}>
          <Text style={[styles.markAll, !unreadCount && styles.markAllDisabled]}>{markingAll ? "Updating…" : "Mark all read"}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <KasaStateView kind="loading" title="Loading notifications" />
        </View>
      ) : (
        <SectionList
          contentContainerStyle={[styles.list, !notifications.length && styles.emptyList]}
          sections={sections}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              onRefresh={() => void loadNotifications(true)}
              refreshing={refreshing}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              accessibilityHint="Opens the related KasaFund activity"
              accessibilityLabel={`${item.isRead ? "Read" : "Unread"}: ${item.title}. ${item.body}`}
              activeOpacity={0.85}
              onPress={() => void openNotification(item)}
              style={[styles.notificationRow, !item.isRead && styles.unreadRow]}
            >
              <View style={[styles.iconWrap, { backgroundColor: notificationTone(item.type).background }]}>
                <Ionicons name={notificationIcon(item.type)} size={20} color={notificationTone(item.type).foreground} />
              </View>
              <View style={styles.notificationCopy}>
                <View style={styles.notificationTopRow}>
                  <Text numberOfLines={1} style={styles.notificationTitle}>{item.title}</Text>
                  <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
                </View>
                <Text style={styles.body}>{item.body}</Text>
              </View>
              {!item.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <KasaStateView icon="notifications-outline" kind="empty" message="Group invitations and important account activity will appear here." style={styles.centerState} title="You’re all caught up" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },
  header: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: kasaLayout.screenInset, paddingVertical: 14 },
  closeButton: { alignItems: "center", backgroundColor: kasaColors.surfaceMuted, borderRadius: kasaRadii.md, height: 44, justifyContent: "center", marginRight: 12, width: 44 },
  headerCopy: { flex: 1 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  subtitle: { color: COLORS.textMuted, marginTop: 3, ...kasaType.caption },
  markAllButton: { alignItems: "flex-end", justifyContent: "center", minHeight: 44, paddingLeft: 8 },
  markAll: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  markAllDisabled: { color: COLORS.textMuted, opacity: 0.55 },
  list: { paddingBottom: 35 },
  emptyList: { flexGrow: 1 },
  sectionTitle: { backgroundColor: COLORS.background, color: COLORS.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 0.2, paddingBottom: 8, paddingHorizontal: kasaLayout.screenInset, paddingTop: kasaSpacing.xl },
  notificationRow: { alignItems: "flex-start", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", paddingHorizontal: kasaLayout.screenInset, paddingVertical: 14 },
  unreadRow: { backgroundColor: "#F1F7F4" },
  iconWrap: { alignItems: "center", borderRadius: kasaRadii.md, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  notificationCopy: { flex: 1 },
  notificationTopRow: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  notificationTitle: { color: COLORS.text, flex: 1, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  time: { color: COLORS.textMuted, fontSize: 10 },
  body: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  unreadDot: { backgroundColor: COLORS.primary, borderRadius: 4, height: 7, marginLeft: 9, marginTop: 5, width: 7 },
  centerState: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 35 },
});
