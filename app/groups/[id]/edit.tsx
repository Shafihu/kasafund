import { AnimatedLoader } from "@/components/ui/AnimatedLoader";
import { apiService, type ContributionFrequency } from "@/services/apiService";
import { markGroupForRefresh } from "@/utils/group-refresh";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  type RenderItemParams,
} from "react-native-draggable-flatlist";

const COLORS = {
  primary: "#0B4D3E",
  background: "#FFFFFF",
  surface: "#F6F8F7",
  border: "#E2E8E5",
  text: "#12211C",
  textMuted: "#6B7A75",
  placeholder: "#9AA8A3",
};

type Section = "details" | "contribution" | "rotation";
type Role = "owner" | "treasurer" | "moderator" | "member";
type RotationMember = { userId: string; name: string };

export default function EditGroupScreen() {
  const router = useRouter();
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const [activeSection, setActiveSection] = useState<Section>(
    section === "contribution" || section === "rotation" ? section : "details"
  );
  const [role, setRole] = useState<Role>("member");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [coverAsset, setCoverAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<ContributionFrequency>("monthly");
  const [graceDays, setGraceDays] = useState("0");
  const [penalty, setPenalty] = useState("0");
  const [expectedMemberCount, setExpectedMemberCount] = useState("2");
  const [groupStatus, setGroupStatus] = useState<"setup" | "active" | "paused" | "completed" | "archived">("active");
  const [rotation, setRotation] = useState<RotationMember[]>([]);
  const [rotationRound, setRotationRound] = useState(1);
  const [rotationAppliesNextRound, setRotationAppliesNextRound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void apiService.getGroup(id).then((response) => {
      if (!active) return;
      const { group, membership, members } = response.data;
      const membershipRole = membership?.role || "member";
      setRole(membershipRole);
      if (membershipRole !== "owner" && section !== "contribution" && section !== "rotation") {
        setActiveSection("contribution");
      }
      setName(group.name);
      setDescription(group.description || "");
      setCoverImage(group.coverImageUrl || "");
      setIsPublic(Boolean(group.isPublic));
      setAmount(String(group.contribution.amount / 100));
      setFrequency(group.contribution.frequency);
      setGraceDays(String(group.contribution.gracePeriodDays || 0));
      setPenalty(String((group.contribution.penaltyAmount || 0) / 100));
      setExpectedMemberCount(String(group.expectedMemberCount || 2));
      setGroupStatus(group.status);
      const memberEntries = members
        .filter((member) => member.userId?._id)
        .map((member) => ({ userId: member.userId._id, name: member.userId.fullName }));
      const memberById = new Map(memberEntries.map((entry) => [entry.userId, entry]));
      const pendingOrder = group.rotation?.pendingOrder || [];
      const configuredOrder = pendingOrder.length
        ? pendingOrder
        : group.rotation?.order || memberEntries.map((entry) => entry.userId);
      const orderedMembers = configuredOrder
        .map((userId) => memberById.get(userId))
        .filter((entry): entry is RotationMember => Boolean(entry));
      const includedIds = new Set(orderedMembers.map((entry) => entry.userId));
      setRotation([
        ...orderedMembers,
        ...memberEntries.filter((entry) => !includedIds.has(entry.userId)),
      ]);
      setRotationRound(group.rotation?.roundNumber || 1);
      setRotationAppliesNextRound(
        pendingOrder.length > 0 ||
        (group.rotation?.completedRecipientIds?.length || 0) > 0 ||
        (group.rotation?.currentPositionIndex || 0) > 0
      );
    }).catch((error) => {
      Alert.alert("Could not load settings", error instanceof Error ? error.message : "Please try again.", [
        { text: "Close", onPress: () => router.back() },
      ]);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, router, section]);

  const moveMember = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rotation.length) return;
    setRotation((current) => {
      const updated = [...current];
      [updated[index], updated[target]] = [updated[target], updated[index]];
      return updated;
    });
  };

  const chooseCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access to choose a group cover.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverAsset(result.assets[0]);
      setCoverImage(result.assets[0].uri);
    }
  };

  const renderRotationMember = ({
    item,
    drag,
    isActive,
    getIndex,
  }: RenderItemParams<RotationMember>) => {
    const index = getIndex() ?? 0;
    return (
      <TouchableOpacity
        accessibilityHint="Long press and drag to change this member's payout position"
        activeOpacity={0.92}
        disabled={isActive}
        onLongPress={drag}
        style={[styles.rotationRow, isActive && styles.rotationRowActive]}
      >
          <View style={[styles.position, isActive && styles.positionActive]}>
            <Text style={[styles.positionText, isActive && styles.positionTextActive]}>{index + 1}</Text>
          </View>
          <View style={styles.rotationCopy}>
            <Text style={styles.rotationName}>{item.name}</Text>
            <Text style={styles.rotationPositionLabel}>
              {rotationAppliesNextRound ? "Next-round" : "Payout"} position {index + 1}
            </Text>
          </View>
          <TouchableOpacity
            disabled={index === 0 || isActive}
            hitSlop={6}
            onPress={() => moveMember(index, -1)}
            style={styles.moveButton}
          >
            <Ionicons name="chevron-up" size={18} color={index === 0 ? COLORS.placeholder : COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            disabled={index === rotation.length - 1 || isActive}
            hitSlop={6}
            onPress={() => moveMember(index, 1)}
            style={styles.moveButton}
          >
            <Ionicons name="chevron-down" size={18} color={index === rotation.length - 1 ? COLORS.placeholder : COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={`Drag ${item.name}`}
            disabled={isActive}
            onLongPress={drag}
            style={styles.dragHandle}
          >
            <Ionicons name="reorder-three" size={22} color={isActive ? COLORS.primary : COLORS.textMuted} />
          </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const save = async () => {
    if (!id || saving) return;
    try {
      setSaving(true);
      if (activeSection === "details") {
        if (!name.trim()) throw new Error("Group name is required.");
        const uploadedCover = coverAsset
          ? await apiService.uploadImage(coverAsset, "group")
          : null;
        await apiService.updateGroup(id, {
          name: name.trim(),
          description: description.trim(),
          isPublic,
          coverImageUrl: uploadedCover?.data.url ?? coverImage,
        });
      } else if (activeSection === "contribution") {
        if (Number(amount) <= 0) throw new Error("Enter a valid contribution amount.");
        if (groupStatus === "setup" && role === "owner" && Number(expectedMemberCount) < 2) {
          throw new Error("Planned group size must be at least 2.");
        }
        await apiService.updateGroup(id, {
          expectedMemberCount: groupStatus === "setup" && role === "owner"
            ? Number(expectedMemberCount)
            : undefined,
          contribution: {
            amount: Math.round(Number(amount) * 100),
            frequency,
            gracePeriodDays: Number(graceDays) || 0,
            penaltyAmount: Math.round(Number(penalty || 0) * 100),
          },
        });
      } else {
        const response = await apiService.reorderGroupRotation(
          id,
          rotation.map((member) => member.userId)
        );
        Alert.alert(
          rotationAppliesNextRound ? "Next rotation saved" : "Rotation updated",
          response.message || "The payout order has been saved.",
          [
            {
              text: "Done",
              onPress: () => {
                markGroupForRefresh(id);
                router.back();
              },
            },
          ]
        );
        return;
      }
      Alert.alert("Settings updated", "Your group changes have been saved.", [
        {
          text: "Done",
          onPress: () => {
            markGroupForRefresh(id);
            router.back();
          },
        },
      ]);
    } catch (error) {
      Alert.alert("Could not save settings", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <AnimatedLoader accessibilityLabel="Loading group settings" />
      </View>
    );
  }

  const canManageFinances = role === "owner" || role === "treasurer";
  if (!canManageFinances) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={32} color={COLORS.placeholder} />
        <Text style={styles.deniedTitle}>Management access required</Text>
        <Text style={styles.deniedText}>Only the owner or treasurer can change these settings.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Text style={styles.backButtonText}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  const sections: { key: Section; label: string }[] = [
    ...(role === "owner" ? [{ key: "details" as Section, label: "Details" }] : []),
    { key: "contribution", label: "Contributions" },
    { key: "rotation", label: "Rotation" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={21} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Group settings</Text>
            <Text style={styles.subtitle}>{role === "owner" ? "Owner access" : "Treasurer access"}</Text>
          </View>
        </View>

        <View style={styles.sectionTabs}>
          {sections.map((item) => (
            <TouchableOpacity key={item.key} onPress={() => setActiveSection(item.key)} style={[styles.sectionTab, activeSection === item.key && styles.sectionTabActive]}>
              <Text style={[styles.sectionTabText, activeSection === item.key && styles.sectionTabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <NestableScrollContainer contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {activeSection === "details" && role === "owner" && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Group details</Text>
              <Text style={styles.label}>Cover image</Text>
              {coverImage ? (
                <View style={styles.coverPreview}>
                  <Image resizeMode="cover" source={{ uri: coverImage }} style={styles.coverImage} />
                  <View style={styles.coverActions}>
                    <TouchableOpacity onPress={chooseCover} style={styles.coverActionButton}>
                      <Ionicons name="images-outline" size={16} color={COLORS.text} />
                      <Text style={styles.coverActionText}>Replace</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setCoverImage(""); setCoverAsset(null); }} style={styles.coverRemoveButton}>
                      <Ionicons name="trash-outline" size={17} color={COLORS.background} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={chooseCover} style={styles.coverPicker}>
                  <Ionicons name="image-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.coverPickerText}>Choose group cover</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.label}>Group name</Text>
              <TextInput onChangeText={setName} placeholder="Group name" placeholderTextColor={COLORS.placeholder} style={styles.input} value={name} />
              <Text style={styles.label}>Description</Text>
              <TextInput multiline onChangeText={setDescription} placeholder="What is this group for?" placeholderTextColor={COLORS.placeholder} style={[styles.input, styles.textArea]} value={description} />
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.rowTitle}>Public group</Text>
                  <Text style={styles.rowSubtitle}>Allow the group to appear in Discover.</Text>
                </View>
                <Switch onValueChange={setIsPublic} thumbColor={COLORS.background} trackColor={{ false: COLORS.border, true: COLORS.primary }} value={isPublic} />
              </View>
            </View>
          )}

          {activeSection === "contribution" && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Contribution rules</Text>
              <Text style={styles.label}>Amount per member (GH₵)</Text>
              <TextInput keyboardType="decimal-pad" onChangeText={setAmount} placeholder="0.00" placeholderTextColor={COLORS.placeholder} style={styles.input} value={amount} />
              {groupStatus === "setup" && role === "owner" && (
                <>
                  <Text style={styles.label}>Planned group size</Text>
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={2}
                    onChangeText={(value) => setExpectedMemberCount(value.replace(/\D/g, ""))}
                    placeholder="4"
                    placeholderTextColor={COLORS.placeholder}
                    style={styles.input}
                    value={expectedMemberCount}
                  />
                  <Text style={styles.hint}>You can lower this to the accepted roster size before activation.</Text>
                </>
              )}
              <Text style={styles.label}>Frequency</Text>
              <View style={styles.frequencyRow}>
                {(["daily", "weekly", "monthly"] as ContributionFrequency[]).map((item) => (
                  <TouchableOpacity key={item} onPress={() => setFrequency(item)} style={[styles.frequencyButton, frequency === item && styles.frequencyButtonActive]}>
                    <Text style={[styles.frequencyText, frequency === item && styles.frequencyTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.rulesRow}>
                <View style={styles.ruleField}>
                  <Text style={styles.label}>Grace period</Text>
                  <TextInput keyboardType="number-pad" onChangeText={setGraceDays} placeholder="0 days" placeholderTextColor={COLORS.placeholder} style={styles.input} value={graceDays} />
                </View>
                <View style={styles.ruleField}>
                  <Text style={styles.label}>Late penalty (GH₵)</Text>
                  <TextInput keyboardType="decimal-pad" onChangeText={setPenalty} placeholder="0.00" placeholderTextColor={COLORS.placeholder} style={styles.input} value={penalty} />
                </View>
              </View>
            </View>
          )}

          {activeSection === "rotation" && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Payout rotation</Text>
              <View style={styles.rotationGuide}>
                <View style={styles.rotationGuideIcon}>
                  <Ionicons name="hand-left-outline" size={19} color={COLORS.primary} />
                </View>
                <Text style={styles.rotationGuideText}>
                  {rotationAppliesNextRound
                    ? `Round ${rotationRound} is already underway. This order will start with round ${rotationRound + 1}; completed and scheduled payouts will not change.`
                    : "Long press any row or grab handle to drag. Use the arrows for precise one-step changes."}
                </Text>
              </View>
              <NestableDraggableFlatList
                activationDistance={8}
                contentContainerStyle={styles.rotationList}
                data={rotation}
                dragItemOverflow
                keyExtractor={(member) => member.userId}
                onDragEnd={({ data }) => setRotation(data)}
                renderItem={renderRotationMember}
                scrollEnabled={false}
              />
            </View>
          )}
        </NestableScrollContainer>

        <TouchableOpacity disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && styles.disabled]}>
          {saving ? <ActivityIndicator color={COLORS.background} /> : <Text style={styles.saveButtonText}>Save changes</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },
  center: { alignItems: "center", backgroundColor: COLORS.background, flex: 1, justifyContent: "center", paddingHorizontal: 30 },
  header: { alignItems: "center", flexDirection: "row", paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 12, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  headerCopy: { flex: 1 },
  title: { color: COLORS.text, fontSize: 21, fontWeight: "700" },
  subtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  sectionTabs: { borderBottomColor: COLORS.border, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingVertical: 10 },
  sectionTab: { backgroundColor: COLORS.surface, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  sectionTabActive: { backgroundColor: COLORS.primary },
  sectionTabText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  sectionTabTextActive: { color: COLORS.background },
  content: { padding: 20, paddingBottom: 35 },
  formSection: { gap: 10, overflow: "visible" },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  label: { color: COLORS.text, fontSize: 12, fontWeight: "600", marginTop: 5 },
  input: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, color: COLORS.text, fontSize: 14, height: 50, paddingHorizontal: 13 },
  textArea: { height: 100, paddingTop: 13, textAlignVertical: "top" },
  coverPicker: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 14, borderStyle: "dashed", borderWidth: 1.5, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 100 },
  coverPickerText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  coverPreview: { borderRadius: 15, height: 170, overflow: "hidden", position: "relative" },
  coverImage: { height: "100%", width: "100%" },
  coverActions: { bottom: 12, flexDirection: "row", gap: 8, position: "absolute", right: 12 },
  coverActionButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 8 },
  coverActionText: { color: COLORS.text, fontSize: 11, fontWeight: "700" },
  coverRemoveButton: { alignItems: "center", backgroundColor: "rgba(18,33,28,0.82)", borderRadius: 10, height: 34, justifyContent: "center", width: 36 },
  switchRow: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 7, padding: 14 },
  switchCopy: { flex: 1 },
  rowTitle: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  rowSubtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  frequencyRow: { flexDirection: "row", gap: 8 },
  frequencyButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 11, borderWidth: 1, flex: 1, paddingVertical: 12 },
  frequencyButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  frequencyText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  frequencyTextActive: { color: COLORS.background },
  hint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 14, marginTop: -8 },
  rulesRow: { flexDirection: "row", gap: 10 },
  ruleField: { flex: 1 },
  rotationGuide: { alignItems: "center", backgroundColor: "#E8F5EE", borderRadius: 14, flexDirection: "row", marginBottom: 4, padding: 13 },
  rotationGuideIcon: { alignItems: "center", backgroundColor: COLORS.background, borderRadius: 10, height: 36, justifyContent: "center", marginRight: 10, width: 36 },
  rotationGuideText: { color: COLORS.textMuted, flex: 1, fontSize: 11, lineHeight: 17 },
  rotationList: { gap: 10, overflow: "visible", paddingBottom: 8, paddingHorizontal: 7 },
  rotationRow: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", minHeight: 62, padding: 10 },
  rotationRowActive: { backgroundColor: COLORS.background, borderColor: COLORS.primary, elevation: 5, shadowColor: COLORS.primary, shadowOffset: { height: 5, width: 0 }, shadowOpacity: 0.16, shadowRadius: 10 },
  position: { alignItems: "center", backgroundColor: "#E5F1ED", borderRadius: 10, height: 34, justifyContent: "center", marginRight: 10, width: 34 },
  positionActive: { backgroundColor: COLORS.primary },
  positionText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  positionTextActive: { color: COLORS.background },
  rotationCopy: { flex: 1 },
  rotationName: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  rotationPositionLabel: { color: COLORS.textMuted, fontSize: 10, marginTop: 3 },
  moveButton: { alignItems: "center", height: 34, justifyContent: "center", width: 34 },
  dragHandle: { alignItems: "center", backgroundColor: COLORS.background, borderColor: COLORS.border, borderRadius: 9, borderWidth: 1, height: 36, justifyContent: "center", marginLeft: 3, width: 34 },
  saveButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 12, height: 52, justifyContent: "center", marginBottom: 22, marginHorizontal: 20 },
  saveButtonText: { color: COLORS.background, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  deniedTitle: { color: COLORS.text, fontSize: 17, fontWeight: "700", marginTop: 14 },
  deniedText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  backButton: { backgroundColor: COLORS.primary, borderRadius: 11, marginTop: 18, paddingHorizontal: 20, paddingVertical: 11 },
  backButtonText: { color: COLORS.background, fontSize: 13, fontWeight: "700" },
});
