import React from "react";
import { TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function AuthInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  autoCapitalize = "none"
}) {
  const { colors } = useTheme();

  return (
    <View style={{ marginBottom: 12 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          backgroundColor: colors.surface,
          padding: 10,
          borderRadius: 6
        }}
      />
    </View>
  );
}
