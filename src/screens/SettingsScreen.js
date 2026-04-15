import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function ToggleRow({ label, value, onToggle, colors }) {
  return (
    <Pressable onPress={onToggle} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginTop: 8, backgroundColor: colors.surface }}>
      <Text style={{ fontWeight: "700", color: colors.text }}>{label}</Text>
      <Text style={{ color: colors.muted }}>{value ? "On" : "Off"}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { currentUser, logout, deleteMyAccount, updateMyProfile, updateNotificationSettings, showErrorToast } = useAuth();
  const { preference, setThemePreference, colors } = useTheme();
  const [saving, setSaving] = useState(false);

  const privacy = useMemo(() => currentUser?.privacy || { showFullName: true, anonymousPosts: false }, [currentUser?.privacy]);
  const notificationSettings = useMemo(
    () => currentUser?.notificationSettings || {
      all: true,
      newIssue: true,
      comment: true,
      assignment: true,
      status: true,
      progress: true,
      approval: true
    },
    [currentUser?.notificationSettings]
  );

  const [showFullName, setShowFullName] = useState(Boolean(privacy.showFullName));
  const [anonymousPosts, setAnonymousPosts] = useState(Boolean(privacy.anonymousPosts));
  const [language, setLanguage] = useState("Coming soon");

  const savePrivacy = async () => {
    setSaving(true);
    try {
      await updateMyProfile({
        name: currentUser?.name || "",
        avatar: currentUser?.avatar || "",
        bio: currentUser?.bio || "",
        privacy: { showFullName, anonymousPosts }
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleNoti = async (key) => {
    try {
      const next = { ...notificationSettings, [key]: !notificationSettings[key] };
      if (key === "all" && !next.all) {
        next.newIssue = false;
        next.comment = false;
        next.assignment = false;
        next.status = false;
        next.progress = false;
        next.approval = false;
      }
      await updateNotificationSettings(next);
    } catch (error) {
      showErrorToast(error);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>Settings</Text>

      <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 16, color: colors.text }}>Privacy</Text>
      <ToggleRow label="Show Full Name" value={showFullName} onToggle={() => setShowFullName((prev) => !prev)} colors={colors} />
      <ToggleRow label="Anonymous Posts" value={anonymousPosts} onToggle={() => setAnonymousPosts((prev) => !prev)} colors={colors} />
      <Pressable onPress={savePrivacy} style={{ marginTop: 8, backgroundColor: "#0969DA", borderRadius: 8, padding: 10, opacity: saving ? 0.6 : 1 }}>
        <Text style={{ textAlign: "center", color: "#FFF", fontWeight: "700" }}>{saving ? "Saving..." : "Save Privacy"}</Text>
      </Pressable>

      <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 16, color: colors.text }}>Notifications</Text>
      <ToggleRow label="All Notifications" value={Boolean(notificationSettings.all)} onToggle={() => toggleNoti("all")} colors={colors} />
      <ToggleRow label="New Issue" value={Boolean(notificationSettings.newIssue)} onToggle={() => toggleNoti("newIssue")} colors={colors} />
      <ToggleRow label="Comments" value={Boolean(notificationSettings.comment)} onToggle={() => toggleNoti("comment")} colors={colors} />
      <ToggleRow label="Assignment" value={Boolean(notificationSettings.assignment)} onToggle={() => toggleNoti("assignment")} colors={colors} />
      <ToggleRow label="Status Changes" value={Boolean(notificationSettings.status)} onToggle={() => toggleNoti("status")} colors={colors} />
      <ToggleRow label="Progress Updates" value={Boolean(notificationSettings.progress)} onToggle={() => toggleNoti("progress")} colors={colors} />
      <ToggleRow label="Authority Approval" value={Boolean(notificationSettings.approval)} onToggle={() => toggleNoti("approval")} colors={colors} />

      <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 16, color: colors.text }}>Appearance</Text>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 8, backgroundColor: colors.surface }}>
        <Picker selectedValue={preference} onValueChange={(value) => setThemePreference(value)}>
          <Picker.Item label="System" value="system" />
          <Picker.Item label="Light" value="light" />
          <Picker.Item label="Dark" value="dark" />
        </Picker>
      </View>

      <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 16, color: colors.text }}>Language</Text>
      <TextInput value={language} onChangeText={setLanguage} editable={false} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginTop: 8, color: colors.muted, backgroundColor: colors.surface }} />

      <Pressable onPress={logout} style={{ marginTop: 20, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, backgroundColor: colors.surface }}>
        <Text style={{ textAlign: "center", fontWeight: "700", color: colors.text }}>Logout</Text>
      </Pressable>

      <Pressable
        onPress={() => Alert.alert("Delete Account", "This action is permanent.", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => deleteMyAccount().catch(showErrorToast) }
        ])}
        style={{ marginTop: 10, borderWidth: 1, borderColor: "#CF222E", borderRadius: 8, padding: 12 }}
      >
        <Text style={{ textAlign: "center", fontWeight: "700", color: "#CF222E" }}>Delete Account</Text>
      </Pressable>
    </ScrollView>
  );
}
