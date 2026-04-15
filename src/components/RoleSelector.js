import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function RoleSelector({ selectedRole, onSelectRole, options }) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      {options.map((role) => {
        const selected = selectedRole === role;
        return (
          <Pressable
            key={role}
            onPress={() => onSelectRole(role)}
            style={{
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? `${colors.primary}22` : colors.surface,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6
            }}
          >
            <Text style={{ color: selected ? colors.primary : colors.text, fontWeight: "600" }}>{role}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
