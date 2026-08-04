import {
  KasaButton,
  KasaCard,
  KasaChoiceCard,
  KasaMoneyInput,
  KasaPaymentSummary,
  KasaSectionHeader,
  KasaStateView,
  KasaStatusBadge,
} from "@/components/ui";
import { kasaColors } from "@/constants/design";
import { apiService, type SavingsPot } from "@/services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function money(value: number) {
  return `GH₵ ${(value / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseMoney(value: string) {
  if (!/^\d+(\.\d{0,2})?$/.test(value.trim())) return null;
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount >= 100 ? amount : null;
}

function targetDate(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function formattedTarget(months: number) {
  return new Date(targetDate(months)).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PotCard({ pot, onPress }: { pot: SavingsPot; onPress: () => void }) {
  const progress = pot.targetAmount > 0 ? Math.min(pot.currentAmount / pot.targetAmount, 1) : 0;
  return (
    <Pressable
      accessibilityLabel={`${pot.name}, ${money(pot.currentAmount)} saved of ${money(pot.targetAmount)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.potCard, pressed && styles.pressed]}
    >
      <View style={styles.potTopRow}>
        <View style={styles.potIcon}>
          <Ionicons
            color={kasaColors.brand}
            name={pot.mode === "locked" ? "lock-closed" : "leaf"}
            size={20}
          />
        </View>
        <View style={styles.potCopy}>
          <Text numberOfLines={1} style={styles.potName}>{pot.name}</Text>
          <Text style={styles.potMeta}>{pot.mode} · {pot.frequency}</Text>
        </View>
        {pot.autoSaveEnabled ? (
          <KasaStatusBadge compact icon="sync" label="Automatic" tone="success" />
        ) : (
          <Ionicons color={kasaColors.textMuted} name="chevron-forward" size={18} />
        )}
      </View>
      <View style={styles.potAmountRow}>
        <Text style={styles.potAmount}>{money(pot.currentAmount)}</Text>
        <Text style={styles.potGoal}>of {money(pot.targetAmount)}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.potFooter}>
        <Text style={styles.progressText}>{Math.round(progress * 100)}% complete</Text>
        <Text style={styles.targetText}>
          Target {new Date(pot.targetDate).toLocaleDateString("en-GH", { month: "short", year: "numeric" })}
        </Text>
      </View>
    </Pressable>
  );
}

type CreatePotModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (pot: SavingsPot) => void;
};

function CreatePotModal({ visible, onClose, onCreated }: CreatePotModalProps) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<SavingsPot["frequency"]>("monthly");
  const [mode, setMode] = useState<SavingsPot["mode"]>("flexible");
  const [months, setMonths] = useState(6);
  const [auto, setAuto] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const targetAmount = parseMoney(goal);
  const contributionAmount = parseMoney(amount);
  const valid = Boolean(name.trim() && targetAmount && contributionAmount);

  const reset = () => {
    setName("");
    setGoal("");
    setAmount("");
    setFrequency("monthly");
    setMode("flexible");
    setMonths(6);
    setAuto(false);
    setAttempted(false);
  };

  const close = () => {
    if (!saving) onClose();
  };

  const create = async () => {
    setAttempted(true);
    if (!valid || !targetAmount || !contributionAmount) return;
    setSaving(true);
    try {
      const response = await apiService.createSavingsPot({
        name: name.trim(),
        targetAmount,
        contributionAmount,
        frequency,
        targetDate: targetDate(months),
        mode,
        autoSaveEnabled: auto,
      });
      onCreated(response.data);
      reset();
      onClose();
    } catch (error) {
      Alert.alert(
        "Could not create My Susu",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={close} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalSafe}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalCopy}>
              <Text style={styles.modalTitle}>Create a savings pot</Text>
              <Text style={styles.modalSubtitle}>Set a personal target and a realistic saving rhythm.</Text>
            </View>
            <Pressable
              accessibilityLabel="Close create savings pot"
              accessibilityRole="button"
              disabled={saving}
              onPress={close}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Ionicons color={kasaColors.text} name="close" size={21} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.fieldLabel}>What are you saving for?</Text>
            <TextInput
              accessibilityLabel="Savings pot name"
              maxLength={80}
              onChangeText={setName}
              placeholder="Emergency fund"
              placeholderTextColor="#9AA8A3"
              selectionColor={kasaColors.brand}
              style={[styles.input, attempted && !name.trim() && styles.inputError]}
              value={name}
            />
            {attempted && !name.trim() ? <Text style={styles.errorText}>Enter a name for this pot.</Text> : null}

            <View style={styles.amountFields}>
              <KasaMoneyInput
                containerStyle={styles.amountField}
                error={attempted && !targetAmount ? "At least GH₵ 1.00" : undefined}
                label="Goal amount"
                onChangeText={setGoal}
                value={goal}
              />
              <KasaMoneyInput
                containerStyle={styles.amountField}
                error={attempted && !contributionAmount ? "At least GH₵ 1.00" : undefined}
                label="Save each time"
                onChangeText={setAmount}
                value={amount}
              />
            </View>

            <KasaSectionHeader
              description="How often should this pot expect a saving?"
              title="Schedule"
            />
            <View accessibilityRole="radiogroup" style={styles.chips}>
              {(["daily", "weekly", "monthly"] as const).map((item) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: frequency === item }}
                  key={item}
                  onPress={() => setFrequency(item)}
                  style={({ pressed }) => [styles.chip, frequency === item && styles.chipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, frequency === item && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Target period</Text>
            <View accessibilityRole="radiogroup" style={styles.chips}>
              {[3, 6, 12].map((item) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: months === item }}
                  key={item}
                  onPress={() => setMonths(item)}
                  style={({ pressed }) => [styles.chip, months === item && styles.chipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, months === item && styles.chipTextActive]}>{item} months</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.accessHeader}>
              <KasaSectionHeader
                description="Locked pots protect the goal but cannot be withdrawn early."
                title="Access to savings"
              />
            </View>
            <View accessibilityRole="radiogroup" style={styles.modeCards}>
              {(["flexible", "locked"] as const).map((item) => (
                <KasaChoiceCard
                  accessibilityLabel={item === "locked" ? "Locked, withdraw after target date" : "Flexible, withdraw whenever needed"}
                  key={item}
                  onPress={() => setMode(item)}
                  selected={mode === item}
                  style={styles.modeCard}
                >
                  <Ionicons color={kasaColors.brand} name={item === "locked" ? "lock-closed-outline" : "key-outline"} size={21} />
                  <Text style={styles.modeTitle}>{item === "locked" ? "Locked" : "Flexible"}</Text>
                  <Text style={styles.modeText}>{item === "locked" ? "Withdraw after target date" : "Withdraw whenever needed"}</Text>
                </KasaChoiceCard>
              ))}
            </View>

            <KasaCard style={styles.autoRow}>
              <View style={styles.autoIcon}><Ionicons color={kasaColors.brand} name="sync" size={20} /></View>
              <View style={styles.autoCopy}>
                <Text style={styles.autoTitle}>Save automatically</Text>
                <Text style={styles.autoSubtitle}>Move the scheduled amount from your wallet.</Text>
              </View>
              <Switch
                accessibilityLabel="Save automatically"
                ios_backgroundColor={kasaColors.border}
                onValueChange={setAuto}
                trackColor={{ false: kasaColors.border, true: kasaColors.brand }}
                value={auto}
              />
            </KasaCard>

            {mode === "locked" ? (
              <KasaCard style={styles.lockNote} variant="soft">
                <Ionicons color={kasaColors.warning} name="information-circle" size={19} />
                <Text style={styles.lockNoteText}>This money cannot be withdrawn before {formattedTarget(months)}.</Text>
              </KasaCard>
            ) : null}

            <KasaPaymentSummary
              items={[
                { label: "Saving amount", value: money(contributionAmount ?? 0) },
                { label: "Frequency", value: frequency[0].toUpperCase() + frequency.slice(1) },
                { label: "Access", value: mode === "locked" ? `Locked until ${formattedTarget(months)}` : "Flexible" },
                { label: "Automatic saving", value: auto ? "Enabled" : "Off" },
              ]}
              style={styles.planSummary}
              total={money(targetAmount ?? 0)}
              totalLabel="Savings goal"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <KasaButton
              disabled={!valid}
              label="Create savings pot"
              leftIcon={<Ionicons color={kasaColors.white} name="add" size={18} />}
              loading={saving}
              onPress={() => void create()}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default function MySusuScreen() {
  const router = useRouter();
  const [pots, setPots] = useState<SavingsPot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [createVisible, setCreateVisible] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setLoadError("");
    try {
      const response = await apiService.getSavingsPots();
      setPots(response.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const total = pots.reduce((sum, pot) => sum + pot.currentAmount, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Ionicons color={kasaColors.text} name="arrow-back" size={22} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>My Susu</Text>
          <Text style={styles.headerSubtitle}>Personal savings</Text>
        </View>
        <Pressable accessibilityLabel="Create savings pot" accessibilityRole="button" onPress={() => setCreateVisible(true)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <Ionicons color={kasaColors.white} name="add" size={23} />
        </Pressable>
      </View>

      {loading ? (
        <KasaStateView kind="loading" style={styles.fullState} title="Loading savings pots" />
      ) : loadError && !pots.length ? (
        <KasaStateView actionLabel="Try again" kind="error" message={loadError} onAction={() => void load()} style={styles.fullState} title="Couldn’t load My Susu" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl onRefresh={() => void load(true)} refreshing={refreshing} tintColor={kasaColors.brand} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryHero}>
            <Text style={styles.summaryLabel}>Total personal savings</Text>
            <Text style={styles.summaryAmount}>{money(total)}</Text>
            <View style={styles.summaryMetaRow}>
              <Ionicons color={kasaColors.accent} name="leaf" size={15} />
              <Text style={styles.summaryMeta}>{pots.length} {pots.length === 1 ? "savings pot" : "savings pots"}</Text>
            </View>
            <View style={styles.ringLarge} />
            <View style={styles.ringSmall} />
          </View>

          <KasaSectionHeader
            actionLabel={pots.length ? "New pot" : undefined}
            description="Track each goal separately without mixing it with group contributions."
            onAction={pots.length ? () => setCreateVisible(true) : undefined}
            title="Your savings pots"
          />
          <View style={styles.potList}>
            {pots.map((pot) => (
              <PotCard
                key={pot._id}
                onPress={() => router.push({ pathname: "/wallet/susu/[id]", params: { id: pot._id } })}
                pot={pot}
              />
            ))}
          </View>
          {!pots.length ? (
            <KasaStateView
              actionLabel="Create My Susu"
              icon="leaf-outline"
              kind="empty"
              message="Create a flexible or locked savings pot and build toward a personal goal."
              onAction={() => setCreateVisible(true)}
              style={styles.emptyState}
              title="Start your first personal susu"
            />
          ) : null}
        </ScrollView>
      )}

      <CreatePotModal
        onClose={() => setCreateVisible(false)}
        onCreated={(pot) => setPots((current) => [pot, ...current])}
        visible={createVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: kasaColors.background, flex: 1 },
  header: { alignItems: "center", borderBottomColor: kasaColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 12, minHeight: 66, paddingHorizontal: 16 },
  headerButton: { alignItems: "center", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  headerCopy: { flex: 1 },
  headerTitle: { color: kasaColors.text, fontSize: 19, fontWeight: "800" },
  headerSubtitle: { color: kasaColors.textMuted, fontSize: 10, marginTop: 2 },
  addButton: { alignItems: "center", backgroundColor: kasaColors.brand, borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  pressed: { opacity: 0.62, transform: [{ scale: 0.97 }] },
  fullState: { flex: 1 },
  content: { paddingBottom: 42, paddingHorizontal: 20, paddingTop: 16 },
  summaryHero: { backgroundColor: kasaColors.brand, borderRadius: 20, marginBottom: 28, overflow: "hidden", padding: 21 },
  summaryLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, zIndex: 2 },
  summaryAmount: { color: kasaColors.white, fontSize: 29, fontWeight: "800", marginTop: 7, zIndex: 2 },
  summaryMetaRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 14, zIndex: 2 },
  summaryMeta: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  ringLarge: { borderColor: "rgba(255,255,255,0.08)", borderRadius: 90, borderWidth: 25, height: 160, position: "absolute", right: -45, top: -62, width: 160 },
  ringSmall: { backgroundColor: "rgba(232,184,75,0.13)", borderRadius: 40, bottom: -33, height: 80, position: "absolute", right: 64, width: 80 },
  potList: { gap: 11, marginTop: 13 },
  potCard: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 16, borderWidth: 1, padding: 16 },
  potTopRow: { alignItems: "center", flexDirection: "row" },
  potIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 12, height: 42, justifyContent: "center", marginRight: 11, width: 42 },
  potCopy: { flex: 1, paddingRight: 8 },
  potName: { color: kasaColors.text, fontSize: 14, fontWeight: "800" },
  potMeta: { color: kasaColors.textMuted, fontSize: 11, marginTop: 3, textTransform: "capitalize" },
  potAmountRow: { alignItems: "baseline", flexDirection: "row", gap: 6, marginTop: 17 },
  potAmount: { color: kasaColors.text, fontSize: 20, fontWeight: "800" },
  potGoal: { color: kasaColors.textMuted, fontSize: 11 },
  progressTrack: { backgroundColor: kasaColors.border, borderRadius: 5, height: 7, marginTop: 12, overflow: "hidden" },
  progressFill: { backgroundColor: kasaColors.accent, borderRadius: 5, height: "100%" },
  potFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  progressText: { color: kasaColors.brand, fontSize: 10, fontWeight: "700" },
  targetText: { color: kasaColors.textMuted, fontSize: 10 },
  emptyState: { marginTop: 13 },
  modalSafe: { backgroundColor: kasaColors.background, flex: 1 },
  modalHeader: { alignItems: "center", borderBottomColor: kasaColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", paddingHorizontal: 20, paddingVertical: 12 },
  modalCopy: { flex: 1, paddingRight: 12 },
  modalTitle: { color: kasaColors.text, fontSize: 21, fontWeight: "800" },
  modalSubtitle: { color: kasaColors.textMuted, fontSize: 11, marginTop: 3 },
  closeButton: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 12, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  form: { padding: 20, paddingBottom: 30 },
  fieldLabel: { color: kasaColors.text, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  input: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 14, borderWidth: 1, color: kasaColors.text, fontSize: 14, minHeight: 54, paddingHorizontal: 14 },
  inputError: { borderColor: kasaColors.danger },
  errorText: { color: kasaColors.danger, fontSize: 11, marginTop: 6 },
  amountFields: { flexDirection: "row", gap: 10, marginBottom: 28, marginTop: 20 },
  amountField: { flex: 1 },
  chips: { flexDirection: "row", gap: 8, marginTop: 12 },
  chip: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 11, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 44 },
  chipActive: { backgroundColor: kasaColors.brandSoft, borderColor: kasaColors.brand },
  chipText: { color: kasaColors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  chipTextActive: { color: kasaColors.brand },
  accessHeader: { marginTop: 28 },
  modeCards: { flexDirection: "row", gap: 10, marginTop: 12 },
  modeCard: { flex: 1, minHeight: 120 },
  modeTitle: { color: kasaColors.text, fontSize: 13, fontWeight: "800", marginTop: 8 },
  modeText: { color: kasaColors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  autoRow: { alignItems: "center", flexDirection: "row", marginTop: 18 },
  autoIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 11, height: 40, justifyContent: "center", marginRight: 10, width: 40 },
  autoCopy: { flex: 1, paddingRight: 8 },
  autoTitle: { color: kasaColors.text, fontSize: 13, fontWeight: "800" },
  autoSubtitle: { color: kasaColors.textMuted, fontSize: 10, marginTop: 3 },
  lockNote: { alignItems: "flex-start", flexDirection: "row", gap: 9, marginTop: 14 },
  lockNoteText: { color: kasaColors.warning, flex: 1, fontSize: 10, lineHeight: 15 },
  planSummary: { marginTop: 18 },
  modalFooter: { backgroundColor: kasaColors.background, borderTopColor: kasaColors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 8, paddingHorizontal: 20, paddingTop: 12 },
});
