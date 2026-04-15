import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { formatTimestamp } from "../services/issues";
import { useTheme } from "../context/ThemeContext";

export default function ProfileScreen({ navigation }) {
  const { currentUser, userRole, getMyProfileStats, updateMyProfile, showErrorToast } = useAuth();
  const { colors } = useTheme();
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
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>Profile</Text>
      <Text style={{ marginTop: 6, color: colors.text }}>Role: {userRole}</Text>
      <Text style={{ color: colors.text }}>Channel: {currentUser?.channelId || "-"}</Text>

      <Text style={{ fontWeight: "700", marginTop: 12, color: colors.text }}>Name</Text>
      <TextInput value={name} onChangeText={setName} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginTop: 6, color: colors.text, backgroundColor: colors.surface }} />
      <Text style={{ fontWeight: "700", marginTop: 12, color: colors.text }}>Avatar URL</Text>
      <TextInput value={avatar} onChangeText={setAvatar} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginTop: 6, color: colors.text, backgroundColor: colors.surface }} />
      <Text style={{ fontWeight: "700", marginTop: 12, color: colors.text }}>Bio</Text>
      <TextInput value={bio} onChangeText={setBio} multiline style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginTop: 6, minHeight: 80, textAlignVertical: "top", color: colors.text, backgroundColor: colors.surface }} />

      <Pressable onPress={onSave} style={{ marginTop: 12, backgroundColor: "#0969DA", borderRadius: 8, padding: 12, opacity: saving ? 0.6 : 1 }}>
        <Text style={{ color: "#FFF", textAlign: "center", fontWeight: "700" }}>{saving ? "Saving..." : "Save Profile"}</Text>
      </Pressable>

      <View style={{ marginTop: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, backgroundColor: colors.surface }}>
        <Text style={{ fontWeight: "800", marginBottom: 8, color: colors.text }}>Stats</Text>
        <Text style={{ color: colors.text }}>Issues created: {stats.issuesCreated}</Text>
        <Text style={{ color: colors.text }}>Comments made: {stats.commentsMade}</Text>
        <Text style={{ color: colors.text }}>Issues resolved: {stats.issuesResolved}</Text>
        {userRole === "Authority" ? <Text style={{ marginTop: 6, color: colors.text }}>Satisfaction rating: - (placeholder)</Text> : null}
      </View>

      <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 18, color: colors.text }}>My Issues</Text>
      {stats.myIssues.map((issue) => (
        <Pressable key={issue.id} onPress={() => navigation.navigate("IssueDetail", { issueId: issue.id })} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginTop: 8, backgroundColor: colors.surface }}>
          <Text style={{ fontWeight: "700", color: colors.text }}>{issue.title}</Text>
          <Text style={{ color: colors.text }}>{issue.status}</Text>
          <Text style={{ color: colors.muted }}>{formatTimestamp(issue.createdAt)}</Text>
        </Pressable>
      ))}

      <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 18, color: colors.text }}>My Comments</Text>
      {stats.myComments.map((comment) => (
        <View key={comment.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginTop: 8, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.text }}>{comment.text}</Text>
          <Text style={{ color: colors.muted }}>{formatTimestamp(comment.createdAt)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
