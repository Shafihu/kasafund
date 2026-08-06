import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
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
};

export interface SettingsPageItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  type?: "toggle" | "navigation" | "info";
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

export interface SettingsPageSection {
  title?: string;
  items: SettingsPageItem[];
}

export function SettingsPage({
  title,
  subtitle,
  sections,
  footer,
}: {
  title: string;
  subtitle: string;
  sections: SettingsPageSection[];
  footer?: string;
}) {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity hitSlop={8} onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={COLORS.text} name="arrow-back" size={21} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {sections.map((section, sectionIndex) => (
          <View key={section.title || sectionIndex} style={styles.section}>
            {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
            <View style={styles.card}>
              {section.items.map((item, itemIndex) => (
                <View key={item.id}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    disabled={item.type !== "navigation"}
                    onPress={item.onPress}
                    style={styles.row}
                  >
                    <View style={styles.iconWrap}>
                      <Ionicons color={COLORS.primary} name={item.icon} size={20} />
                    </View>
                    <View style={styles.copy}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}
                    </View>
                    {item.type === "toggle" ? (
                      <Switch
                        ios_backgroundColor="#DDE4E1"
                        onValueChange={item.onToggle}
                        thumbColor={COLORS.surface}
                        trackColor={{ false: "#DDE4E1", true: COLORS.primary }}
                        value={Boolean(item.value)}
                      />
                    ) : item.type === "navigation" ? (
                      <Ionicons color={COLORS.textMuted} name="chevron-forward" size={19} />
                    ) : null}
                  </TouchableOpacity>
                  {itemIndex < section.items.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
            </View>
          </View>
        ))}
        {footer ? <Text style={styles.footer}>{footer}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  header: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerSpacer: { height: 42, width: 42 },
  headerTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  content: { paddingBottom: 40, paddingHorizontal: 20 },
  subtitle: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 25 },
  section: { marginBottom: 23 },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 9,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 17,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: { alignItems: "center", flexDirection: "row", minHeight: 76, padding: 15 },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "#E6F2EE",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    marginRight: 13,
    width: 42,
  },
  copy: { flex: 1, marginRight: 10 },
  rowTitle: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  rowSubtitle: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  divider: { backgroundColor: "#EDF1EF", height: 1, marginLeft: 70 },
  footer: { color: COLORS.textMuted, fontSize: 11, lineHeight: 17, textAlign: "center" },
});
