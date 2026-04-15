import React from "react";
import { Pressable, Text, View } from "react-native";

export default function RoleSelector({ selectedRole, onSelectRole, options }) {
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
              borderColor: selected ? "#222" : "#999",
              backgroundColor: selected ? "#ddd" : "#fff",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6
            }}
          >
            <Text>{role}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}