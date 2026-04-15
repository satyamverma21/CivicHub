import React from "react";
import { Text, TextInput, View } from "react-native";

export default function RefinementPreview({ transcription, refined, summary, onSummaryChange }) {
  if (!transcription && !refined) {
    return null;
  }

  return (
    <View style={{ marginTop: 12, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 12, backgroundColor: "#FFFFFF" }}>
      <Text style={{ fontWeight: "800", marginBottom: 8 }}>AI Refinement Preview</Text>

      <Text style={{ fontWeight: "700" }}>Original Transcription</Text>
      <Text style={{ marginTop: 4, color: "#59636E" }}>{transcription || "-"}</Text>

      <Text style={{ fontWeight: "700", marginTop: 10 }}>Refined Text</Text>
      <Text style={{ marginTop: 4, color: "#1F2328" }}>{refined || "-"}</Text>

      <Text style={{ fontWeight: "700", marginTop: 10 }}>Summary (editable)</Text>
      <TextInput
        value={summary}
        onChangeText={onSummaryChange}
        placeholder="Auto summary will appear here"
        multiline
        maxLength={240}
        style={{
          marginTop: 6,
          borderWidth: 1,
          borderColor: "#D0D7DE",
          borderRadius: 8,
          padding: 10,
          minHeight: 70,
          textAlignVertical: "top",
          backgroundColor: "#FFFFFF"
        }}
      />
      <Text style={{ marginTop: 4, color: "#59636E", fontSize: 12 }}>
        Summary should be 1-2 sentences.
      </Text>
    </View>
  );
}