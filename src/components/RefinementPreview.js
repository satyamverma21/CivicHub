import React from "react";
import { Text, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function RefinementPreview({ transcription, refined, summary, onSummaryChange }) {
  const { colors } = useTheme();

  if (!transcription && !refined) {
    return null;
  }

  return (
    <View style={{
      marginTop: 14,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 16,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary
    }}>
      <Text style={{ fontWeight: "800", fontSize: 15, color: colors.text, marginBottom: 12 }}>
        ✦ AI Refinement Preview
      </Text>

      <Text style={{ fontWeight: "700", fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
        Original Transcription
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{transcription || "-"}</Text>

      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />

      <Text style={{ fontWeight: "700", fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
        Refined Text
      </Text>
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{refined || "-"}</Text>

      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />

      <Text style={{ fontWeight: "700", fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>
        Summary (editable)
      </Text>
      <TextInput
        value={summary}
        onChangeText={onSummaryChange}
        placeholder="Auto summary will appear here"
        placeholderTextColor={colors.textTertiary}
        multiline
        maxLength={240}
        style={{
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 12,
          minHeight: 70,
          textAlignVertical: "top",
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: 14
        }}
      />
      <Text style={{ marginTop: 6, color: colors.textTertiary, fontSize: 12 }}>
        Summary should be 1-2 sentences.
      </Text>
    </View>
  );
}