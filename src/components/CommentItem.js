import React from "react";
import { Image, Text, View } from "react-native";
import { formatTimestamp } from "../services/issues";
import { useTheme } from "../context/ThemeContext";

function initials(name) {
  const parts = (name || "U").split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  return `${parts[0][0]}${parts[1]?.[0] || ""}`.toUpperCase();
}

export default function CommentItem({ comment }) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
      {comment.userAvatar ? (
        <Image
          source={{ uri: comment.userAvatar }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.primaryLight,
            borderWidth: 2,
            borderColor: colors.primaryLight
          }}
        />
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: colors.border
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
            {initials(comment.userName)}
          </Text>
        </View>
      )}

      <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontWeight: "700", color: colors.text, fontSize: 14 }}>{comment.userName}</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{formatTimestamp(comment.createdAt)}</Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{comment.text}</Text>
      </View>
    </View>
  );
}
