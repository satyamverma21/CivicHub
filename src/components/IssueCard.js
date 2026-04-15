import React, { useEffect, useRef } from "react";
import { Animated, Image, Pressable, Text, View } from "react-native";
import CategoryBadge from "./CategoryBadge";
import ImageCarousel from "./ImageCarousel";
import StatusBadge from "./StatusBadge";
import { formatTimestamp } from "../services/issues";

const ROLE_COLORS = {
  User: { bg: "#E7F3FF", text: "#0058B3" },
  Authority: { bg: "#FFF4E5", text: "#8A4B00" },
  Head: { bg: "#E8F5E9", text: "#1B5E20" }
};

function initials(name) {
  const parts = (name || "U").split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  return `${parts[0][0]}${parts[1]?.[0] || ""}`.toUpperCase();
}

function descriptionPreview(description) {
  if (!description) {
    return "";
  }
  if (description.length <= 180) {
    return description;
  }
  return `${description.slice(0, 177)}...`;
}

export default function IssueCard({ issue, onPress, onLikePress, currentUserId, onSharePress }) {
  const role = issue.authorRole || "User";
  const roleColor = ROLE_COLORS[role] || ROLE_COLORS.User;
  const liked = Array.isArray(issue.likes) && issue.likes.includes(currentUserId);
  const likeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(likeScale, { toValue: liked ? 1.25 : 1, duration: 120, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true })
    ]).start();
  }, [liked, likeScale]);

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#D8DEE4",
        padding: 12,
        marginBottom: 12
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          {issue.authorAvatar ? (
            <Image
              source={{ uri: issue.authorAvatar }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#EAEFF5" }}
            />
          ) : (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#DEE6EE",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ fontWeight: "700" }}>{initials(issue.authorName)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", color: "#1F2328" }}>{issue.authorName}</Text>
            <Text style={{ color: "#59636E", fontSize: 12 }}>{formatTimestamp(issue.createdAt)}</Text>
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: roleColor.bg
          }}
        >
          <Text style={{ color: roleColor.text, fontWeight: "600", fontSize: 11 }}>{role}</Text>
        </View>
      </View>

      <Text style={{ marginTop: 10, fontSize: 16, fontWeight: "700", color: "#1F2328" }}>{issue.title}</Text>
      <Text style={{ marginTop: 4, color: "#2F353D" }}>{descriptionPreview(issue.description)}</Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <StatusBadge status={issue.status} />
        <CategoryBadge category={issue.category} />
        {issue.isVoiceReport ? (
          <View style={{ backgroundColor: "#EDE9FE", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: "#4C1D95", fontWeight: "700", fontSize: 11 }}>Voice Report</Text>
          </View>
        ) : null}
        {issue.isAIRefined ? (
          <View style={{ backgroundColor: "#E6FFEC", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: "#1A7F37", fontWeight: "700", fontSize: 11 }}>AI-refined</Text>
          </View>
        ) : null}
      </View>

      {issue.aiSummary ? (
        <Text style={{ marginTop: 8, color: "#1F2328", fontWeight: "600" }}>{issue.aiSummary}</Text>
      ) : null}

      <ImageCarousel images={issue.images || []} />

      <View style={{ flexDirection: "row", marginTop: 12, justifyContent: "space-between" }}>
        <Pressable onPress={onLikePress} accessibilityLabel="Like issue" hitSlop={8}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Text style={{ color: liked ? "#D1242F" : "#2F353D", fontWeight: "600" }}>
              {liked ? "?" : "?"} {issue.likesCount || 0}
            </Text>
          </Animated.View>
        </Pressable>
        <Text style={{ color: "#2F353D", fontWeight: "600" }}>Comments {issue.commentsCount || 0}</Text>
        <Pressable onPress={onSharePress}>
          <Text style={{ color: "#0969DA", fontWeight: "600" }}>Share</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
