import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function StatusBadge({ status = "open" }) {
  const { colors } = useTheme();

  const colorMap = {
    open: colors.statusOpen,
    in_progress: colors.statusInProgress,
    resolved: colors.statusResolved,
    closed: colors.statusClosed
  };

  const c = colorMap[status] || colorMap.open;

  const labels = {
    open: "OPEN",
    in_progress: "IN PROGRESS",
    resolved: "RESOLVED",
    closed: "CLOSED"
  };

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 5,
        backgroundColor: c.bg
      }}
    >
      <Text style={{ color: c.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
        {labels[status] || status.replace("_", " ").toUpperCase()}
      </Text>
    </View>
  );
}
