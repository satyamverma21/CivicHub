import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { inputStyle, inputFocusStyle } from "../styles";

export default function ChannelIDInput({ value, onChangeText, error }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const base = inputStyle(colors);
  const focusExtra = focused ? inputFocusStyle(colors) : {};

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6, marginLeft: 2 }}>
        Channel ID
      </Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.toUpperCase())}
        placeholder="e.g. ABC123"
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.primary}
        autoCapitalize="characters"
        maxLength={6}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          base,
          {
            fontFamily: "monospace",
            letterSpacing: 3,
            fontSize: 18,
            textAlign: "center",
            fontWeight: "700"
          },
          error ? { borderColor: colors.danger } : {},
          focusExtra
        ]}
      />
      {error ? (
        <Text style={{ color: colors.danger, marginTop: 6, fontSize: 13, marginLeft: 2 }}>{error}</Text>
      ) : null}
    </View>
  );
}
