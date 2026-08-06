import { AnimatedLoader, KasaButton, KasaCard, KasaChoiceCard, KasaMoneyInput } from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { Ionicons } from "@expo/vector-icons";
import {
  apiService,
  GROUP_AGREEMENT_VERSION,
  type DirectoryUser,
} from "@/services/apiService";
import * as ImagePicker from "expo-image-picker";
import { Image as ExpoImage } from "expo-image";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";

const COLORS = {
  primary: kasaColors.brand,
  primaryDark: kasaColors.brandStrong,
  accent: kasaColors.accent,
  background: kasaColors.surface,
  surface: kasaColors.background,
  border: kasaColors.border,
  borderFocus: kasaColors.brand,
  text: kasaColors.text,
  textMuted: kasaColors.textMuted,
  placeholder: "#9AA8A3",
  error: kasaColors.danger,
};

const TOTAL_STEPS = 7;
const STEP_TITLES = ["Saving model", "Details", "Contribution", "Visibility", "Invitations", "Group rules", "Review"] as const;

type GroupType = "susu" | "family" | "church" | "cooperative" | "other";
type Frequency = "daily" | "weekly" | "monthly";
type SavingModel = "rotational" | "collective_goal";

type Member = {
  id: string;
  name: string;
  avatar?: string;
};

type RotationEntry = Member & { isCreator?: boolean };

type FormState = {
  savingModel: SavingModel | null;
  groupType: GroupType | null;
  name: string;
  description: string;
  coverImage: ImagePicker.ImagePickerAsset | null;
  amount: string;
  goalAmount: string;
  frequency: Frequency | null;
  gracePeriodDays: string;
  penaltyAmount: string;
  expectedMemberCount: string;
  isPublic: boolean;
  creatorPayoutPosition: number;
  members: Member[];
};

const GROUP_TYPES: { key: GroupType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "susu", label: "Susu", icon: "sync-outline" },
  { key: "family", label: "Family", icon: "home-outline" },
  { key: "church", label: "Church", icon: "book-outline" },
  { key: "cooperative", label: "Cooperative", icon: "business-outline" },
  { key: "other", label: "Other", icon: "ellipsis-horizontal-outline" },
];

const FREQUENCIES: { key: Frequency; label: string; sublabel: string }[] = [
  { key: "daily", label: "Daily", sublabel: "Contribute every day" },
  { key: "weekly", label: "Weekly", sublabel: "Contribute once a week" },
  { key: "monthly", label: "Monthly", sublabel: "Contribute once a month" },
];

// ---------- Shared shell pieces ----------

function StepHeader({
  step,
  topInset,
  onBack,
  onClose,
}: {
  step: number;
  topInset: number;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <View
      style={[
        styles.header,
        { paddingTop: Platform.OS === "ios" ? 20 : topInset + 4 },
      ]}
    >
      <View style={styles.headerMainRow}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={onBack} hitSlop={8} style={({ pressed }) => [styles.headerIconBtn, pressed && styles.controlPressed]}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Create group</Text>
          <Text style={styles.stepMetaCount}>{STEP_TITLES[step - 1]} · {step} of {TOTAL_STEPS}</Text>
        </View>
        <Pressable accessibilityLabel="Close create group" accessibilityRole="button" onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.headerIconBtn, pressed && styles.controlPressed]}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
      </View>
      <View
        accessibilityLabel={`Create group progress, ${STEP_TITLES[step - 1]}, step ${step} of ${TOTAL_STEPS}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: step }}
        style={styles.progressTrack}
      >
          <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>
    </View>
  );
}

function StepFooter({
  onNext,
  nextLabel = "Continue",
  disabled = false,
  loading = false,
  bottomInset,
  helperText,
}: {
  onNext: () => void;
  nextLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  bottomInset: number;
  helperText?: string;
}) {
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, 16) }]}>
      {disabled && helperText ? <Text style={styles.footerHint}>{helperText}</Text> : null}
      <KasaButton disabled={disabled} label={nextLabel} loading={loading} onPress={onNext} />
    </View>
  );
}

// ---------- Step 1: Saving model ----------

function StepSavingModel({
  value,
  onSelect,
}: {
  value: SavingModel | null;
  onSelect: (v: SavingModel) => void;
}) {
  const options = [
    {
      key: "rotational" as const,
      title: "Rotational susu",
      description: "Members take turns receiving the pot.",
      detail: "Everyone contributes each cycle until every member has received once.",
      icon: "sync-outline" as const,
    },
    {
      key: "collective_goal" as const,
      title: "Collective goal",
      description: "Everyone saves toward one shared target.",
      detail: "The funds stay together until the target is reached and members approve a payout.",
      icon: "flag-outline" as const,
    },
  ];
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>How will this group save?</Text>
      <Text style={styles.stepSubtitle}>
        This choice controls how contributions are held and released.
      </Text>

      <View style={styles.modelList}>
        {options.map((option) => {
          const isActive = value === option.key;
          return (
            <KasaChoiceCard
              accessibilityLabel={option.title}
              key={option.key}
              style={[styles.modelCard, isActive && styles.typeCardActive]}
              onPress={() => onSelect(option.key)}
              selected={isActive}
            >
              <View style={[styles.modelIconWrap, isActive && styles.modelIconWrapActive]}>
                <Ionicons name={option.icon} size={22} color={isActive ? COLORS.background : COLORS.primary} />
              </View>
              <View style={styles.modelCopy}>
                <Text style={[styles.modelTitle, isActive && styles.typeLabelActive]}>{option.title}</Text>
                <Text style={styles.modelDescription}>{option.description}</Text>
                <Text style={styles.modelDetail}>{option.detail}</Text>
              </View>
              <Ionicons name={isActive ? "checkmark-circle" : "ellipse-outline"} size={22} color={isActive ? COLORS.primary : COLORS.placeholder} />
            </KasaChoiceCard>
          );
        })}
      </View>
    </View>
  );
}

// ---------- Step 2: Name, description, cover ----------

function StepDetails({
  groupType,
  name,
  description,
  coverImage,
  onChangeName,
  onChangeDescription,
  onChangeCoverImage,
  onSelectGroupType,
}: {
  groupType: GroupType | null;
  name: string;
  description: string;
  coverImage: ImagePicker.ImagePickerAsset | null;
  onChangeName: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangeCoverImage: (image: ImagePicker.ImagePickerAsset | null) => void;
  onSelectGroupType: (value: GroupType) => void;
}) {
  const [focused, setFocused] = useState<"name" | "desc" | null>(null);

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
    if (!result.canceled && result.assets[0]) onChangeCoverImage(result.assets[0]);
  };

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Give your group a name</Text>
      <Text style={styles.stepSubtitle}>
        Members will see this name, so make it easy to recognize.
      </Text>

      <Text style={styles.label}>Community type</Text>
      <View style={styles.categoryChips}>
        {GROUP_TYPES.map((type) => {
          const active = groupType === type.key;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={type.key}
              onPress={() => onSelectGroupType(type.key)}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
            >
              <Ionicons name={type.icon} size={15} color={active ? COLORS.background : COLORS.textMuted} />
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{type.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 20 }}>
        <Text style={styles.label}>Group name</Text>
        <View style={[styles.inputWrapper, focused === "name" && styles.inputWrapperFocused]}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Family Susu"
            placeholderTextColor={COLORS.placeholder}
            value={name}
            onChangeText={onChangeName}
            onFocus={() => setFocused("name")}
            onBlur={() => setFocused(null)}
          />
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <Text style={styles.label}>Description (optional)</Text>
        <View
          style={[
            styles.inputWrapper,
            styles.textAreaWrapper,
            focused === "desc" && styles.inputWrapperFocused,
          ]}
        >
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What's this group for?"
            placeholderTextColor={COLORS.placeholder}
            value={description}
            onChangeText={onChangeDescription}
            onFocus={() => setFocused("desc")}
            onBlur={() => setFocused(null)}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>

      <Text style={[styles.label, { marginTop: 18 }]}>Group cover (optional)</Text>
      {coverImage ? (
        <View style={styles.groupCoverPreview}>
          <ExpoImage contentFit="cover" source={{ uri: coverImage.uri }} style={styles.groupCoverImage} />
          <View style={styles.groupCoverActions}>
            <TouchableOpacity onPress={chooseCover} style={styles.coverSmallButton}>
              <Ionicons name="images-outline" size={16} color={COLORS.text} />
              <Text style={styles.coverSmallButtonText}>Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChangeCoverImage(null)} style={styles.coverDeleteButton}>
              <Ionicons name="trash-outline" size={17} color={COLORS.background} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity activeOpacity={0.8} onPress={chooseCover} style={styles.groupCoverPicker}>
          <View style={styles.groupCoverPickerIcon}>
            <Ionicons name="image-outline" size={23} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.freqLabel}>Add a group cover</Text>
            <Text style={styles.freqSublabel}>Help members recognize this group</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.placeholder} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------- Step 3: Contribution settings ----------

function StepContribution({
  savingModel,
  amount,
  goalAmount,
  frequency,
  gracePeriodDays,
  penaltyAmount,
  expectedMemberCount,
  onChangeAmount,
  onChangeGoalAmount,
  onChangeGracePeriod,
  onChangePenalty,
  onChangeExpectedMemberCount,
  onSelectFrequency,
}: {
  savingModel: SavingModel;
  amount: string;
  goalAmount: string;
  frequency: Frequency | null;
  gracePeriodDays: string;
  penaltyAmount: string;
  expectedMemberCount: string;
  onChangeAmount: (v: string) => void;
  onChangeGoalAmount: (v: string) => void;
  onChangeGracePeriod: (v: string) => void;
  onChangePenalty: (v: string) => void;
  onChangeExpectedMemberCount: (v: string) => void;
  onSelectFrequency: (v: Frequency) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Set your contribution</Text>
      <Text style={styles.stepSubtitle}>
        How much should each member contribute, and how often?
      </Text>

      <KasaMoneyInput
        error={amount.length > 0 && Number(amount) <= 0 ? "Enter an amount greater than zero." : undefined}
        label="Amount per member"
        onChangeText={onChangeAmount}
        value={amount}
      />

      {savingModel === "collective_goal" ? (
        <View style={styles.goalField}>
          <KasaMoneyInput
            error={goalAmount.length > 0 && Number(goalAmount) < Number(amount) ? "The goal must be at least one contribution." : undefined}
            label="Shared savings goal"
            onChangeText={onChangeGoalAmount}
            value={goalAmount}
          />
          <View style={styles.goalNote}>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.primary} />
            <Text style={styles.goalNoteText}>When the goal is reached, contributions pause and members decide the payout by majority vote.</Text>
          </View>
        </View>
      ) : null}

      <Text style={[styles.label, { marginTop: 20 }]}>Frequency</Text>
      <View style={{ gap: 10 }}>
        {FREQUENCIES.map((f) => {
          const isActive = frequency === f.key;
          return (
            <KasaChoiceCard
              accessibilityLabel={f.label}
              key={f.key}
              style={[styles.freqCard, isActive && styles.freqCardActive]}
              onPress={() => onSelectFrequency(f.key)}
              selected={isActive}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.freqLabel, isActive && styles.freqLabelActive]}>
                  {f.label}
                </Text>
                <Text style={styles.freqSublabel}>{f.sublabel}</Text>
              </View>
              <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                {isActive && <View style={styles.radioInner} />}
              </View>
            </KasaChoiceCard>
          );
        })}
      </View>

      <View style={styles.rulesRow}>
        <View style={styles.ruleField}>
          <Text style={styles.label}>Grace period</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => onChangeGracePeriod(value.replace(/\D/g, ""))}
              placeholder="0"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              value={gracePeriodDays}
            />
            <Text style={styles.inputSuffix}>days</Text>
          </View>
        </View>
        <View style={styles.ruleField}>
          <Text style={styles.label}>Late penalty</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.smallCurrency}>GH₵</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={onChangePenalty}
              placeholder="0.00"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              value={penaltyAmount}
            />
          </View>
        </View>
      </View>
      <Text style={styles.fieldHint}>
        The penalty is applied after the grace period. Set it to zero for no fee.
      </Text>

      <Text style={[styles.label, { marginTop: 20 }]}>Planned group size</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          accessibilityLabel="Expected number of group members"
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={(value) => onChangeExpectedMemberCount(value.replace(/\D/g, ""))}
          placeholder="4"
          placeholderTextColor={COLORS.placeholder}
          style={styles.input}
          value={expectedMemberCount}
        />
        <Text style={styles.inputSuffix}>members</Text>
      </View>
      <Text style={styles.fieldHint}>
        The first cycle starts only after this many members have accepted and you activate the group.
      </Text>
    </View>
  );
}

// ---------- Step 4: Visibility ----------

function StepVisibility({ isPublic, onChange }: { isPublic: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Who can find this group?</Text>
      <Text style={styles.stepSubtitle}>
        This controls discovery only. Both options still get a private invite link.
      </Text>
      <KasaChoiceCard
        accessibilityLabel="Private group"
        onPress={() => onChange(false)}
        selected={!isPublic}
        style={[styles.visibilityCard, !isPublic && styles.visibilityCardActive]}
      >
        <View style={[styles.visibilityIcon, !isPublic && styles.visibilityIconActive]}>
          <Ionicons name="lock-closed-outline" size={21} color={!isPublic ? COLORS.background : COLORS.primary} />
        </View>
        <View style={styles.visibilityCopy}>
          <Text style={styles.freqLabel}>Private group</Text>
          <Text style={styles.freqSublabel}>Only invited people or anyone with your link can join.</Text>
        </View>
        <View style={[styles.radioOuter, !isPublic && styles.radioOuterActive]}>
          {!isPublic && <View style={styles.radioInner} />}
        </View>
      </KasaChoiceCard>
      <KasaChoiceCard
        accessibilityLabel="Public group"
        onPress={() => onChange(true)}
        selected={isPublic}
        style={[styles.visibilityCard, isPublic && styles.visibilityCardActive]}
      >
        <View style={[styles.visibilityIcon, isPublic && styles.visibilityIconActive]}>
          <Ionicons name="globe-outline" size={21} color={isPublic ? COLORS.background : COLORS.primary} />
        </View>
        <View style={styles.visibilityCopy}>
          <Text style={styles.freqLabel}>Public group</Text>
          <Text style={styles.freqSublabel}>Listed in Discover so any KasaFund user can request to join.</Text>
        </View>
        <View style={[styles.radioOuter, isPublic && styles.radioOuterActive]}>
          {isPublic && <View style={styles.radioInner} />}
        </View>
      </KasaChoiceCard>
      {isPublic && (
        <View style={styles.publicNotice}>
          <Ionicons name="compass-outline" size={18} color={COLORS.primary} />
          <Text style={styles.publicNoticeText}>This group will appear under Groups → Discover immediately after creation.</Text>
        </View>
      )}
    </View>
  );
}

// ---------- Step 5: Invite members ----------

function StepInvite({
  members,
  onToggleMember,
}: {
  members: Member[];
  onToggleMember: (m: Member) => void;
}) {
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isSelected = (id: string) => members.some((m) => m.id === id);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const response = await apiService.getUserDirectory(query);
        if (active) setContacts(response.data);
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Could not load users.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, query ? 250 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Invite members</Text>
      <Text style={styles.stepSubtitle}>
        Invite registered KasaFund users now. You can also share a link after creating the group.
      </Text>

      <View style={styles.shareLinkCard}>
        <View style={styles.discoverIconWrap}>
          <Ionicons name="link-outline" size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.freqLabel}>Invite link included</Text>
          <Text style={styles.freqSublabel}>It will be ready to copy or share after creation</Text>
        </View>
        <Ionicons name="checkmark-circle" size={19} color={COLORS.primary} />
      </View>

      <Text style={[styles.label, { marginTop: 20, marginBottom: 10 }]}>
        KasaFund members
      </Text>

      <View style={styles.directorySearch}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          autoCapitalize="none"
          onChangeText={setQuery}
          placeholder="Search by name or email"
          placeholderTextColor={COLORS.placeholder}
          style={styles.directorySearchInput}
          value={query}
        />
      </View>

      {loading ? (
        <View style={styles.directoryState}>
          <AnimatedLoader accessibilityLabel="Loading members" size="compact" />
        </View>
      ) : error ? (
        <View style={styles.directoryState}>
          <Ionicons name="cloud-offline-outline" size={23} color={COLORS.placeholder} />
          <Text style={styles.emptySubtitle}>{error}</Text>
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.directoryState}>
          <Ionicons name="search-outline" size={23} color={COLORS.placeholder} />
          <Text style={styles.emptySubtitle}>No matching KasaFund users found.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
        {contacts.map((contact) => {
          const selected = isSelected(contact._id);
          return (
            <TouchableOpacity
              key={contact._id}
              style={styles.contactRow}
              onPress={() =>
                onToggleMember({
                  id: contact._id,
                  name: contact.fullName,
                  avatar: contact.avatarUrl,
                })
              }
              activeOpacity={0.85}
            >
              <View style={styles.contactLeft}>
                <View style={styles.contactAvatarWrap}>
                  {contact.avatarUrl ? (
                    <ExpoImage cachePolicy="memory-disk" contentFit="cover" source={{ uri: contact.avatarUrl }} style={styles.contactAvatarImage} />
                  ) : (
                    <Text style={styles.contactAvatarText}>
                      {contact.fullName.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.freqLabel}>{contact.fullName}</Text>
              </View>
              <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                {selected && (
                  <Ionicons name="checkmark" size={14} color={COLORS.background} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        </View>
      )}
    </View>
  );
}

// ---------- Step 6: Rotation order (drag to reorder) ----------

function StepRotation({
  members,
  creatorPosition,
  onReorder,
}: {
  members: Member[];
  creatorPosition: number;
  onReorder: (members: Member[], creatorPosition: number) => void;
}) {
  const entries: RotationEntry[] = [...members];
  entries.splice(Math.min(creatorPosition, members.length), 0, {
    id: "__creator__",
    name: "You",
    isCreator: true,
  });

  const applyOrder = (data: RotationEntry[]) => {
    const nextCreatorPosition = data.findIndex((entry) => entry.isCreator);
    onReorder(
      data
        .filter((entry) => !entry.isCreator)
        .map(({ id, name, avatar }) => ({ id, name, avatar })),
      nextCreatorPosition
    );
  };

  const moveMember = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;
    const updated = [...entries];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    applyOrder(updated);
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<RotationEntry>) => {
    const index = getIndex() ?? 0;
    return (
      <TouchableOpacity
        accessibilityHint="Long press and drag to change this member's payout position"
        activeOpacity={0.92}
        disabled={isActive}
        onLongPress={drag}
        style={[styles.rotationRow, isActive && styles.rotationRowActive]}
      >
        <View style={[styles.rotationIndex, isActive && styles.rotationIndexActive]}>
          <Text style={[styles.rotationIndexText, isActive && styles.rotationIndexTextActive]}>{index + 1}</Text>
        </View>
        <View style={[styles.contactAvatarWrap, item.isCreator && styles.ownerAvatar]}>
          {item.isCreator ? (
            <Ionicons name="person" size={17} color={COLORS.background} />
          ) : item.avatar ? (
            <ExpoImage cachePolicy="memory-disk" contentFit="cover" source={{ uri: item.avatar }} style={styles.contactAvatarImage} />
          ) : (
            <Text style={styles.contactAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.rotationCopy}>
          <Text style={styles.rotationName}>{item.name}</Text>
          <Text style={styles.rotationPositionLabel}>
            {item.isCreator ? "Group creator · " : ""}Payout position {index + 1}
          </Text>
        </View>
        <TouchableOpacity disabled={index === 0 || isActive} hitSlop={5} onPress={() => moveMember(index, -1)} style={styles.rotationMoveButton}>
          <Ionicons name="chevron-up" size={17} color={index === 0 ? COLORS.placeholder : COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity disabled={index === entries.length - 1 || isActive} hitSlop={5} onPress={() => moveMember(index, 1)} style={styles.rotationMoveButton}>
          <Ionicons name="chevron-down" size={17} color={index === entries.length - 1 ? COLORS.placeholder : COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel={`Drag ${item.name}`} disabled={isActive} onLongPress={drag} style={styles.rotationDragHandle}>
          <Ionicons name="reorder-three" size={21} color={isActive ? COLORS.primary : COLORS.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Set the payout order</Text>
      <Text style={styles.stepSubtitle}>
        Ownership does not determine payout priority. Arrange everyone in the order your group agrees on.
      </Text>

      <View style={styles.rotationGuide}>
        <View style={styles.rotationGuideIcon}>
          <Ionicons name="hand-left-outline" size={19} color={COLORS.primary} />
        </View>
        <Text style={styles.rotationGuideText}>
          Long press a row or grab handle to drag. Use the arrows for precise one-step changes.
        </Text>
      </View>

      {members.length === 0 && (
        <View style={styles.emptyRotation}>
          <Ionicons name="people-outline" size={24} color={COLORS.placeholder} />
          <Text style={styles.emptySubtitle}>
            No invitees added yet. You can continue with only yourself and invite members later.
          </Text>
        </View>
      )}
      <DraggableFlatList
        activationDistance={8}
        dragItemOverflow
        data={entries}
        onDragEnd={({ data }) => applyOrder(data)}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.rotationList}
        scrollEnabled={false}
      />
    </View>
  );
}

function StepCollectiveRules() {
  const rules = [
    { icon: "flag-outline" as const, title: "Reach the shared goal", body: "Contributions remain in the group balance until the target is reached." },
    { icon: "create-outline" as const, title: "Propose a payout", body: "The owner or treasurer chooses an active member, amount and purpose." },
    { icon: "people-outline" as const, title: "Members vote", body: "A strict majority of active members must approve within 48 hours." },
    { icon: "wallet-outline" as const, title: "Release to wallet", body: "Once approved, the recipient's KasaFund wallet is credited automatically." },
  ];
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Agree on how money moves</Text>
      <Text style={styles.stepSubtitle}>No single person can release the shared funds on their own.</Text>
      <View style={styles.ruleList}>
        {rules.map((rule, index) => (
          <View key={rule.title} style={styles.collectiveRuleRow}>
            <View style={styles.collectiveRuleIndex}><Text style={styles.collectiveRuleIndexText}>{index + 1}</Text></View>
            <View style={styles.collectiveRuleIcon}><Ionicons name={rule.icon} size={19} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.collectiveRuleTitle}>{rule.title}</Text>
              <Text style={styles.collectiveRuleBody}>{rule.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.collectiveSafetyNote}>
        <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
        <Text style={styles.collectiveSafetyText}>Every proposal, vote and payout is recorded in the group history.</Text>
      </View>
    </View>
  );
}

// ---------- Step 7: Review ----------

function StepReview({
  agreementAccepted,
  form,
  onToggleAgreement,
}: {
  agreementAccepted: boolean;
  form: FormState;
  onToggleAgreement: () => void;
}) {
  const groupTypeLabel = GROUP_TYPES.find((t) => t.key === form.groupType)?.label ?? "—";
  const frequencyLabel = FREQUENCIES.find((f) => f.key === form.frequency)?.label ?? "—";

  const rows = [
    { label: "Saving model", value: form.savingModel === "collective_goal" ? "Collective goal" : "Rotational susu" },
    { label: "Community type", value: groupTypeLabel },
    { label: "Name", value: form.name || "—" },
    { label: "Contribution", value: form.amount ? `GH₵ ${form.amount}` : "—" },
    { label: "Frequency", value: frequencyLabel },
    { label: "Grace period", value: `${Number(form.gracePeriodDays) || 0} days` },
    { label: "Late penalty", value: `GH₵ ${Number(form.penaltyAmount || 0).toFixed(2)}` },
    { label: "Visibility", value: form.isPublic ? "Public" : "Private" },
    { label: "Planned group size", value: `${form.expectedMemberCount} members` },
    ...(form.savingModel === "collective_goal"
      ? [{ label: "Shared goal", value: `GH₵ ${form.goalAmount}` }, { label: "Decision rule", value: "Strict majority vote" }]
      : [{ label: "Your payout position", value: `#${form.creatorPayoutPosition + 1}` }]),
    { label: "Invitations", value: `${form.members.length} selected now` },
  ];

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review & confirm</Text>
      <Text style={styles.stepSubtitle}>
        Double-check the details before creating your group.
      </Text>

      <KasaCard padded={false} style={styles.reviewCard}>
        {rows.map((row, i) => (
          <View
            key={row.label}
            style={[styles.reviewRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}
          >
            <Text style={styles.reviewLabel}>{row.label}</Text>
            <Text style={styles.reviewValue}>{row.value}</Text>
          </View>
        ))}
      </KasaCard>

      {form.description ? (
        <KasaCard style={styles.reviewDescCard}>
          <Text style={styles.reviewLabel}>Description</Text>
          <Text style={styles.reviewDescText}>{form.description}</Text>
        </KasaCard>
      ) : null}

      <View style={styles.creatorAgreementCard}>
        <View style={styles.creatorAgreementHeader}>
          <View style={styles.creatorAgreementIcon}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.creatorAgreementTitle}>Creator group agreement</Text>
            <Text style={styles.creatorAgreementVersion}>
              Version {GROUP_AGREEMENT_VERSION}
            </Text>
          </View>
        </View>
        <Text style={styles.creatorAgreementBody}>
          {form.savingModel === "collective_goal"
            ? "By creating this group, you accept the same contribution commitment as every member. Shared funds can only be released after the goal and a majority vote."
            : "By creating this group, you accept the same contribution commitment as every member. You must keep contributing through the round even after receiving a payout."}
        </Text>
        {form.savingModel === "rotational" ? <View style={styles.creatorAgreementRule}>
          <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
          <Text style={styles.creatorAgreementRuleText}>
            A post-payout default can make your unpaid same-round commitment
            immediately due to the remaining recipients.
          </Text>
        </View> : null}
        <View style={styles.creatorAgreementRule}>
          <Ionicons name="people-outline" size={16} color={COLORS.primary} />
          <Text style={styles.creatorAgreementRuleText}>
            You agree to the group voting, suspension, deadlock-refund and
            financial-ledger rules.
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreementAccepted }}
          activeOpacity={0.82}
          onPress={onToggleAgreement}
          style={styles.creatorAgreementCheckRow}
        >
          <View
            style={[
              styles.creatorAgreementCheckbox,
              agreementAccepted && styles.creatorAgreementCheckboxChecked,
            ]}
          >
            {agreementAccepted && (
              <Ionicons name="checkmark" size={15} color={COLORS.background} />
            )}
          </View>
          <Text style={styles.creatorAgreementCheckText}>
            I have reviewed these terms and accept my creator commitment.
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------- Main wizard ----------

export default function CreateGroupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creatorAgreementAccepted, setCreatorAgreementAccepted] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<{
    id: string;
    name: string;
    inviteCode: string;
    inviteLink: string;
    failedInvitations: number;
  } | null>(null);
  const [form, setForm] = useState<FormState>({
    savingModel: null,
    groupType: null,
    name: "",
    description: "",
    coverImage: null,
    amount: "",
    goalAmount: "",
    frequency: null,
    gracePeriodDays: "2",
    penaltyAmount: "0",
    expectedMemberCount: "4",
    isPublic: false,
    creatorPayoutPosition: 0,
    members: [],
  });

  useEffect(() => {
    setCreatorAgreementAccepted(false);
  }, [
    form.amount,
    form.goalAmount,
    form.savingModel,
    form.frequency,
    form.gracePeriodDays,
    form.penaltyAmount,
    form.expectedMemberCount,
    form.members.length,
  ]);

  const canContinue = () => {
    switch (step) {
      case 1:
        return !!form.savingModel;
      case 2:
        return !!form.groupType && form.name.trim().length > 0;
      case 3:
        return Number(form.amount) > 0 && Number(form.gracePeriodDays || 0) >= 0 &&
          Number(form.penaltyAmount || 0) >= 0 && !!form.frequency &&
          (form.savingModel !== "collective_goal" || Number(form.goalAmount) >= Number(form.amount)) &&
          Number.isInteger(Number(form.expectedMemberCount)) &&
          Number(form.expectedMemberCount) >= Math.max(2, form.members.length + 1) &&
          Number(form.expectedMemberCount) <= 50;
      case 4:
        return true; // members optional at creation time
      case 5:
        return true;
      case 6:
        return true;
      case 7:
        return creatorAgreementAccepted &&
          Number(form.expectedMemberCount) >= Math.max(2, form.members.length + 1);
      default:
        return true;
    }
  };

  const requirementText = () => {
    if (step === 1) return "Choose how the group will save.";
    if (step === 2) return "Choose a community type and enter a group name.";
    if (step === 3) return form.savingModel === "collective_goal" ? "Enter a valid contribution and shared goal." : "Enter a valid amount and choose a contribution frequency.";
    if (step === 7) return "Review and accept the creator agreement to continue.";
    return undefined;
  };

  const handleNext = async () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      if (!form.savingModel || !form.groupType || !form.frequency || isSubmitting) return;
      try {
        setIsSubmitting(true);
        const uploadedCover = form.coverImage
          ? await apiService.uploadImage(form.coverImage, "group")
          : null;
        const response = await apiService.createGroup({
          name: form.name.trim(),
          description: form.description.trim(),
          coverImageUrl: uploadedCover?.data.url,
          type: form.groupType,
          savingModel: form.savingModel,
          contribution: {
            amount: Math.round(Number(form.amount) * 100),
            frequency: form.frequency,
            gracePeriodDays: Number(form.gracePeriodDays) || 0,
            penaltyAmount: Math.round(Number(form.penaltyAmount || 0) * 100),
          },
          rotation: { isEnabled: form.savingModel === "rotational" },
          collectiveGoal: form.savingModel === "collective_goal"
            ? { targetAmount: Math.round(Number(form.goalAmount) * 100) }
            : undefined,
          expectedMemberCount: Number(form.expectedMemberCount),
          creatorPayoutPosition: form.savingModel === "rotational" ? form.creatorPayoutPosition : 0,
          isPublic: form.isPublic,
          agreementAccepted: creatorAgreementAccepted,
          agreementVersion: GROUP_AGREEMENT_VERSION,
        });

        const invitationResults = await Promise.allSettled(
          form.members.map((member, index) =>
            apiService.inviteGroupMember(response.data._id, {
              userId: member.id,
              payoutPosition: form.savingModel === "rotational"
                ? (index >= form.creatorPayoutPosition ? index + 1 : index)
                : 0,
            })
          )
        );
        const failedInvitations = invitationResults.filter(
          (result) => result.status === "rejected"
        ).length;
        const inviteCode = response.data.inviteCode || "";
        setCreatedGroup({
          id: response.data._id,
          name: response.data.name,
          inviteCode,
          inviteLink: Linking.createURL("/groups/join", {
            queryParams: { code: inviteCode },
          }),
          failedInvitations,
        });
      } catch (error) {
        Alert.alert(
          "Could not create group",
          error instanceof Error ? error.message : "Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
    } else {
      setStep(step - 1);
    }
  };

  const toggleMember = (m: Member) => {
    setForm((prev) => {
      const exists = prev.members.some((mem) => mem.id === m.id);
      const members = exists
        ? prev.members.filter((mem) => mem.id !== m.id)
        : [...prev.members, m];
      return {
        ...prev,
        creatorPayoutPosition: Math.min(prev.creatorPayoutPosition, members.length),
        expectedMemberCount: String(
          Math.max(Number(prev.expectedMemberCount) || 2, members.length + 1)
        ),
        members,
      };
    });
  };

  const shareInvitation = async () => {
    if (!createdGroup) return;
    try {
      await Share.share({
        message: `Join ${createdGroup.name} on KasaFund: ${createdGroup.inviteLink}`,
      });
    } catch (error) {
      Alert.alert(
        "Could not share link",
        error instanceof Error ? error.message : "Please try again."
      );
    }
  };

  if (createdGroup) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={36} color={COLORS.background} />
        </View>
        <Text style={styles.successTitle}>Group setup created</Text>
        <Text style={styles.successSubtitle}>
          Invitations are on their way. Review the accepted members and activate the first cycle when your roster is ready.
        </Text>
        {createdGroup.failedInvitations > 0 && (
          <View style={styles.invitationWarning}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
            <Text style={styles.invitationWarningText}>
              {createdGroup.failedInvitations} selected invitation
              {createdGroup.failedInvitations === 1 ? "" : "s"} could not be sent.
            </Text>
          </View>
        )}
        <View style={styles.inviteCodeCard}>
          <Text style={styles.inviteCodeLabel}>INVITATION CODE</Text>
          <Text selectable style={styles.inviteCode}>{createdGroup.inviteCode}</Text>
          <Text selectable style={styles.inviteLink}>{createdGroup.inviteLink}</Text>
        </View>
        <KasaButton
          label="Share invite link"
          leftIcon={<Ionicons name="share-social-outline" size={19} color={COLORS.background} />}
          onPress={shareInvitation}
        />
        <KasaButton
          label="Open group"
          onPress={() => router.replace(`/groups/${createdGroup.id}`)}
          style={styles.secondaryButton}
          variant="secondary"
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StepHeader step={step} topInset={insets.top} onBack={handleBack} onClose={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <StepSavingModel
            value={form.savingModel}
            onSelect={(v) => setForm((p) => ({ ...p, savingModel: v }))}
          />
        )}
        {step === 2 && (
          <StepDetails
            groupType={form.groupType}
            name={form.name}
            description={form.description}
            coverImage={form.coverImage}
            onChangeName={(v) => setForm((p) => ({ ...p, name: v }))}
            onChangeDescription={(v) => setForm((p) => ({ ...p, description: v }))}
            onChangeCoverImage={(coverImage) => setForm((p) => ({ ...p, coverImage }))}
            onSelectGroupType={(groupType) => setForm((p) => ({ ...p, groupType }))}
          />
        )}
        {step === 3 && (
          <StepContribution
            savingModel={form.savingModel!}
            amount={form.amount}
            goalAmount={form.goalAmount}
            frequency={form.frequency}
            gracePeriodDays={form.gracePeriodDays}
            penaltyAmount={form.penaltyAmount}
            expectedMemberCount={form.expectedMemberCount}
            onChangeAmount={(v) => setForm((p) => ({ ...p, amount: v }))}
            onChangeGoalAmount={(v) => setForm((p) => ({ ...p, goalAmount: v }))}
            onChangeGracePeriod={(v) => setForm((p) => ({ ...p, gracePeriodDays: v }))}
            onChangePenalty={(v) => setForm((p) => ({ ...p, penaltyAmount: v }))}
            onChangeExpectedMemberCount={(v) => setForm((p) => ({ ...p, expectedMemberCount: v }))}
            onSelectFrequency={(v) => setForm((p) => ({ ...p, frequency: v }))}
          />
        )}
        {step === 4 && (
          <StepVisibility
            isPublic={form.isPublic}
            onChange={(value) => setForm((p) => ({ ...p, isPublic: value }))}
          />
        )}
        {step === 5 && <StepInvite members={form.members} onToggleMember={toggleMember} />}
        {step === 6 && form.savingModel === "rotational" && (
          <StepRotation
            members={form.members}
            creatorPosition={form.creatorPayoutPosition}
            onReorder={(members, creatorPayoutPosition) =>
              setForm((p) => ({ ...p, members, creatorPayoutPosition }))
            }
          />
        )}
        {step === 6 && form.savingModel === "collective_goal" && <StepCollectiveRules />}
        {step === 7 && (
          <StepReview
            agreementAccepted={creatorAgreementAccepted}
            form={form}
            onToggleAgreement={() =>
              setCreatorAgreementAccepted((current) => !current)
            }
          />
        )}
      </ScrollView>

      <StepFooter
        bottomInset={insets.bottom}
        onNext={handleNext}
        disabled={!canContinue() || isSubmitting}
        helperText={!canContinue() ? requirementText() : undefined}
        loading={isSubmitting}
        nextLabel={step === TOTAL_STEPS ? "Create group" : "Continue"}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerMainRow: { alignItems: "center", flexDirection: "row", marginBottom: 9 },
  headerTitleWrap: { flex: 1, paddingHorizontal: 10 },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  controlPressed: { backgroundColor: kasaColors.surfaceMuted, transform: [{ scale: 0.97 }] },
  stepMetaCount: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600", marginTop: 2 },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 24,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: COLORS.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 24,
  },

  // Step 1 — saving model
  modelList: { gap: 12 },
  modelCard: {
    alignItems: "flex-start",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  modelIconWrap: {
    alignItems: "center",
    backgroundColor: "#E8F5EE",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  modelIconWrapActive: { backgroundColor: COLORS.primary },
  modelCopy: { flex: 1 },
  modelTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800", marginBottom: 3 },
  modelDescription: { color: COLORS.text, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  modelDetail: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 5 },

  // Step 2 — community type
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  typeCard: {
    width: "47%",
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "flex-start",
    gap: 12,
  },
  typeCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  typeLabelActive: {
    color: COLORS.primary,
  },
  categoryChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  categoryChipTextActive: { color: COLORS.background },
  goalField: { gap: 10, marginTop: 18 },
  goalNote: { alignItems: "flex-start", backgroundColor: "#EDF7F3", borderRadius: 12, flexDirection: "row", gap: 8, padding: 12 },
  goalNoteText: { color: COLORS.textMuted, flex: 1, fontSize: 11, lineHeight: 16 },

  // Step 2 — details
  coverPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 100,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    backgroundColor: COLORS.surface,
  },
  coverPickerText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  groupCoverPicker: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flexDirection: "row",
    padding: 14,
  },
  groupCoverPickerIcon: {
    alignItems: "center",
    backgroundColor: "#E5F1ED",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    marginRight: 12,
    width: 44,
  },
  groupCoverPreview: {
    borderRadius: 15,
    height: 170,
    overflow: "hidden",
    position: "relative",
  },
  groupCoverImage: { height: "100%", width: "100%" },
  groupCoverActions: {
    bottom: 12,
    flexDirection: "row",
    gap: 8,
    position: "absolute",
    right: 12,
  },
  coverSmallButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  coverSmallButtonText: { color: COLORS.text, fontSize: 11, fontWeight: "700" },
  coverDeleteButton: {
    alignItems: "center",
    backgroundColor: "rgba(18,33,28,0.82)",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 36,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: COLORS.borderFocus,
    backgroundColor: COLORS.background,
  },
  textAreaWrapper: {
    height: 90,
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    height: "100%",
  },
  textArea: {
    height: "100%",
    textAlignVertical: "top",
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginRight: 8,
  },

  // Step 3 — frequency
  freqCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  freqCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  freqLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  freqLabelActive: {
    color: COLORS.primary,
  },
  freqSublabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },

  rulesRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  ruleField: {
    flex: 1,
  },
  inputSuffix: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  smallCurrency: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginRight: 7,
  },
  fieldHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 9,
  },

  // Step 4 — visibility
  visibilityCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    marginBottom: 12,
    padding: 15,
  },
  visibilityCardActive: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.primary,
  },
  visibilityIcon: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginRight: 12,
    width: 42,
  },
  visibilityIconActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  visibilityCopy: {
    flex: 1,
    paddingRight: 10,
  },
  publicNotice: {
    alignItems: "center",
    backgroundColor: "#E7F2EE",
    borderRadius: 12,
    flexDirection: "row",
    gap: 9,
    marginTop: 4,
    padding: 13,
  },
  publicNoticeText: {
    color: COLORS.primaryDark,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },

  // Step 5 — invite
  shareLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  discoverIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  contactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contactAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  contactAvatarImage: {
    height: "100%",
    width: "100%",
  },
  contactAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.background,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  directorySearch: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 9,
    height: 48,
    marginBottom: 12,
    paddingHorizontal: 13,
  },
  directorySearchInput: {
    color: COLORS.text,
    flex: 1,
    fontSize: 14,
    height: "100%",
  },
  directoryState: {
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },

  // Step 6 — rotation
  rotationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 60,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  rotationRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  rotationIndex: {
    alignItems: "center",
    backgroundColor: "#E5F1ED",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  rotationIndexActive: {
    backgroundColor: COLORS.primary,
  },
  rotationIndexText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  rotationIndexTextActive: {
    color: COLORS.background,
  },
  rotationCopy: {
    flex: 1,
  },
  rotationName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  rotationPositionLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  rotationMoveButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 26,
  },
  rotationDragHandle: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 9,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 30,
  },
  rotationGuide: {
    alignItems: "center",
    backgroundColor: "#E8F5EE",
    borderRadius: 14,
    flexDirection: "row",
    marginBottom: 12,
    padding: 12,
  },
  rotationGuideIcon: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    marginRight: 10,
    width: 36,
  },
  rotationGuideText: {
    color: COLORS.textMuted,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  rotationList: {
    gap: 10,
    overflow: "visible",
    paddingHorizontal: 4,
    paddingTop: 10,
  },
  ownerAvatar: {
    backgroundColor: COLORS.primaryDark,
  },
  emptyRotation: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  ruleList: { gap: 10 },
  collectiveRuleRow: { alignItems: "center", backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 13 },
  collectiveRuleIndex: { alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 10, height: 24, justifyContent: "center", width: 24 },
  collectiveRuleIndexText: { color: COLORS.background, fontSize: 11, fontWeight: "800" },
  collectiveRuleIcon: { alignItems: "center", backgroundColor: "#E8F5EE", borderRadius: 10, height: 38, justifyContent: "center", width: 38 },
  collectiveRuleTitle: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  collectiveRuleBody: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  collectiveSafetyNote: { alignItems: "center", backgroundColor: "#EDF7F3", borderRadius: 13, flexDirection: "row", gap: 9, marginTop: 14, padding: 13 },
  collectiveSafetyText: { color: COLORS.textMuted, flex: 1, fontSize: 11, lineHeight: 16 },

  // Step 7 — review
  reviewCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  reviewLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  reviewDescCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  reviewDescText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginTop: 6,
  },
  creatorAgreementCard: {
    backgroundColor: "#EDF7F3",
    borderColor: "#CFE5DC",
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 14,
    padding: 16,
  },
  creatorAgreementHeader: {
    alignItems: "center",
    flexDirection: "row",
  },
  creatorAgreementIcon: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 11,
    height: 40,
    justifyContent: "center",
    marginRight: 10,
    width: 40,
  },
  creatorAgreementTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  creatorAgreementVersion: {
    color: COLORS.textMuted,
    fontSize: 9,
    marginTop: 3,
  },
  creatorAgreementBody: {
    color: COLORS.textMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 13,
  },
  creatorAgreementRule: {
    alignItems: "flex-start",
    flexDirection: "row",
    marginTop: 11,
  },
  creatorAgreementRuleText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 9,
    lineHeight: 15,
    marginLeft: 8,
  },
  creatorAgreementCheckRow: {
    alignItems: "flex-start",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 14,
    padding: 12,
  },
  creatorAgreementCheckbox: {
    alignItems: "center",
    borderColor: COLORS.border,
    borderRadius: 6,
    borderWidth: 2,
    height: 23,
    justifyContent: "center",
    marginRight: 9,
    width: 23,
  },
  creatorAgreementCheckboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  creatorAgreementCheckText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 16,
  },

  successContainer: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  successIcon: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 34,
    height: 68,
    justifyContent: "center",
    marginBottom: 18,
    width: 68,
  },
  successTitle: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "700",
  },
  successSubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 340,
    textAlign: "center",
  },
  invitationWarning: {
    alignItems: "center",
    backgroundColor: "#FFF2F0",
    borderRadius: 11,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    padding: 12,
    width: "100%",
  },
  invitationWarningText: {
    color: COLORS.error,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  inviteCodeCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 22,
    padding: 18,
    width: "100%",
  },
  inviteCodeLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  inviteCode: {
    color: COLORS.primary,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 6,
  },
  inviteLink: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 10,
    textAlign: "center",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: COLORS.primary,
    borderRadius: 12,
    borderWidth: 1.5,
    height: 52,
    justifyContent: "center",
    marginTop: 11,
    width: "100%",
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "700",
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  footerHint: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 9, textAlign: "center" },
  primaryButton: {
    height: 54,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    width: "100%",
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: "700",
  },
});
