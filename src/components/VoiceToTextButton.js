import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function VoiceToTextButton({ onPress, disabled }) {
  const { colors, shadows } = useTheme();

  return (
    <View style={{
      marginTop: 14,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 16,
      ...(shadows?.sm || {})
    }}>
      <Text style={{ fontWeight: "700", marginBottom: 10, color: colors.text, fontSize: 15 }}>
        🎙 Record Issue (Audio)
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
        Speak your issue and AI will transcribe, refine, and auto-tag authorities.
      </Text>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 14,
          opacity: disabled ? 0.6 : 1
        }}
      >
        <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
          Start Recording
        </Text>
      </Pressable>
    </View>
  );
}