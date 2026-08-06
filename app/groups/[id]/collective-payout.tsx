import { AnimatedLoader, KasaButton, KasaCard, KasaMoneyInput, KasaStateView } from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { apiService, type ApiGroupDetail } from "@/services/apiService";
import { markGroupForRefresh } from "@/utils/group-refresh";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  brand: kasaColors.brand,
  brandStrong: kasaColors.brandStrong,
  background: kasaColors.background,
  surface: kasaColors.surface,
  border: kasaColors.border,
  text: kasaColors.text,
  muted: kasaColors.textMuted,
  success: kasaColors.success,
  successSoft: kasaColors.successSoft,
  danger: kasaColors.danger,
};

function money(amount = 0) {
  return `GH₵ ${(amount / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CollectivePayoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ApiGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [action, setAction] = useState<"propose" | "approve" | "reject" | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError("");
      const response = await apiService.getGroup(id);
      setData(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load the group goal.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading && !data) {
    return <View style={styles.center}><AnimatedLoader accessibilityLabel="Loading shared goal" /></View>;
  }
  if (!data || data.group.savingModel !== "collective_goal") {
    return <View style={styles.center}><KasaStateView actionLabel="Go back" kind="error" message={error || "This group does not use collective-goal payouts."} onAction={() => router.back()} title="Goal unavailable" /></View>;
  }

  const goal = data.group.collectiveGoal;
  const proposal = data.currentCollectiveProposal;
  const canManage = data.membership?.role === "owner" || data.membership?.role === "treasurer";
  const goalReached = goal?.status === "target_reached";
  const progress = goal?.targetAmount ? Math.min(goal.totalSaved / goal.targetAmount, 1) : 0;

  const submitProposal = async () => {
    if (!id || action) return;
    const pesewas = Math.round(Number(amount) * 100);
    if (!recipientId || !Number.isInteger(pesewas) || pesewas < 1 || pesewas > data.group.totalPot || purpose.trim().length < 5) {
      Alert.alert("Check the proposal", "Choose a recipient, enter an available amount, and explain the payout in at least 5 characters.");
      return;
    }
    try {
      setAction("propose");
      await apiService.createCollectivePayoutProposal(id, { recipientId, amount: pesewas, purpose: purpose.trim() });
      markGroupForRefresh(id);
      await load();
      setAmount("");
      setPurpose("");
      setRecipientId("");
    } catch (requestError) {
      Alert.alert("Could not open vote", requestError instanceof Error ? requestError.message : "Please try again.");
    } finally {
      setAction(null);
    }
  };

  const vote = async (choice: "approve" | "reject") => {
    if (!id || !proposal || action) return;
    try {
      setAction(choice);
      const response = await apiService.voteOnCollectivePayout(id, proposal._id, choice);
      markGroupForRefresh(id);
      await load();
      Alert.alert(choice === "approve" ? "Approval recorded" : "Vote recorded", response.message || "Your vote has been saved.");
    } catch (requestError) {
      Alert.alert("Could not record vote", requestError instanceof Error ? requestError.message : "Please try again.");
    } finally {
      setAction(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Shared goal</Text>
          <Text style={styles.headerSubtitle}>{data.group.name}</Text>
        </View>
        <View style={styles.secureBadge}><Ionicons name="shield-checkmark" size={16} color={COLORS.brand} /></View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]} showsVerticalScrollIndicator={false}>
        <KasaCard style={styles.goalCard}>
          <View style={styles.goalTopRow}>
            <View><Text style={styles.eyebrow}>GROUP PROGRESS</Text><Text style={styles.goalStatus}>{goal?.status === "saving" ? "Saving in progress" : goal?.status === "target_reached" ? "Target reached" : "Goal completed"}</Text></View>
            <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
          </View>
          <Text style={styles.savedAmount}>{money(goal?.totalSaved)}</Text>
          <Text style={styles.targetCopy}>saved toward {money(goal?.targetAmount)}</Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
          <View style={styles.balanceRow}><Text style={styles.balanceLabel}>Available group balance</Text><Text style={styles.balanceValue}>{money(data.group.totalPot)}</Text></View>
        </KasaCard>

        {proposal ? (
          <KasaCard style={styles.voteCard}>
            <View style={styles.voteHeader}>
              <View style={styles.voteIcon}><Ionicons name="people" size={21} color="#6D4BC3" /></View>
              <View style={{ flex: 1 }}><Text style={styles.voteTitle}>Payout vote open</Text><Text style={styles.voteMeta}>Closes {new Date(proposal.expiresAt).toLocaleString("en-GH", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text></View>
            </View>
            <View style={styles.proposalAmountRow}><View><Text style={styles.smallLabel}>AMOUNT</Text><Text style={styles.proposalAmount}>{money(proposal.amount)}</Text></View><View style={{ alignItems: "flex-end", flex: 1 }}><Text style={styles.smallLabel}>RECIPIENT</Text><Text style={styles.recipientName}>{proposal.recipient?.fullName || "Member"}</Text></View></View>
            <Text style={styles.purpose}>{proposal.purpose}</Text>
            <View style={styles.approvalRow}><Text style={styles.approvalText}>{proposal.yesVotes} of {proposal.requiredYesVotes} approvals</Text><Text style={styles.rejectedText}>{proposal.noVotes} rejected</Text></View>
            <View style={styles.voteTrack}><View style={[styles.voteFill, { width: `${Math.min(proposal.yesVotes / proposal.requiredYesVotes, 1) * 100}%` }]} /></View>
            {proposal.canVote ? <View style={styles.actions}>
              <KasaButton disabled={!!action} label={action === "reject" ? "Submitting…" : "Reject"} loading={action === "reject"} onPress={() => void vote("reject")} style={styles.rejectButton} variant="secondary" />
              <KasaButton disabled={!!action} label={action === "approve" ? "Approving…" : "Approve"} loading={action === "approve"} onPress={() => void vote("approve")} style={styles.approveButton} />
            </View> : <View style={styles.recorded}><Ionicons name="checkmark-circle" size={17} color={COLORS.success} /><Text style={styles.recordedText}>{proposal.currentUserVote ? `Your vote: ${proposal.currentUserVote === "approve" ? "Approve" : "Reject"}` : "You can follow this vote here"}</Text></View>}
          </KasaCard>
        ) : goalReached && canManage ? (
          <View>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Propose a payout</Text><Text style={styles.sectionCopy}>Members will review these exact details before voting.</Text></View>
            <KasaCard style={styles.formCard}>
              <KasaMoneyInput label="Payout amount" onChangeText={setAmount} value={amount} />
              <Text style={styles.availableHint}>Up to {money(data.group.totalPot)} available</Text>
              <Text style={styles.inputLabel}>Recipient</Text>
              <View style={styles.memberList}>{data.members.map((member) => {
                const selected = recipientId === member.userId._id;
                return <TouchableOpacity accessibilityRole="radio" accessibilityState={{ checked: selected }} activeOpacity={0.82} key={member._id} onPress={() => setRecipientId(member.userId._id)} style={[styles.memberRow, selected && styles.memberRowSelected]}>
                  {member.userId.avatarUrl ? <ExpoImage source={{ uri: member.userId.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{member.userId.fullName.charAt(0)}</Text></View>}
                  <Text style={styles.memberName}>{member.userId.fullName}</Text><Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={21} color={selected ? COLORS.brand : COLORS.muted} />
                </TouchableOpacity>;
              })}</View>
              <Text style={styles.inputLabel}>Purpose</Text>
              <TextInput maxLength={300} multiline onChangeText={setPurpose} placeholder="e.g. Pay the supplier for our shared equipment" placeholderTextColor="#96A39E" style={styles.purposeInput} textAlignVertical="top" value={purpose} />
              <KasaButton disabled={!!action} label="Open 48-hour vote" loading={action === "propose"} onPress={() => void submitProposal()} style={styles.submitButton} />
            </KasaCard>
          </View>
        ) : (
          <KasaCard style={styles.waitingCard}>
            <View style={styles.waitingIcon}><Ionicons name={goalReached ? "hourglass-outline" : "lock-closed-outline"} size={22} color={COLORS.brand} /></View>
            <Text style={styles.waitingTitle}>{goalReached ? "Waiting for a proposal" : "Payouts unlock at the target"}</Text>
            <Text style={styles.waitingCopy}>{goalReached ? "The owner or treasurer can open a payout vote. No funds move before members approve it." : "Keep contributing together. Once the goal is reached, the owner or treasurer can propose how the funds should be used."}</Text>
          </KasaCard>
        )}

        <View style={styles.auditNote}><Ionicons name="receipt-outline" size={17} color={COLORS.brand} /><Text style={styles.auditText}>Proposals, votes and wallet payouts remain visible in the group decision history.</Text></View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },
  center: { alignItems: "center", backgroundColor: COLORS.background, flex: 1, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", paddingBottom: 12, paddingHorizontal: 16 },
  headerButton: { alignItems: "center", height: 44, justifyContent: "center", marginRight: 8, width: 44 },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800" }, headerSubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  secureBadge: { alignItems: "center", backgroundColor: "#E9F4EF", borderRadius: 11, height: 38, justifyContent: "center", width: 38 },
  content: { gap: 16, padding: 20 }, goalCard: { backgroundColor: COLORS.brandStrong, borderWidth: 0, padding: 18 },
  goalTopRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }, eyebrow: { color: "#B9D9CC", fontSize: 9, fontWeight: "800", letterSpacing: 1 }, goalStatus: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", marginTop: 3 }, percent: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  savedAmount: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", letterSpacing: -0.8, marginTop: 20 }, targetCopy: { color: "#B9D9CC", fontSize: 11, marginTop: 2 },
  track: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, height: 7, marginTop: 14, overflow: "hidden" }, fill: { backgroundColor: "#FFFFFF", borderRadius: 999, height: "100%" },
  balanceRow: { alignItems: "center", borderTopColor: "rgba(255,255,255,0.15)", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 13 }, balanceLabel: { color: "#B9D9CC", fontSize: 10 }, balanceValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  voteCard: { borderColor: "#DED3F3", borderWidth: 1, padding: 16 }, voteHeader: { alignItems: "center", flexDirection: "row", gap: 10 }, voteIcon: { alignItems: "center", backgroundColor: "#F0EAFB", borderRadius: 11, height: 42, justifyContent: "center", width: 42 }, voteTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" }, voteMeta: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  proposalAmountRow: { alignItems: "flex-end", borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", marginTop: 18, paddingBottom: 14 }, smallLabel: { color: COLORS.muted, fontSize: 8, fontWeight: "800", letterSpacing: 0.8 }, proposalAmount: { color: COLORS.text, fontSize: 22, fontWeight: "800", marginTop: 3 }, recipientName: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginTop: 4 }, purpose: { color: COLORS.text, fontSize: 13, lineHeight: 19, marginTop: 14 },
  approvalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 }, approvalText: { color: "#6D4BC3", fontSize: 11, fontWeight: "800" }, rejectedText: { color: COLORS.muted, fontSize: 10 }, voteTrack: { backgroundColor: "#ECE6F7", borderRadius: 999, height: 6, marginTop: 8, overflow: "hidden" }, voteFill: { backgroundColor: "#6D4BC3", borderRadius: 999, height: "100%" },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 }, rejectButton: { flex: 1 }, approveButton: { flex: 1 }, recorded: { alignItems: "center", backgroundColor: COLORS.successSoft, borderRadius: 12, flexDirection: "row", gap: 8, marginTop: 16, padding: 12 }, recordedText: { color: COLORS.text, fontSize: 11, fontWeight: "600" },
  sectionHeading: { marginBottom: 10 }, sectionTitle: { color: COLORS.text, fontSize: 19, fontWeight: "800" }, sectionCopy: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, formCard: { padding: 16 }, availableHint: { color: COLORS.muted, fontSize: 10, marginTop: 5 }, inputLabel: { color: COLORS.text, fontSize: 12, fontWeight: "800", marginBottom: 8, marginTop: 18 }, memberList: { gap: 8 }, memberRow: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, padding: 10 }, memberRowSelected: { backgroundColor: "#EEF7F2", borderColor: COLORS.brand }, avatar: { borderRadius: 18, height: 36, width: 36 }, avatarFallback: { alignItems: "center", backgroundColor: COLORS.brand, justifyContent: "center" }, avatarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, memberName: { color: COLORS.text, flex: 1, fontSize: 12, fontWeight: "700" }, purposeInput: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, color: COLORS.text, fontSize: 13, height: 96, lineHeight: 19, padding: 12 }, submitButton: { marginTop: 18 },
  waitingCard: { alignItems: "center", padding: 24 }, waitingIcon: { alignItems: "center", backgroundColor: "#E9F4EF", borderRadius: 14, height: 50, justifyContent: "center", width: 50 }, waitingTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800", marginTop: 13 }, waitingCopy: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  auditNote: { alignItems: "flex-start", flexDirection: "row", gap: 9, paddingHorizontal: 6 }, auditText: { color: COLORS.muted, flex: 1, fontSize: 10, lineHeight: 15 },
});
