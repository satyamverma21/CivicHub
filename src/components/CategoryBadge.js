import React from "react";
import { Text, View } from "react-native";

export default function CategoryBadge({ category }) {
  if (!category) {
    return null;
  }

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderWidth: 1,
        borderColor: "#D0D7DE",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: "#24292F" }}>{category}</Text>
    </View>
  );
}
