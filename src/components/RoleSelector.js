import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function RoleSelector({ selectedRole, onSelectRole, options }) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
      {options.map((role) => {
        const selected = selectedRole === role;
        return (
          <Pressable
            key={role}
            onPress={() => onSelectRole(role)}
            style={{
              borderWidth: selected ? 0 : 1.5,
              borderColor: colors.border,
              backgroundColor: selected ? colors.primary : colors.surface,
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 999
            }}
          >
            <Text style={{
              color: selected ? "#FFFFFF" : colors.text,
              fontWeight: "600",
              fontSize: 14
            }}>
              {role}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
