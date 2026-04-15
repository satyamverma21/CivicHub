import React from "react";
import { TextInput, View } from "react-native";

export default function AuthInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  autoCapitalize = "none"
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={{ borderWidth: 1, borderColor: "#999", padding: 10, borderRadius: 6 }}
      />
    </View>
  );
}