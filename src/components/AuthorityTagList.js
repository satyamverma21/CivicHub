import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function AuthorityTagList({
  selectedAuthorities,
  suggestedAuthorityIds,
  allAuthorities,
  onToggle
}) {
  const { colors } = useTheme();

  return (
    <View style={{
      marginTop: 14,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 16
    }}>
      <Text style={{ fontWeight: "800", color: colors.text, fontSize: 15 }}>Authorities</Text>
      {suggestedAuthorityIds.length > 0 ? (
        <View style={{
          marginTop: 8,
          backgroundColor: colors.accentLight,
          borderRadius: 10,
          padding: 10
        }}>
          <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 13 }}>
            ✦ Auto-tagged: {allAuthorities.filter((item) => suggestedAuthorityIds.includes(item.id)).map((item) => item.name).join(", ")}
          </Text>
        </View>
      ) : (
        <Text style={{ marginTop: 6, color: colors.textTertiary, fontSize: 13 }}>No auto-tags yet.</Text>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {allAuthorities.map((authority) => {
          const selected = selectedAuthorities.includes(authority.id);
          const isSuggested = suggestedAuthorityIds.includes(authority.id);
          return (
            <Pressable
              key={authority.id}
              onPress={() => onToggle(authority.id)}
              style={{
                borderWidth: 1.5,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primaryLight : colors.surface,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 4
              }}
            >
              {selected ? (
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>✓</Text>
              ) : null}
              <Text style={{ fontWeight: "600", color: selected ? colors.primary : colors.text, fontSize: 14 }}>
                {authority.name}{isSuggested ? " (AI)" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}