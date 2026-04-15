import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { inputStyle, inputFocusStyle } from "../styles";

export default function AuthInput({
  value,
  onChangeText,
  placeholder,
  label,
  secureTextEntry = false,
  autoCapitalize = "none",
  multiline = false,
  maxLength,
  editable = true,
  style
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const baseInput = inputStyle(colors);
  const focusExtra = focused ? inputFocusStyle(colors) : {};

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6, marginLeft: 2 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.primary}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          baseInput,
          multiline && { minHeight: 100, textAlignVertical: "top", paddingTop: 14 },
          !editable && { opacity: 0.6 },
          focusExtra,
          style
        ]}
      />
    </View>
  );
}
