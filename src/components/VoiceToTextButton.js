import React from "react";
import { Pressable, Text, View } from "react-native";

export default function VoiceToTextButton({ onPress, disabled }) {
  return (
    <View style={{ marginTop: 14, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 12, backgroundColor: "#FFFFFF" }}>
      <Text style={{ fontWeight: "700", marginBottom: 8 }}>Record Issue (Audio)</Text>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={{
          backgroundColor: "#0969DA",
          borderRadius: 8,
          padding: 12,
          opacity: disabled ? 0.6 : 1
        }}
      >
        <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700" }}>Record Issue</Text>
      </Pressable>
    </View>
  );
}