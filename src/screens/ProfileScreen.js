import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import AuthInput from "../components/AuthInput";
import { formatTimestamp } from "../services/issues";
import { useTheme } from "../context/ThemeContext";
import { pressFeedbackStyle } from "../styles";

export default function ProfileScreen({ navigation }) {
  const { currentUser, userRole, getMyProfileStats, updateMyProfile, showErrorToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ issuesCreated: 0, commentsMade: 0, issuesResolved: 0, myIssues: [], myComments: [] });
  const [name, setName] = useState(currentUser?.name || "");
  const [avatar, setAvatar] = useState(currentUser?.avatar || "");
  const [bio, setBio] = useState(currentUser?.bio || "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyProfileStats();
      setStats(data);
      setName(currentUser?.name || "");
      setAvatar(currentUser?.avatar || "");
      setBio(currentUser?.bio || "");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [getMyProfileStats, currentUser?.name, currentUser?.avatar, currentUser?.bio, showErrorToast]);

  useFocusEffect(useCallback(() => {
    load();
    return undefined;
  }, [load]));

  const onSave = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        name,
        avatar,
        bio,
        privacy: currentUser?.privacy || { showFullName: true, anonymousPosts: false }
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const initials = (currentUser?.name || "U")[0].toUpperCase();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {/* Profile Header */}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 24,
        alignItems: "center",
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.lg || {})
      }}>
        <View style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.primaryLight,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 3,
          borderColor: colors.primary,
          marginBottom: 12
        }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.primary }}>{initials}</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{currentUser?.name || "User"}</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <View style={{ backgroundColor: colors.primaryLight, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}>{userRole}</Text>
          </View>
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: "500", fontSize: 12 }}>{currentUser?.channelId || "No channel"}</Text>
          </View>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        {[
          { label: "Issues", value: stats.issuesCreated },
          { label: "Comments", value: stats.commentsMade },
          { label: "Resolved", value: stats.issuesResolved }
        ].map((stat) => (
          <View key={stat.label} style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            alignItems: "center",
            borderWidth: colors.mode === "dark" ? 1 : 0,
            borderColor: colors.cardBorder,
            ...(shadows?.sm || {})
          }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }}>{stat.value}</Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2, fontWeight: "500" }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Edit Form */}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.md || {})
      }}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 14 }}>Edit Profile</Text>
        <AuthInput value={name} onChangeText={setName} label="Name" placeholder="Your name" autoCapitalize="words" />
        <AuthInput value={avatar} onChangeText={setAvatar} label="Avatar URL" placeholder="https://..." />
        <AuthInput value={bio} onChangeText={setBio} label="Bio" placeholder="Tell us about yourself..." multiline maxLength={250} />

        <Pressable
          onPress={onSave}
          style={({ pressed }) => [
            {
              backgroundColor: colors.primary,
              borderRadius: 10,
              paddingVertical: 14,
              marginTop: 4
            },
            pressFeedbackStyle(pressed, saving)
          ]}
        >
          <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
            {saving ? "Saving..." : "Save Profile"}
          </Text>
        </Pressable>
      </View>

      {/* My Issues */}
      {stats.myIssues.length > 0 ? (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 10 }}>My Issues</Text>
          {stats.myIssues.map((issue) => (
            <Pressable
              key={issue.id}
              onPress={() => navigation.navigate("IssueDetail", { issueId: issue.id })}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: colors.mode === "dark" ? 1 : 0,
                  borderColor: colors.cardBorder,
                  ...(shadows?.sm || {})
                },
                pressFeedbackStyle(pressed)
              ]}
            >
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>{issue.title}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <View style={{
                  backgroundColor: colors.primaryLight,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 3
                }}>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>{issue.status}</Text>
                </View>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{formatTimestamp(issue.createdAt)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* My Comments */}
      {stats.myComments.length > 0 ? (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 10 }}>My Comments</Text>
          {stats.myComments.map((comment) => (
            <View
              key={comment.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                borderWidth: colors.mode === "dark" ? 1 : 0,
                borderColor: colors.cardBorder,
                ...(shadows?.sm || {})
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{comment.text}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 6 }}>{formatTimestamp(comment.createdAt)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
