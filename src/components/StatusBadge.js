import React from "react";
import { Text, View } from "react-native";

const STATUS_COLORS = {
  open: { background: "#EAEFF5", text: "#344054" },
  in_progress: { background: "#DBEAFE", text: "#1D4ED8" },
  resolved: { background: "#DCFCE7", text: "#166534" },
  closed: { background: "#1F2937", text: "#F9FAFB" }
};

export default function StatusBadge({ status = "open" }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.open;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: colors.background
      }}
    >
      <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
        {status.replace("_", " ").toUpperCase()}
      </Text>
    </View>
  );
}

