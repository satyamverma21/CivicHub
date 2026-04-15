import React from "react";
import { Image, Text, View } from "react-native";
import { formatTimestamp } from "../services/issues";

function initials(name) {
  const parts = (name || "U").split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  return `${parts[0][0]}${parts[1]?.[0] || ""}`.toUpperCase();
}

export default function CommentItem({ comment }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
      {comment.userAvatar ? (
        <Image
          source={{ uri: comment.userAvatar }}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#EAEFF5" }}
        />
      ) : (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "#DEE6EE",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700" }}>{initials(comment.userName)}</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
          <Text style={{ fontWeight: "700", color: "#1F2328" }}>{comment.userName}</Text>
          <Text style={{ color: "#59636E", fontSize: 12 }}>{formatTimestamp(comment.createdAt)}</Text>
        </View>
        <Text style={{ color: "#2F353D" }}>{comment.text}</Text>
      </View>
    </View>
  );
}
