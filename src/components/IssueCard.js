import React, { useEffect, useRef } from "react";
import { Animated, Image, Pressable, Text, View } from "react-native";
import CategoryBadge from "./CategoryBadge";
import ImageCarousel from "./ImageCarousel";
import StatusBadge from "./StatusBadge";
import { formatTimestamp } from "../services/issues";
import { useTheme } from "../context/ThemeContext";
import { pressFeedbackStyle } from "../styles";
import { MapPinIcon, HeartIcon, Share2Icon, MessageCircle2Icon } from "./Icons";

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
  if (description.length <= 140) {
    return description;
  }
  return `${description.slice(0, 137)}...`;
}

export default function IssueCard({ issue, onPress, onLikePress, currentUserId, onSharePress }) {
  const { colors, shadows } = useTheme();
  const role = issue.authorRole || "User";

  const roleColorMap = {
    User: colors.roleUser,
    Authority: colors.roleAuthority,
    Head: colors.roleHead,
    SuperAdmin: colors.roleSuperAdmin
  };
  const roleColor = roleColorMap[role] || colors.roleUser;

  const liked = Array.isArray(issue.likes) && issue.likes.includes(currentUserId);
  const likeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(likeScale, { toValue: liked ? 1.2 : 1, duration: 120, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true })
    ]).start();
  }, [liked, likeScale]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 14,
          borderWidth: colors.mode === "dark" ? 1 : 0,
          borderColor: colors.cardBorder,
          ...(shadows?.md || {})
        },
        pressFeedbackStyle(pressed)
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          {issue.authorAvatar ? (
            <Image
              source={{ uri: issue.authorAvatar }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primaryLight,
                borderWidth: 2,
                borderColor: colors.primaryLight
              }}
            />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primaryLight,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 14 }}>
                {initials(issue.authorName)}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", color: colors.text, fontSize: 14 }}>{issue.authorName}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>
              {formatTimestamp(issue.createdAt)}
            </Text>
          </View>
        </View>
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: roleColor.bg }}>
          <Text style={{ color: roleColor.text, fontWeight: "600", fontSize: 11 }}>{role}</Text>
        </View>
      </View>

      <Text style={{ marginTop: 12, fontSize: 17, fontWeight: "700", color: colors.text, lineHeight: 23 }}>
        {issue.title}
      </Text>
      {issue.description ? (
        <Text style={{ marginTop: 6, color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
          {descriptionPreview(issue.description)}
        </Text>
      ) : null}
      {issue.location ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
          <MapPinIcon size={16} color={colors.textTertiary} strokeWidth={2} />
          <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
            {issue.location}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <StatusBadge status={issue.status} />
        <CategoryBadge category={issue.category} />
      </View>

      <ImageCarousel images={issue.images || []} />

      <View style={{
        flexDirection: "row",
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <Pressable
          onPress={onLikePress}
          accessibilityLabel="Like complaint"
          hitSlop={8}
          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 6 }, pressFeedbackStyle(pressed)]}
        >
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <HeartIcon size={16} color={liked ? colors.danger : colors.textSecondary} strokeWidth={2} filled={liked} />
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Text style={{ color: liked ? colors.danger : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>
              {liked ? "Liked" : "Like"}
            </Text>
          </Animated.View>
          <Text style={{ color: liked ? colors.danger : colors.textSecondary, fontWeight: "600", fontSize: 14 }}>
            {issue.likesCount || 0}
          </Text>
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MessageCircle2Icon size={16} color={colors.textSecondary} strokeWidth={2} />
          <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Comments</Text>
          <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 14 }}>
            {issue.commentsCount || 0}
          </Text>
        </View>

        <Pressable onPress={onSharePress} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 6 }, pressFeedbackStyle(pressed)]}>
          <Share2Icon size={16} color={colors.primary} strokeWidth={2} />
          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>Share</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
