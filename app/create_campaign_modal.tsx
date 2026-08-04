import { Ionicons } from "@expo/vector-icons";
import { KasaButton } from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { apiService } from "@/services/apiService";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
  successSurface: kasaColors.brandSoft,
};

const TOTAL_STEPS = 5;
const STEP_LABELS = ["Category", "Story", "Goal", "Sharing", "Review"];
const MIN_STORY_LENGTH = 40;

type CampaignCategory =
  | "medical"
  | "education"
  | "emergency"
  | "community"
  | "funeral"
  | "celebration"
  | "business"
  | "other";
type Beneficiary = "myself" | "someone" | "community";
type Visibility = "public" | "link-only";
type Deadline = 7 | 14 | 30 | 60;

type CampaignForm = {
  category: CampaignCategory | null;
  title: string;
  beneficiary: Beneficiary | null;
  beneficiaryName: string;
  story: string;
  goal: string;
  deadline: Deadline | null;
  visibility: Visibility;
  allowAnonymousDonations: boolean;
  coverColor: string;
  coverImage: ImagePicker.ImagePickerAsset | null;
};

type CategoryOption = {
  key: CampaignCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CATEGORIES: CategoryOption[] = [
  { key: "medical", label: "Medical", icon: "medkit-outline" },
  { key: "education", label: "Education", icon: "school-outline" },
  { key: "emergency", label: "Emergency", icon: "flash-outline" },
  { key: "community", label: "Community", icon: "people-outline" },
  { key: "funeral", label: "Funeral", icon: "flower-outline" },
  { key: "celebration", label: "Celebration", icon: "gift-outline" },
  { key: "business", label: "Business", icon: "briefcase-outline" },
  { key: "other", label: "Other", icon: "ellipsis-horizontal-outline" },
];

const BENEFICIARIES: {
  key: Beneficiary;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: "myself",
    label: "Myself",
    description: "I am raising funds for my own need",
    icon: "person-outline",
  },
  {
    key: "someone",
    label: "Someone else",
    description: "I am organizing this for another person",
    icon: "heart-outline",
  },
  {
    key: "community",
    label: "A group or community",
    description: "The funds will support a shared cause",
    icon: "people-outline",
  },
];

const DEADLINES: { key: Deadline; label: string; description: string }[] = [
  { key: 7, label: "7 days", description: "Urgent need" },
  { key: 14, label: "14 days", description: "Short campaign" },
  { key: 30, label: "30 days", description: "Most popular" },
  { key: 60, label: "60 days", description: "Long-term goal" },
];

const COVER_COLORS = ["#0B4D3E", "#2B5B8A", "#5B4A8A", "#8A5E2B"];

function formatGoal(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `GH₵ ${amount.toLocaleString()}`
    : "GH₵ 0";
}

function categoryDetails(category: CampaignCategory | null) {
  return CATEGORIES.find((item) => item.key === category);
}

function StepHeader({
  step,
  onBack,
  onClose,
}: {
  step: number;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={styles.headerIconButton}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleCopy}>
          <Text style={styles.headerTitle}>Create campaign</Text>
          <Text style={styles.stepCount}>Step {step} of {TOTAL_STEPS} · {STEP_LABELS[step - 1]}</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Close campaign setup"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={styles.headerIconButton}
        >
          <Ionicons name="close" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>
    </View>
  );
}

function StepFooter({
  disabled,
  isLastStep,
  loading,
  onNext,
}: {
  disabled: boolean;
  isLastStep: boolean;
  loading: boolean;
  onNext: () => void;
}) {
  return (
    <View style={styles.footer}>
      <KasaButton
        disabled={disabled}
        label={isLastStep ? "Publish campaign" : "Continue"}
        leftIcon={isLastStep ? <Ionicons color={kasaColors.white} name="megaphone-outline" size={18} /> : undefined}
        loading={loading}
        onPress={onNext}
      />
    </View>
  );
}

function StepCategory({
  value,
  onSelect,
}: {
  value: CampaignCategory | null;
  onSelect: (category: CampaignCategory) => void;
}) {
  return (
    <View>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowIcon}>
          <Ionicons name="heart" size={14} color={COLORS.primary} />
        </View>
        <Text style={styles.eyebrow}>START A FUNDRAISER</Text>
      </View>
      <Text style={styles.stepTitle}>What are you raising money for?</Text>
      <Text style={styles.stepSubtitle}>
        Choose the category that best describes your cause. Donors will use it
        to discover your campaign.
      </Text>

      <View style={styles.categoryGrid}>
        {CATEGORIES.map((category) => {
          const selected = category.key === value;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              key={category.key}
              onPress={() => onSelect(category.key)}
              style={[styles.categoryCard, selected && styles.selectedCard]}
            >
              <View
                style={[
                  styles.categoryIcon,
                  selected && styles.selectedIcon,
                ]}
              >
                <Ionicons
                  name={category.icon}
                  size={21}
                  color={selected ? COLORS.background : COLORS.primary}
                />
              </View>
              <Text
                style={[
                  styles.categoryLabel,
                  selected && styles.selectedLabel,
                ]}
              >
                {category.label}
              </Text>
              {selected && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={COLORS.primary}
                  style={styles.categoryCheck}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepStory({
  form,
  onChange,
}: {
  form: CampaignForm;
  onChange: (updates: Partial<CampaignForm>) => void;
}) {
  const [focused, setFocused] = useState<"title" | "name" | "story" | null>(
    null
  );
  const needsBeneficiaryName =
    form.beneficiary === "someone" || form.beneficiary === "community";

  const pickCoverImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow photo access to choose a cover image for your campaign."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onChange({ coverImage: result.assets[0] });
      }
    } catch {
      Alert.alert(
        "Could not open photos",
        "Please try selecting your campaign image again."
      );
    }
  };

  return (
    <View>
      <Text style={styles.stepTitle}>Tell people who this will help</Text>
      <Text style={styles.stepSubtitle}>
        A clear title and an honest story help donors understand why their
        support matters.
      </Text>

      <Text style={styles.label}>Campaign cover (optional)</Text>
      {form.coverImage ? (
        <View style={styles.coverPreview}>
          <Image
            resizeMode="cover"
            source={{ uri: form.coverImage.uri }}
            style={styles.coverImage}
          />
          <View style={styles.coverActions}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={pickCoverImage}
              style={styles.coverActionButton}
            >
              <Ionicons name="images-outline" size={16} color={COLORS.text} />
              <Text style={styles.coverActionText}>Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => onChange({ coverImage: null })}
              style={styles.coverRemoveButton}
            >
              <Ionicons name="trash-outline" size={17} color={COLORS.background} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={pickCoverImage}
          style={styles.coverPicker}
        >
          <View style={styles.coverPickerIcon}>
            <Ionicons name="image-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.coverPickerCopy}>
            <Text style={styles.coverPickerTitle}>Add a cover image</Text>
            <Text style={styles.coverPickerDescription}>
              Choose a clear photo that helps tell your story
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.placeholder} />
        </TouchableOpacity>
      )}

      <Text style={[styles.label, styles.beneficiaryLabel]}>
        Who are you raising for?
      </Text>
      <View style={styles.optionStack}>
        {BENEFICIARIES.map((item) => {
          const selected = item.key === form.beneficiary;
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              key={item.key}
              onPress={() =>
                onChange({
                  beneficiary: item.key,
                  beneficiaryName:
                    item.key === "myself" ? "" : form.beneficiaryName,
                })
              }
              style={[styles.optionCard, selected && styles.selectedCard]}
            >
              <View style={[styles.optionIcon, selected && styles.selectedIcon]}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={selected ? COLORS.background : COLORS.primary}
                />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{item.label}</Text>
                <Text style={styles.optionDescription}>{item.description}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {needsBeneficiaryName && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            {form.beneficiary === "community"
              ? "Group or community name"
              : "Beneficiary name"}
          </Text>
          <View
            style={[
              styles.inputWrapper,
              focused === "name" && styles.inputFocused,
            ]}
          >
            <TextInput
              autoCapitalize="words"
              onBlur={() => setFocused(null)}
              onChangeText={(beneficiaryName) => onChange({ beneficiaryName })}
              onFocus={() => setFocused("name")}
              placeholder={
                form.beneficiary === "community"
                  ? "e.g. Nsawam Community"
                  : "e.g. Ama Mensah"
              }
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              value={form.beneficiaryName}
            />
          </View>
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Campaign title</Text>
        <View
          style={[
            styles.inputWrapper,
            focused === "title" && styles.inputFocused,
          ]}
        >
          <TextInput
            autoCapitalize="sentences"
            maxLength={70}
            onBlur={() => setFocused(null)}
            onChangeText={(title) => onChange({ title })}
            onFocus={() => setFocused("title")}
            placeholder="e.g. Help Ama receive urgent surgery"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            value={form.title}
          />
        </View>
        <Text style={styles.characterCount}>{form.title.length}/70</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Your story</Text>
        <View
          style={[
            styles.inputWrapper,
            styles.storyInputWrapper,
            focused === "story" && styles.inputFocused,
          ]}
        >
          <TextInput
            maxLength={800}
            multiline
            numberOfLines={7}
            onBlur={() => setFocused(null)}
            onChangeText={(story) => onChange({ story })}
            onFocus={() => setFocused("story")}
            placeholder="Explain what happened, how the funds will be used, and why support is needed now."
            placeholderTextColor={COLORS.placeholder}
            style={[styles.input, styles.storyInput]}
            textAlignVertical="top"
            value={form.story}
          />
        </View>
        <View style={styles.fieldHintRow}>
          <Text style={styles.fieldHint}>
            At least {MIN_STORY_LENGTH} characters
          </Text>
          <Text style={styles.characterCount}>{form.story.length}/800</Text>
        </View>
      </View>
    </View>
  );
}

function StepGoal({
  form,
  onChange,
}: {
  form: CampaignForm;
  onChange: (updates: Partial<CampaignForm>) => void;
}) {
  const [goalFocused, setGoalFocused] = useState(false);

  return (
    <View>
      <Text style={styles.stepTitle}>Set a goal you can explain</Text>
      <Text style={styles.stepSubtitle}>
        Estimate the full amount needed, including any fees or related costs.
        You can continue receiving donations until the campaign ends.
      </Text>

      <Text style={styles.label}>Fundraising goal</Text>
      <View
        style={[
          styles.inputWrapper,
          styles.goalInputWrapper,
          goalFocused && styles.inputFocused,
        ]}
      >
        <View style={styles.currencyBadge}>
          <Text style={styles.currencyBadgeText}>GH₵</Text>
        </View>
        <TextInput
          keyboardType="number-pad"
          onBlur={() => setGoalFocused(false)}
          onChangeText={(value) => onChange({ goal: value.replace(/\D/g, "") })}
          onFocus={() => setGoalFocused(true)}
          placeholder="0"
          placeholderTextColor={COLORS.placeholder}
          style={styles.goalInput}
          value={form.goal}
        />
      </View>

      <View style={styles.tipCard}>
        <Ionicons name="bulb-outline" size={19} color={COLORS.primary} />
        <Text style={styles.tipText}>
          Break the total down in your story so donors know exactly where their
          money is going.
        </Text>
      </View>

      <Text style={[styles.label, styles.sectionLabel]}>Campaign duration</Text>
      <View style={styles.deadlineGrid}>
        {DEADLINES.map((deadline) => {
          const selected = deadline.key === form.deadline;
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              key={deadline.key}
              onPress={() => onChange({ deadline: deadline.key })}
              style={[styles.deadlineCard, selected && styles.selectedCard]}
            >
              <Text
                style={[
                  styles.deadlineLabel,
                  selected && styles.selectedLabel,
                ]}
              >
                {deadline.label}
              </Text>
              <Text style={styles.deadlineDescription}>
                {deadline.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepSharing({
  form,
  onChange,
}: {
  form: CampaignForm;
  onChange: (updates: Partial<CampaignForm>) => void;
}) {
  return (
    <View>
      <Text style={styles.stepTitle}>Choose how people find your campaign</Text>
      <Text style={styles.stepSubtitle}>
        You can share either option directly with friends, family, and your
        community.
      </Text>

      <View style={styles.optionStack}>
        <VisibilityCard
          description="Anyone can discover it in Fundraising and donate."
          icon="globe-outline"
          label="Public campaign"
          onPress={() => onChange({ visibility: "public" })}
          selected={form.visibility === "public"}
        />
        <VisibilityCard
          description="Only people with your campaign link can view it."
          icon="link-outline"
          label="Link only"
          onPress={() => onChange({ visibility: "link-only" })}
          selected={form.visibility === "link-only"}
        />
      </View>

      <View style={styles.settingCard}>
        <View style={styles.settingCopy}>
          <Text style={styles.optionLabel}>Allow anonymous donations</Text>
          <Text style={styles.optionDescription}>
            Donors can hide their name while the amount still counts toward
            your goal.
          </Text>
        </View>
        <Switch
          ios_backgroundColor={COLORS.border}
          onValueChange={(allowAnonymousDonations) =>
            onChange({ allowAnonymousDonations })
          }
          thumbColor={COLORS.background}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
          value={form.allowAnonymousDonations}
        />
      </View>

      <Text style={[styles.label, styles.sectionLabel]}>Campaign theme</Text>
      <Text style={styles.themeHelp}>
        This colour will appear on your campaign card and cover.
      </Text>
      <View style={styles.colorRow}>
        {COVER_COLORS.map((color) => {
          const selected = color === form.coverColor;
          return (
            <TouchableOpacity
              accessibilityLabel={`Select ${color} campaign theme`}
              accessibilityRole="button"
              activeOpacity={0.8}
              key={color}
              onPress={() => onChange({ coverColor: color })}
              style={[
                styles.colorSwatchOuter,
                selected && styles.colorSwatchOuterSelected,
              ]}
            >
              <View style={[styles.colorSwatch, { backgroundColor: color }]}>
                {selected && (
                  <Ionicons name="checkmark" size={18} color={COLORS.background} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function VisibilityCard({
  description,
  icon,
  label,
  onPress,
  selected,
}: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.optionCard, selected && styles.selectedCard]}
    >
      <View style={[styles.optionIcon, selected && styles.selectedIcon]}>
        <Ionicons
          name={icon}
          size={20}
          color={selected ? COLORS.background : COLORS.primary}
        />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </TouchableOpacity>
  );
}

function StepReview({ form }: { form: CampaignForm }) {
  const category = categoryDetails(form.category);
  const beneficiary = BENEFICIARIES.find(
    (item) => item.key === form.beneficiary
  );
  const beneficiaryValue =
    form.beneficiary === "myself"
      ? "Myself"
      : form.beneficiaryName || beneficiary?.label || "—";
  const rows = [
    { label: "Goal", value: formatGoal(form.goal) },
    { label: "Duration", value: `${form.deadline} days` },
    { label: "Beneficiary", value: beneficiaryValue },
    {
      label: "Visibility",
      value: form.visibility === "public" ? "Public" : "Link only",
    },
  ];

  return (
    <View>
      <Text style={styles.stepTitle}>Ready to make a difference?</Text>
      <Text style={styles.stepSubtitle}>
        Review the campaign as donors will see it. You can go back to edit any
        detail before publishing.
      </Text>

      <View style={styles.previewCard}>
        <View style={[styles.previewCover, { backgroundColor: form.coverColor }]}>
          {form.coverImage && (
            <Image
              resizeMode="cover"
              source={{ uri: form.coverImage.uri }}
              style={styles.previewCoverImage}
            />
          )}
          {form.coverImage && <View style={styles.previewCoverShade} />}
          <View style={styles.previewCategoryBadge}>
            {category && (
              <Ionicons name={category.icon} size={13} color={COLORS.background} />
            )}
            <Text style={styles.previewCategoryText}>
              {category?.label ?? "Campaign"}
            </Text>
          </View>
          <Ionicons
            name="heart-circle-outline"
            size={64}
            color="rgba(255,255,255,0.28)"
          />
        </View>
        <View style={styles.previewBody}>
          <Text style={styles.previewTitle}>{form.title}</Text>
          <Text style={styles.previewStory} numberOfLines={3}>
            {form.story}
          </Text>
          <View style={styles.previewProgressTrack}>
            <View style={styles.previewProgressStart} />
          </View>
          <View style={styles.previewStats}>
            <View>
              <Text style={styles.previewGoal}>{formatGoal(form.goal)}</Text>
              <Text style={styles.previewMeta}>fundraising goal</Text>
            </View>
            <View style={styles.previewStatRight}>
              <Text style={styles.previewGoal}>{form.deadline}</Text>
              <Text style={styles.previewMeta}>days to raise</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.reviewCard}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[
              styles.reviewRow,
              index === rows.length - 1 && styles.reviewRowLast,
            ]}
          >
            <Text style={styles.reviewLabel}>{row.label}</Text>
            <Text style={styles.reviewValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.publishNotice}>
        <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
        <Text style={styles.publishNoticeText}>
          Publish only information you have permission to share. You remain
          responsible for keeping donors updated on how funds are used.
        </Text>
      </View>
    </View>
  );
}

export default function CreateCampaignScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CampaignForm>({
    category: null,
    title: "",
    beneficiary: null,
    beneficiaryName: "",
    story: "",
    goal: "",
    deadline: null,
    visibility: "public",
    allowAnonymousDonations: true,
    coverColor: COLORS.primary,
    coverImage: null,
  });

  const updateForm = (updates: Partial<CampaignForm>) => {
    setForm((current) => ({ ...current, ...updates }));
  };

  const canContinue = (() => {
    switch (step) {
      case 1:
        return form.category !== null;
      case 2: {
        const beneficiaryIsValid =
          form.beneficiary === "myself" ||
          ((form.beneficiary === "someone" ||
            form.beneficiary === "community") &&
            form.beneficiaryName.trim().length >= 2);
        return (
          beneficiaryIsValid &&
          form.title.trim().length >= 5 &&
          form.story.trim().length >= MIN_STORY_LENGTH
        );
      }
      case 3:
        return Number(form.goal) > 0 && form.deadline !== null;
      default:
        return true;
    }
  })();

  const handleBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    setStep((current) => current - 1);
  };

  const handleNext = async () => {
    if (!canContinue) {
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep((current) => current + 1);
      return;
    }

    if (!form.category || !form.deadline || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + form.deadline);
      const uploadedCover = form.coverImage
        ? await apiService.uploadImage(form.coverImage, "campaign")
        : null;
      await apiService.createCampaign({
        title: form.title.trim(),
        description: form.story.trim(),
        category: form.category,
        coverImageUrl: uploadedCover?.data.url,
        goalAmount: Math.round(Number(form.goal) * 100),
        deadline: deadline.toISOString(),
        isPublic: form.visibility === "public",
        allowAnonymousDonations: form.allowAnonymousDonations,
      });
      router.replace("/(tabs)/fundraising");
    } catch (error) {
      Alert.alert(
        "Could not publish campaign",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <StepHeader
          onBack={handleBack}
          onClose={() => router.back()}
          step={step}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <StepCategory
              onSelect={(category) => updateForm({ category })}
              value={form.category}
            />
          )}
          {step === 2 && <StepStory form={form} onChange={updateForm} />}
          {step === 3 && <StepGoal form={form} onChange={updateForm} />}
          {step === 4 && <StepSharing form={form} onChange={updateForm} />}
          {step === 5 && <StepReview form={form} />}
        </ScrollView>

        <StepFooter
          disabled={!canContinue || isSubmitting}
          isLastStep={step === TOTAL_STEPS}
          loading={isSubmitting}
          onNext={handleNext}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleCopy: {
    flex: 1,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  stepCount: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginTop: 2,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.border,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
  },
  eyebrowIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.successSurface,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: COLORS.primary,
  },
  stepTitle: {
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: COLORS.text,
    marginBottom: 9,
  },
  stepSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textMuted,
    marginBottom: 26,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  coverPicker: {
    minHeight: 86,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
  },
  coverPickerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.successSurface,
  },
  coverPickerCopy: {
    flex: 1,
    gap: 3,
  },
  coverPickerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  coverPickerDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textMuted,
  },
  coverPreview: {
    height: 178,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverActions: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  coverActionButton: {
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  coverActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
  },
  coverRemoveButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,33,28,0.82)",
  },
  beneficiaryLabel: {
    marginTop: 24,
  },
  categoryCard: {
    position: "relative",
    width: "47.8%",
    minHeight: 116,
    padding: 15,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: "space-between",
  },
  selectedCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  selectedIcon: {
    backgroundColor: COLORS.primary,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  selectedLabel: {
    color: COLORS.primary,
  },
  categoryCheck: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  optionStack: {
    gap: 10,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  optionText: {
    flex: 1,
    gap: 3,
  },
  optionLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    color: COLORS.text,
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textMuted,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.placeholder,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  fieldGroup: {
    marginTop: 22,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    minHeight: 52,
    fontSize: 15,
    color: COLORS.text,
  },
  storyInputWrapper: {
    height: 160,
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  storyInput: {
    height: "100%",
  },
  fieldHintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  characterCount: {
    fontSize: 11,
    color: COLORS.placeholder,
    textAlign: "right",
    marginTop: 6,
  },
  goalInputWrapper: {
    height: 64,
    paddingLeft: 10,
  },
  currencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: COLORS.successSurface,
    marginRight: 10,
  },
  currencyBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  goalInput: {
    flex: 1,
    height: "100%",
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 13,
    backgroundColor: COLORS.successSurface,
    marginTop: 14,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.primaryDark,
  },
  sectionLabel: {
    marginTop: 28,
  },
  deadlineGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  deadlineCard: {
    width: "48.4%",
    padding: 15,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  deadlineLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 3,
  },
  deadlineDescription: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  settingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginTop: 18,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
  },
  settingCopy: {
    flex: 1,
    gap: 4,
  },
  themeHelp: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: -3,
    marginBottom: 14,
  },
  colorRow: {
    flexDirection: "row",
    gap: 14,
  },
  colorSwatchOuter: {
    width: 54,
    height: 54,
    padding: 3,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchOuterSelected: {
    borderColor: COLORS.primary,
  },
  colorSwatch: {
    flex: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCard: {
    borderRadius: 18,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    shadowColor: "#10211B",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  previewCover: {
    position: "relative",
    height: 132,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewCoverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewCoverShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  previewCategoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  previewCategoryText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.background,
  },
  previewBody: {
    padding: 17,
  },
  previewTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  previewStory: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
    marginTop: 7,
  },
  previewProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    overflow: "hidden",
    marginTop: 16,
  },
  previewProgressStart: {
    width: 8,
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  previewStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  previewStatRight: {
    alignItems: "flex-end",
  },
  previewGoal: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  previewMeta: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  reviewCard: {
    marginTop: 18,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    minHeight: 51,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  reviewRowLast: {
    borderBottomWidth: 0,
  },
  reviewLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  reviewValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "right",
  },
  publishNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    marginTop: 16,
    borderRadius: 13,
    backgroundColor: COLORS.successSurface,
  },
  publishNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.primaryDark,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  primaryButton: {
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
  },
  primaryButtonDisabled: {
    opacity: 0.38,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.background,
  },
});
