import { apiService } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  primary: "#0B4D3E",
  background: "#F6F8F7",
  surface: "#FFFFFF",
  border: "#E2E8E5",
  text: "#12211C",
  textMuted: "#6B7A75",
  success: "#1E8E5A",
};

export default function AccountSettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    setFullName(user?.fullName || "");
    setPhoneNumber(user?.phoneNumber || "");
    setBio(user?.bio || "");
  }, [user]);

  const save = async () => {
    if (!fullName.trim()) {
      Alert.alert("Name required", "Please enter your full name.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        bio: bio.trim(),
      });
      Alert.alert("Profile updated", "Your account details were saved.");
    } catch (error) {
      Alert.alert("Couldn’t save profile", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const chooseProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access to choose a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const uploaded = await apiService.uploadImage(result.assets[0], "profile");
      await updateProfile({ profileImage: uploaded.data.url });
    } catch (error) {
      Alert.alert("Couldn’t upload photo", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeProfileImage = async () => {
    setUploadingAvatar(true);
    try {
      await apiService.deleteProfileImage();
      await checkAuthStatus();
    } catch (error) {
      Alert.alert("Couldn’t remove photo", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons color={COLORS.text} name="arrow-back" size={21} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account settings</Text>
          <View style={styles.headerButton} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Keep your identity and contact information accurate for groups, campaigns, and payouts.</Text>

          <View style={styles.avatarCard}>
            <View style={styles.avatarWrap}>
              {user?.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>
                    {(user?.fullName || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                  </Text>
                </View>
              )}
              {uploadingAvatar ? (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}
            </View>
            <View style={styles.avatarCopy}>
              <Text style={styles.verificationTitle}>Profile picture</Text>
              <Text style={styles.verificationText}>Shown to your groups and campaign supporters</Text>
              <View style={styles.avatarActions}>
                <TouchableOpacity disabled={uploadingAvatar} onPress={chooseProfileImage}>
                  <Text style={styles.changePhoto}>Choose photo</Text>
                </TouchableOpacity>
                {user?.profileImage ? (
                  <TouchableOpacity disabled={uploadingAvatar} onPress={removeProfileImage}>
                    <Text style={styles.removePhoto}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.verificationCard}>
            <View style={styles.verificationIcon}>
              <Ionicons color={user?.emailVerified ? COLORS.success : "#B7791F"} name={user?.emailVerified ? "shield-checkmark" : "shield-outline"} size={21} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verificationTitle}>{user?.emailVerified ? "Email verified" : "Verification pending"}</Text>
              <Text style={styles.verificationText}>{user?.email}</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.push("/profile/identity-verification")}
            style={styles.securityRow}
          >
            <View style={styles.verificationIcon}>
              <Ionicons
                color={user?.identityVerification?.status === "verified" ? COLORS.success : COLORS.primary}
                name={user?.identityVerification?.status === "verified" ? "shield-checkmark" : "id-card-outline"}
                size={21}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verificationTitle}>Identity verification</Text>
              <Text style={styles.verificationText}>
                {user?.identityVerification?.status === "verified"
                  ? "Verified with government ID and facial match"
                  : "Verify your ID and complete a secure facial scan"}
              </Text>
            </View>
            <Ionicons color={COLORS.textMuted} name="chevron-forward" size={19} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.75} onPress={() => router.push("/profile/change-password")} style={styles.securityRow}>
            <View style={styles.verificationIcon}>
              <Ionicons color={COLORS.primary} name="key-outline" size={21} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verificationTitle}>Change password</Text>
              <Text style={styles.verificationText}>Update your account password securely</Text>
            </View>
            <Ionicons color="#9AA8A3" name="chevron-forward" size={19} />
          </TouchableOpacity>

          <View style={styles.formCard}>
            <View>
              <Text style={styles.label}>Full name</Text>
              <TextInput autoCapitalize="words" onChangeText={setFullName} placeholder="Your full name" placeholderTextColor="#9AA8A3" style={styles.input} value={fullName} />
            </View>
            <View>
              <Text style={styles.label}>Phone number</Text>
              <TextInput keyboardType="phone-pad" onChangeText={setPhoneNumber} placeholder="e.g. 024 000 0000" placeholderTextColor="#9AA8A3" style={styles.input} value={phoneNumber} />
            </View>
            <View>
              <Text style={styles.label}>Profile bio</Text>
              <TextInput maxLength={300} multiline onChangeText={setBio} placeholder="A short introduction" placeholderTextColor="#9AA8A3" style={[styles.input, styles.bioInput]} textAlignVertical="top" value={bio} />
              <Text style={styles.count}>{bio.length}/300</Text>
            </View>
          </View>

          <TouchableOpacity disabled={saving} onPress={save} style={[styles.saveButton, saving && { opacity: 0.65 }]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  headerButton: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  headerTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  content: { paddingBottom: 40, paddingHorizontal: 20 },
  intro: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 20 },
  avatarCard: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, flexDirection: "row", marginBottom: 20, padding: 15 },
  avatarWrap: { borderRadius: 34, height: 68, overflow: "hidden", width: 68 },
  avatar: { borderRadius: 34, height: 68, width: 68 },
  avatarFallback: { alignItems: "center", backgroundColor: "#E6F2EE", justifyContent: "center" },
  avatarInitials: { color: COLORS.primary, fontSize: 20, fontWeight: "800" },
  avatarLoading: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)", height: 68, justifyContent: "center", left: 0, position: "absolute", top: 0, width: 68 },
  avatarCopy: { flex: 1, marginLeft: 14 },
  avatarActions: { flexDirection: "row", gap: 18, marginTop: 9 },
  changePhoto: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  removePhoto: { color: "#C0392B", fontSize: 12, fontWeight: "700" },
  verificationCard: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, flexDirection: "row", marginBottom: 20, padding: 15 },
  verificationIcon: { alignItems: "center", backgroundColor: "#E6F2EE", borderRadius: 12, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  verificationTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  verificationText: { color: COLORS.textMuted, fontSize: 12, marginTop: 3 },
  securityRow: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, flexDirection: "row", marginBottom: 20, padding: 15 },
  formCard: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 17, borderWidth: 1, gap: 19, padding: 17 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { backgroundColor: COLORS.background, borderColor: COLORS.border, borderRadius: 12, borderWidth: 1, color: COLORS.text, fontSize: 15, minHeight: 50, paddingHorizontal: 13 },
  bioInput: { minHeight: 105, paddingTop: 13 },
  count: { color: COLORS.textMuted, fontSize: 11, marginTop: 5, textAlign: "right" },
  saveButton: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 14, justifyContent: "center", marginTop: 20, minHeight: 52 },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
