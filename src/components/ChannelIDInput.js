import React from "react";
import { Text, TextInput, View } from "react-native";

export default function ChannelIDInput({ value, onChangeText, error }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.toUpperCase())}
        placeholder="Channel ID"
        autoCapitalize="characters"
        maxLength={6}
        style={{ borderWidth: 1, borderColor: error ? "red" : "#999", padding: 10, borderRadius: 6 }}
      />
      {error ? <Text style={{ color: "red", marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}