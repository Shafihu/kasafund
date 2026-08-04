import { kasaColors, kasaSpacing, kasaType } from "@/constants/design";
import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { KasaCard } from "./KasaCard";

export type PaymentSummaryItem = { label: string; value: string };

interface KasaPaymentSummaryProps {
  items: PaymentSummaryItem[];
  total: string;
  title?: string;
  totalLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function KasaPaymentSummary({
  items,
  total,
  title = "Payment summary",
  totalLabel = "Total",
  style,
}: KasaPaymentSummaryProps) {
  return (
    <KasaCard style={style}>
      <Text style={styles.title}>{title}</Text>
      {items.map((item) => (
        <View key={item.label} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>{totalLabel}</Text>
        <Text accessibilityLabel={`${totalLabel} ${total}`} style={styles.totalValue}>{total}</Text>
      </View>
    </KasaCard>
  );
}

const styles = StyleSheet.create({
  title: { color: kasaColors.text, marginBottom: kasaSpacing.lg, ...kasaType.cardTitle },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 11 },
  label: { color: kasaColors.textMuted, ...kasaType.caption },
  value: { color: kasaColors.text, fontSize: 12, fontWeight: "700" },
  divider: { backgroundColor: kasaColors.border, height: StyleSheet.hairlineWidth, marginBottom: 12 },
  totalRow: { marginBottom: 0 },
  totalLabel: { color: kasaColors.text, fontSize: 14, fontWeight: "800" },
  totalValue: { color: kasaColors.brand, fontSize: 16, fontWeight: "800" },
});
