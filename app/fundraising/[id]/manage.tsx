import {
  apiService,
  type CampaignCategory,
} from "@/services/apiService";
import { AnimatedLoader } from "@/components/ui/AnimatedLoader";
import { useAuthStore } from "@/stores/useAuthStore";
import { markCampaignForRefresh } from "@/utils/campaign-refresh";
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
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: "#0B4D3E",
  primaryLight: "#E8F5EE",
  background: "#FFFFFF",
  surface: "#F6F8F7",
  border: "#E2E8E5",
  text: "#12211C",
  textMuted: "#6B7A75",
  placeholder: "#9AA8A3",
};

type Section = "details" | "update";

const CATEGORIES: { key: CampaignCategory; label: string }[] = [
  { key: "medical", label: "Medical" },
  { key: "school_fees", label: "Education" },
  { key: "disaster_relief", label: "Emergency" },
  { key: "community", label: "Community" },
  { key: "funeral", label: "Funeral" },
  { key: "wedding", label: "Celebration" },
  { key: "charity", label: "Charity" },
  { key: "business", label: "Business" },
  { key: "other", label: "Other" },
];

export default function ManageCampaignScreen() {
  const router = useRouter();
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const [activeSection, setActiveSection] = useState<Section>(
    section === "update" ? "update" : "details"
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CampaignCategory>("other");
  const [coverImage, setCoverImage] = useState("");
  const [coverAsset, setCoverAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [updateContent, setUpdateContent] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void apiService.getCampaign(id)
      .then((response) => {
        if (!active) return;
        const campaign = response.data.campaign;
        const ownsCampaign = currentUser?.id === campaign.creatorId._id;
        setIsOwner(ownsCampaign);
        setTitle(campaign.title);
        setDescription(campaign.description);
        setCategory(campaign.category);
        setCoverImage(campaign.coverImageUrl || "");
        setIsPublic(campaign.isPublic);
        setAllowAnonymous(campaign.allowAnonymousDonations);
      })
      .catch((error) => {
        Alert.alert(
          "Could not load campaign",
          error instanceof Error ? error.message : "Please try again.",
          [{ text: "Close", onPress: () => router.back() }]
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.id, id, router]);

  const chooseCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access to choose a campaign cover.");
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

  const saveDetails = async () => {
    if (!id || saving) return;
    if (!title.trim()) {
      Alert.alert("Title required", "Enter a clear campaign title.");
      return;
    }
    if (description.trim().length < 40) {
      Alert.alert("Add more detail", "The campaign story should be at least 40 characters.");
      return;
    }
    try {
      setSaving(true);
      const uploadedCover = coverAsset
        ? await apiService.uploadImage(coverAsset, "campaign")
        : null;
      await apiService.updateCampaign(id, {
        title: title.trim(),
        description: description.trim(),
        category,
        coverImageUrl: uploadedCover?.data.url ?? coverImage,
        isPublic,
        allowAnonymousDonations: allowAnonymous,
      });
      markCampaignForRefresh(id);
      Alert.alert("Campaign updated", "Your campaign details were saved.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Could not save campaign", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const publishUpdate = async () => {
    if (!id || saving) return;
    const content = updateContent.trim();
    if (content.length < 10) {
      Alert.alert("Add more detail", "Write at least 10 characters before publishing.");
      return;
    }
    try {
      setSaving(true);
      await apiService.addCampaignUpdate(id, content);
      setUpdateContent("");
      markCampaignForRefresh(id);
      Alert.alert(
        "Update published",
        "Supporters can now see this update and eligible donors have been notified.",
        [
          { text: "Post another", style: "cancel" },
          { text: "View campaign", onPress: () => router.back() },
        ]
      );
    } catch (error) {
      Alert.alert("Could not publish update", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <AnimatedLoader accessibilityLabel="Loading campaign tools" />
      </View>
    );
  }

  if (!isOwner) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.deniedIcon}>
          <Ionicons name="lock-closed-outline" size={28} color={COLORS.primary} />
        </View>
        <Text style={styles.deniedTitle}>Organizer access required</Text>
        <Text style={styles.deniedText}>Only the campaign organizer can edit details or publish updates.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={21} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Manage campaign</Text>
            <Text style={styles.headerSubtitle}>Organizer controls</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {([
            { key: "details" as Section, label: "Edit details", icon: "create-outline" as const },
            { key: "update" as Section, label: "Post update", icon: "megaphone-outline" as const },
          ]).map((item) => {
            const selected = activeSection === item.key;
            return (
              <TouchableOpacity key={item.key} onPress={() => setActiveSection(item.key)} style={[styles.tab, selected && styles.tabActive]}>
                <Ionicons name={item.icon} size={16} color={selected ? COLORS.background : COLORS.textMuted} />
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {activeSection === "details" ? (
            <View>
              <Text style={styles.sectionTitle}>Campaign presentation</Text>
              <Text style={styles.sectionIntro}>Keep the story accurate so supporters know where their money is going.</Text>

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
                  <Ionicons name="image-outline" size={23} color={COLORS.primary} />
                  <Text style={styles.coverPickerText}>Choose campaign cover</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.label}>Campaign title</Text>
              <TextInput maxLength={140} onChangeText={setTitle} placeholder="Campaign title" placeholderTextColor={COLORS.placeholder} style={styles.input} value={title} />

              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((item) => {
                  const selected = category === item.key;
                  return (
                    <TouchableOpacity key={item.key} onPress={() => setCategory(item.key)} style={[styles.categoryChip, selected && styles.categoryChipActive]}>
                      <Text style={[styles.categoryText, selected && styles.categoryTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Campaign story</Text>
              <TextInput maxLength={10000} multiline onChangeText={setDescription} placeholder="Tell supporters about the cause" placeholderTextColor={COLORS.placeholder} style={[styles.input, styles.storyInput]} textAlignVertical="top" value={description} />
              <Text style={styles.characterCount}>{description.length}/10,000</Text>

              <View style={styles.switchCard}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchTitle}>Public campaign</Text>
                  <Text style={styles.switchSubtitle}>Show this campaign in fundraising Explore.</Text>
                </View>
                <Switch onValueChange={setIsPublic} trackColor={{ false: COLORS.border, true: COLORS.primary }} value={isPublic} />
              </View>

              <View style={styles.switchCard}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchTitle}>Anonymous donations</Text>
                  <Text style={styles.switchSubtitle}>Allow future supporters to hide their public name.</Text>
                </View>
                <Switch onValueChange={setAllowAnonymous} trackColor={{ false: COLORS.border, true: COLORS.primary }} value={allowAnonymous} />
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.updateHeaderIcon}>
                <Ionicons name="megaphone-outline" size={25} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>Share a campaign update</Text>
              <Text style={styles.sectionIntro}>Tell supporters about progress, milestones, or how donated funds are being used.</Text>
              <View style={styles.updateComposer}>
                <TextInput
                  maxLength={5000}
                  multiline
                  onChangeText={setUpdateContent}
                  placeholder="Write an honest update for your supporters…"
                  placeholderTextColor={COLORS.placeholder}
                  style={styles.updateInput}
                  textAlignVertical="top"
                  value={updateContent}
                />
                <Text style={styles.updateCount}>{updateContent.length}/5,000</Text>
              </View>
              <View style={styles.notificationNote}>
                <Ionicons name="notifications-outline" size={19} color={COLORS.primary} />
                <Text style={styles.notificationText}>Supporters who enabled campaign notifications will be alerted after publishing.</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity disabled={saving} onPress={() => void (activeSection === "details" ? saveDetails() : publishUpdate())} style={[styles.primaryButton, saving && styles.disabled]}>
            {saving ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <>
                <Ionicons name={activeSection === "details" ? "checkmark-circle-outline" : "send"} size={18} color={COLORS.background} />
                <Text style={styles.primaryButtonText}>{activeSection === "details" ? "Save changes" : "Publish update"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.background, flex: 1 },
  center: { alignItems: "center", backgroundColor: COLORS.background, flex: 1, justifyContent: "center", paddingHorizontal: 30 },
  header: { alignItems: "center", flexDirection: "row", paddingHorizontal: 18, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  headerCopy: { flex: 1 },
  headerTitle: { color: COLORS.text, fontSize: 21, fontWeight: "800" },
  headerSubtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  tabs: { backgroundColor: COLORS.surface, borderRadius: 13, flexDirection: "row", marginBottom: 8, marginHorizontal: 18, padding: 4 },
  tab: { alignItems: "center", borderRadius: 10, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 10 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: COLORS.background },
  content: { paddingBottom: 35, paddingHorizontal: 20, paddingTop: 16 },
  sectionTitle: { color: COLORS.text, fontSize: 19, fontWeight: "800" },
  sectionIntro: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 20, marginTop: 5 },
  label: { color: COLORS.text, fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 17 },
  input: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, color: COLORS.text, fontSize: 14, minHeight: 50, paddingHorizontal: 13 },
  storyInput: { minHeight: 145, paddingTop: 13 },
  characterCount: { color: COLORS.placeholder, fontSize: 10, marginTop: 5, textAlign: "right" },
  coverPicker: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 15, borderStyle: "dashed", borderWidth: 1.5, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 115 },
  coverPickerText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  coverPreview: { borderRadius: 15, height: 180, overflow: "hidden", position: "relative" },
  coverImage: { height: "100%", width: "100%" },
  coverActions: { bottom: 12, flexDirection: "row", gap: 8, position: "absolute", right: 12 },
  coverActionButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 8 },
  coverActionText: { color: COLORS.text, fontSize: 11, fontWeight: "700" },
  coverRemoveButton: { alignItems: "center", backgroundColor: "rgba(18,33,28,0.82)", borderRadius: 10, height: 34, justifyContent: "center", width: 36 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  categoryChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  categoryText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  categoryTextActive: { color: COLORS.primary, fontWeight: "800" },
  switchCard: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 13, padding: 14 },
  switchCopy: { flex: 1, marginRight: 12 },
  switchTitle: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  switchSubtitle: { color: COLORS.textMuted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  updateHeaderIcon: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 16, height: 52, justifyContent: "center", marginBottom: 14, width: 52 },
  updateComposer: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, padding: 14 },
  updateInput: { color: COLORS.text, fontSize: 14, lineHeight: 21, minHeight: 190 },
  updateCount: { color: COLORS.placeholder, fontSize: 10, marginTop: 8, textAlign: "right" },
  notificationNote: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 14, flexDirection: "row", marginTop: 14, padding: 14 },
  notificationText: { color: COLORS.textMuted, flex: 1, fontSize: 11, lineHeight: 17, marginLeft: 10 },
  footer: { borderTopColor: COLORS.border, borderTopWidth: 1, paddingBottom: 14, paddingHorizontal: 20, paddingTop: 12 },
  primaryButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 13, flexDirection: "row", gap: 8, height: 52, justifyContent: "center" },
  primaryButtonText: { color: COLORS.background, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  deniedIcon: { alignItems: "center", backgroundColor: COLORS.primaryLight, borderRadius: 20, height: 64, justifyContent: "center", width: 64 },
  deniedTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800", marginTop: 15 },
  deniedText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  backButton: { backgroundColor: COLORS.primary, borderRadius: 11, marginTop: 18, paddingHorizontal: 20, paddingVertical: 11 },
  backButtonText: { color: COLORS.background, fontSize: 13, fontWeight: "700" },
});
