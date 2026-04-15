import React from "react";
import { Pressable, Text, View } from "react-native";

export default function AuthorityTagList({
  selectedAuthorities,
  suggestedAuthorityIds,
  allAuthorities,
  onToggle
}) {
  return (
    <View style={{ marginTop: 12, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 12, backgroundColor: "#FFFFFF" }}>
      <Text style={{ fontWeight: "800" }}>Authorities</Text>
      {suggestedAuthorityIds.length > 0 ? (
        <Text style={{ marginTop: 6, color: "#1A7F37", fontWeight: "600" }}>
          Auto-tagged: {allAuthorities.filter((item) => suggestedAuthorityIds.includes(item.id)).map((item) => item.name).join(", ")}
        </Text>
      ) : (
        <Text style={{ marginTop: 6, color: "#59636E" }}>No auto-tags yet.</Text>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {allAuthorities.map((authority) => {
          const selected = selectedAuthorities.includes(authority.id);
          const isSuggested = suggestedAuthorityIds.includes(authority.id);
          return (
            <Pressable
              key={authority.id}
              onPress={() => onToggle(authority.id)}
              style={{
                borderWidth: 1,
                borderColor: selected ? "#0969DA" : "#D0D7DE",
                backgroundColor: selected ? "#E7F3FF" : "#FFFFFF",
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6
              }}
            >
              <Text style={{ fontWeight: "600", color: selected ? "#0058B3" : "#1F2328" }}>
                {authority.name}{isSuggested ? " (AI)" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}