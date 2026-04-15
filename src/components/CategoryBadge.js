import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function CategoryBadge({ category }) {
  if (!category) {
    return null;
  }

  const { colors } = useTheme();

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 5,
        backgroundColor: colors.primaryLight
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>{category}</Text>
    </View>
  );
}
