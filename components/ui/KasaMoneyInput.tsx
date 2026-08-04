import { kasaColors, kasaRadii, kasaType } from "@/constants/design";
import React, { ReactNode, useState } from "react";
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";

interface KasaMoneyInputProps extends Omit<TextInputProps, "style"> {
  label: string;
  currency?: string;
  error?: string;
  helperText?: string;
  footer?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export function KasaMoneyInput({
  label,
  currency = "GH₵",
  error,
  helperText,
  footer,
  containerStyle,
  onFocus,
  onBlur,
  ...props
}: KasaMoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const supportingText = error || helperText;
  const spokenCurrency = currency === "GH₵" ? "Ghana cedis" : currency;

  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, focused && styles.focused, error && styles.errored]}>
        <Text style={styles.currency}>{currency}</Text>
        <TextInput
          accessibilityLabel={`${label} in ${spokenCurrency}`}
          inputMode="decimal"
          keyboardType="decimal-pad"
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholder="0.00"
          placeholderTextColor="#9AA8A3"
          selectionColor={kasaColors.brand}
          style={styles.input}
          {...props}
        />
      </View>
      {supportingText ? (
        <Text accessibilityLiveRegion="polite" style={[styles.supporting, error && styles.errorText]}>{supportingText}</Text>
      ) : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: kasaColors.text, marginBottom: 8, ...kasaType.label },
  inputShell: { alignItems: "center", backgroundColor: kasaColors.surface, borderColor: kasaColors.border, borderRadius: kasaRadii.md, borderWidth: 1, flexDirection: "row", minHeight: 58, paddingHorizontal: 14 },
  focused: { borderColor: kasaColors.brand, borderWidth: 1.5 },
  errored: { borderColor: kasaColors.danger },
  currency: { color: kasaColors.brand, fontSize: 12, fontWeight: "800", marginRight: 10 },
  input: { color: kasaColors.text, flex: 1, fontSize: 23, fontWeight: "800", paddingVertical: 0 },
  supporting: { color: kasaColors.textMuted, marginTop: 6, ...kasaType.caption },
  errorText: { color: kasaColors.danger },
});
