import { PayoutProviderLogo } from "@/components/payments/PayoutProviderLogo";
import { AnimatedLoader, KasaButton, KasaCard, KasaStateView } from "@/components/ui";
import { kasaColors, kasaLayout, kasaRadii, kasaSpacing } from "@/constants/design";
import { apiService, type PayoutMethod, type PayoutProvider } from "@/services/apiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MethodType = PayoutMethod["type"];

function methodLabel(type: MethodType) {
  return type === "bank" ? "Bank account" : "Mobile money";
}

export default function PayoutMethodScreen() {
  const router = useRouter();
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus);
  const [current, setCurrent] = useState<PayoutMethod | null>(null);
  const [type, setType] = useState<MethodType>("mobile_money");
  const [providers, setProviders] = useState<PayoutProvider[]>([]);
  const [provider, setProvider] = useState<PayoutProvider | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pickerVisible, setPickerVisible] = useState(false);

  const loadCurrent = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiService.getPayoutMethod();
      setCurrent(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load your payout method.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProviders = useCallback(async (nextType: MethodType) => {
    setLoadingProviders(true);
    setProvider(null);
    try {
      const response = await apiService.getPayoutProviders(nextType);
      setProviders(response.data);
    } catch (requestError) {
      Alert.alert("Providers unavailable", requestError instanceof Error ? requestError.message : "Please try again.");
      setProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => { void loadCurrent(); }, [loadCurrent]);
  useEffect(() => { void loadProviders(type); }, [loadProviders, type]);

  const filteredProviders = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? providers.filter((item) => item.name.toLowerCase().includes(search)) : providers;
  }, [providers, query]);
  const digits = accountNumber.replace(/\s/g, "");
  const accountValid = type === "mobile_money"
    ? /^(?:\+233|233|0)\d{9}$/.test(digits)
    : /^\d{6,20}$/.test(digits);
  const canSave = Boolean(provider && accountValid && !saving);

  const selectType = (nextType: MethodType) => {
    if (nextType === type) return;
    setType(nextType);
    setAccountNumber("");
    setQuery("");
  };

  const save = async () => {
    if (!canSave || !provider) return;
    setSaving(true);
    try {
      const response = await apiService.savePayoutMethod({
        type,
        providerCode: provider.code,
        accountNumber: digits,
      });
      setCurrent(response.data);
      setAccountNumber("");
      setProvider(null);
      await checkAuthStatus();
      Alert.alert(
        current ? "Payout method replaced" : "Payout method ready",
        `${methodLabel(type)} ending ${response.data.accountLast4} will be used for future withdrawals.`,
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (requestError) {
      Alert.alert("Could not save payout method", requestError instanceof Error ? requestError.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmSave = () => {
    if (!provider) return;
    const action = current ? "Replace payout method" : "Save payout method";
    Alert.alert(
      action,
      `${provider.name} •••• ${digits.slice(-4)} will be used when you withdraw from KasaFund. Confirm the details are correct.`,
      [{ text: "Cancel", style: "cancel" }, { text: current ? "Replace" : "Save", onPress: () => void save() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Ionicons color={kasaColors.text} name="arrow-back" size={21} />
        </Pressable>
        <Text style={styles.headerTitle}>Payout method</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}><AnimatedLoader /></View>
      ) : error ? (
        <View style={styles.center}><KasaStateView actionLabel="Retry" kind="error" message={error} onAction={() => void loadCurrent()} title="Payout method unavailable" /></View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <FlatList
            data={["form"]}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            renderItem={() => (
              <>
                <Text style={styles.intro}>Choose where money should go when you withdraw from your KasaFund wallet.</Text>

                {current ? (
                  <KasaCard style={styles.currentCard}>
                    <View style={styles.currentTop}>
                      <View style={styles.currentIcon}><PayoutProviderLogo providerCode={current.providerCode} size={40} type={current.type} /></View>
                      <View style={styles.flex}>
                        <Text style={styles.currentLabel}>CURRENT PAYOUT METHOD</Text>
                        <Text style={styles.currentTitle}>{current.providerName} •••• {current.accountLast4}</Text>
                        <Text style={styles.currentName}>{current.accountName}</Text>
                      </View>
                      <View style={styles.readyBadge}><Ionicons color={kasaColors.success} name="checkmark-circle" size={15} /><Text style={styles.readyText}>Ready</Text></View>
                    </View>
                  </KasaCard>
                ) : (
                  <KasaCard style={styles.emptyCard} variant="soft">
                    <Ionicons color={kasaColors.brand} name="arrow-down-circle-outline" size={23} />
                    <View style={styles.flex}><Text style={styles.emptyTitle}>No payout method yet</Text><Text style={styles.emptyText}>Add one before your first wallet withdrawal.</Text></View>
                  </KasaCard>
                )}

                <Text style={styles.sectionTitle}>{current ? "Replace payout method" : "Set up payout method"}</Text>
                <View accessibilityRole="radiogroup" style={styles.methodSwitch}>
                  {(["mobile_money", "bank"] as MethodType[]).map((item) => {
                    const selected = type === item;
                    return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={item} onPress={() => selectType(item)} style={({ pressed }) => [styles.methodOption, selected && styles.methodOptionSelected, pressed && styles.pressed]}><Ionicons color={selected ? kasaColors.brand : kasaColors.textMuted} name={item === "bank" ? "business-outline" : "phone-portrait-outline"} size={19} /><Text style={[styles.methodText, selected && styles.methodTextSelected]}>{methodLabel(item)}</Text></Pressable>;
                  })}
                </View>

                <Text style={styles.label}>{type === "bank" ? "Bank" : "Mobile money network"}</Text>
                <Pressable accessibilityRole="button" disabled={loadingProviders} onPress={() => setPickerVisible(true)} style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
                  <View style={styles.fieldProviderMark}><PayoutProviderLogo providerCode={provider?.code} size={34} type={type} /></View>
                  <Text style={[styles.fieldValue, !provider && styles.placeholder]}>{loadingProviders ? "Loading providers…" : provider?.name || `Choose ${type === "bank" ? "a bank" : "a network"}`}</Text>
                  <Ionicons color={kasaColors.textMuted} name="chevron-down" size={18} />
                </Pressable>

                <Text style={styles.label}>{type === "bank" ? "Account number" : "Registered mobile money number"}</Text>
                <View style={[styles.field, accountNumber.length > 0 && !accountValid && styles.fieldError]}>
                  <Ionicons color={kasaColors.textMuted} name={type === "bank" ? "keypad-outline" : "call-outline"} size={19} />
                  <TextInput accessibilityLabel={type === "bank" ? "Bank account number" : "Mobile money number"} keyboardType="number-pad" maxLength={type === "bank" ? 20 : 13} onChangeText={setAccountNumber} placeholder={type === "bank" ? "Enter account number" : "024 123 4567"} placeholderTextColor={kasaColors.textSubtle} style={styles.input} value={accountNumber} />
                </View>
                {accountNumber.length > 0 && !accountValid ? <Text style={styles.errorText}>{type === "bank" ? "Enter a valid bank account number." : "Enter a valid Ghana mobile money number."}</Text> : null}

                <KasaCard style={styles.safetyCard} variant="soft"><Ionicons color={kasaColors.brand} name="shield-checkmark-outline" size={20} /><Text style={styles.safetyText}>KasaFund stores a secure Paystack recipient reference. Only the last four digits are shown again.</Text></KasaCard>
                <KasaButton disabled={!canSave} label={current ? "Review replacement" : "Review and save"} loading={saving} onPress={confirmSave} />
              </>
            )}
          />
        </KeyboardAvoidingView>
      )}

      <Modal animationType="slide" onRequestClose={() => setPickerVisible(false)} presentationStyle="pageSheet" visible={pickerVisible}>
        <SafeAreaView style={styles.pickerSafe}>
          <View style={styles.pickerHeader}><View><Text style={styles.pickerTitle}>Choose {type === "bank" ? "a bank" : "a network"}</Text><Text style={styles.pickerSubtitle}>{providers.length} available</Text></View><Pressable accessibilityLabel="Close provider list" accessibilityRole="button" onPress={() => setPickerVisible(false)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><Ionicons color={kasaColors.text} name="close" size={21} /></Pressable></View>
          {type === "bank" ? <View style={styles.searchBox}><Ionicons color={kasaColors.textMuted} name="search" size={18} /><TextInput autoCapitalize="none" onChangeText={setQuery} placeholder="Search banks" placeholderTextColor={kasaColors.textSubtle} style={styles.searchInput} value={query} /></View> : null}
          <FlatList data={filteredProviders} keyExtractor={(item) => item.code} contentContainerStyle={styles.providerList} renderItem={({ item }) => <Pressable accessibilityLabel={item.name} accessibilityRole="button" onPress={() => { setProvider(item); setPickerVisible(false); setQuery(""); }} style={({ pressed }) => [styles.providerRow, pressed && styles.providerPressed]}><View style={styles.providerIcon}><PayoutProviderLogo providerCode={item.code} type={type} /></View><Text style={styles.providerName}>{item.name}</Text>{provider?.code === item.code ? <Ionicons color={kasaColors.brand} name="checkmark-circle" size={21} /> : null}</Pressable>} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: kasaColors.background, flex: 1 }, flex: { flex: 1 }, center: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  header: { alignItems: "center", borderBottomColor: kasaColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", height: 60, justifyContent: "space-between", paddingHorizontal: 16 },
  headerButton: { alignItems: "center", borderRadius: 13, height: 44, justifyContent: "center", width: 44 }, headerTitle: { color: kasaColors.text, fontSize: 17, fontWeight: "800" }, pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
  headerSpacer: { height: 44, width: 44 },
  content: { paddingBottom: 44, paddingHorizontal: kasaLayout.screenInset, paddingTop: 20 }, intro: { color: kasaColors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 18 },
  currentCard: { padding: 15 }, currentTop: { alignItems: "center", flexDirection: "row" }, currentIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 13, height: 46, justifyContent: "center", marginRight: 12, width: 46 }, currentLabel: { color: kasaColors.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 0.7 }, currentTitle: { color: kasaColors.text, fontSize: 14, fontWeight: "800", marginTop: 4 }, currentName: { color: kasaColors.textMuted, fontSize: 11, marginTop: 3 }, readyBadge: { alignItems: "center", backgroundColor: "#E8F5EE", borderRadius: 10, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 6 }, readyText: { color: kasaColors.success, fontSize: 9, fontWeight: "800" },
  emptyCard: { alignItems: "center", flexDirection: "row", gap: 12 }, emptyTitle: { color: kasaColors.text, fontSize: 13, fontWeight: "800" }, emptyText: { color: kasaColors.textMuted, fontSize: 10, marginTop: 3 },
  sectionTitle: { color: kasaColors.text, fontSize: 18, fontWeight: "800", marginBottom: 12, marginTop: 26 }, methodSwitch: { backgroundColor: kasaColors.surfaceMuted, borderRadius: kasaRadii.lg, flexDirection: "row", gap: 6, padding: 5 }, methodOption: { alignItems: "center", borderRadius: kasaRadii.md, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 48 }, methodOptionSelected: { backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderWidth: 1 }, methodText: { color: kasaColors.textMuted, fontSize: 11, fontWeight: "700" }, methodTextSelected: { color: kasaColors.brand, fontWeight: "800" },
  label: { color: kasaColors.text, fontSize: 12, fontWeight: "800", marginBottom: 8, marginTop: 20 }, field: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 56, paddingHorizontal: 14 }, fieldError: { borderColor: kasaColors.danger }, fieldValue: { color: kasaColors.text, flex: 1, fontSize: 13, fontWeight: "700" }, placeholder: { color: kasaColors.textSubtle, fontWeight: "500" }, input: { color: kasaColors.text, flex: 1, fontSize: 15, paddingVertical: 14 }, errorText: { color: kasaColors.danger, fontSize: 11, marginTop: 6 },
  fieldProviderMark: { alignItems: "center", justifyContent: "center", minHeight: 34, width: 34 },
  safetyCard: { alignItems: "flex-start", flexDirection: "row", gap: 10, marginBottom: 20, marginTop: 22 }, safetyText: { color: kasaColors.textMuted, flex: 1, fontSize: 11, lineHeight: 17 },
  pickerSafe: { backgroundColor: kasaColors.background, flex: 1 }, pickerHeader: { alignItems: "center", borderBottomColor: kasaColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", padding: 20 }, pickerTitle: { color: kasaColors.text, fontSize: 20, fontWeight: "800" }, pickerSubtitle: { color: kasaColors.textMuted, fontSize: 11, marginTop: 3 }, closeButton: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 13, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  searchBox: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 9, margin: 16, paddingHorizontal: 13 }, searchInput: { color: kasaColors.text, flex: 1, fontSize: 14, minHeight: 48 }, providerList: { paddingBottom: kasaSpacing.xxl, paddingHorizontal: 16 }, providerRow: { alignItems: "center", borderBottomColor: kasaColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 64 }, providerPressed: { opacity: 0.6 }, providerIcon: { alignItems: "center", backgroundColor: kasaColors.brandSoft, borderRadius: 11, height: 40, justifyContent: "center", marginRight: 12, width: 40 }, providerName: { color: kasaColors.text, flex: 1, fontSize: 13, fontWeight: "700" },
});
