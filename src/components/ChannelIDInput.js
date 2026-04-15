import React from "react";
import { Text, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function ChannelIDInput({ value, onChangeText, error }) {
  const { colors } = useTheme();

  return (
    <View style={{ marginBottom: 12 }}>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.toUpperCase())}
        placeholder="Channel ID"
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        autoCapitalize="characters"
        maxLength={6}
        style={{
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          color: colors.text,
          backgroundColor: colors.surface,
          padding: 10,
          borderRadius: 6
        }}
      />
      {error ? <Text style={{ color: colors.danger, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}
