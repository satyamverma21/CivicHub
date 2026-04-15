import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function ToggleRow({ label, value, onToggle }) {
  return (
    <Pressable onPress={onToggle} style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, marginTop: 8 }}>
      <Text style={{ fontWeight: "700" }}>{label}</Text>
      <Text>{value ? "On" : "Off"}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { currentUser, logout, deleteMyAccount, updateMyProfile, updateNotificationSettings, showErrorToast } = useAuth();
  const { preference, setThemePreference } = useTheme();
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
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Settings</Text>

      <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 16 }}>Privacy</Text>
      <ToggleRow label="Show Full Name" value={showFullName} onToggle={() => setShowFullName((prev) => !prev)} />
      <ToggleRow label="Anonymous Posts" value={anonymousPosts} onToggle={() => setAnonymousPosts((prev) => !prev)} />
      <Pressable onPress={savePrivacy} style={{ marginTop: 8, backgroundColor: "#0969DA", borderRadius: 8, padding: 10, opacity: saving ? 0.6 : 1 }}>
        <Text style={{ textAlign: "center", color: "#FFF", fontWeight: "700" }}>{saving ? "Saving..." : "Save Privacy"}</Text>
      </Pressable>

      <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 16 }}>Notifications</Text>
      <ToggleRow label="All Notifications" value={Boolean(notificationSettings.all)} onToggle={() => toggleNoti("all")} />
      <ToggleRow label="New Issue" value={Boolean(notificationSettings.newIssue)} onToggle={() => toggleNoti("newIssue")} />
      <ToggleRow label="Comments" value={Boolean(notificationSettings.comment)} onToggle={() => toggleNoti("comment")} />
      <ToggleRow label="Assignment" value={Boolean(notificationSettings.assignment)} onToggle={() => toggleNoti("assignment")} />
      <ToggleRow label="Status Changes" value={Boolean(notificationSettings.status)} onToggle={() => toggleNoti("status")} />
      <ToggleRow label="Progress Updates" value={Boolean(notificationSettings.progress)} onToggle={() => toggleNoti("progress")} />
      <ToggleRow label="Authority Approval" value={Boolean(notificationSettings.approval)} onToggle={() => toggleNoti("approval")} />

      <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 16 }}>Appearance</Text>
      <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, marginTop: 8 }}>
        <Picker selectedValue={preference} onValueChange={(value) => setThemePreference(value)}>
          <Picker.Item label="System" value="system" />
          <Picker.Item label="Light" value="light" />
          <Picker.Item label="Dark" value="dark" />
        </Picker>
      </View>

      <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 16 }}>Language</Text>
      <TextInput value={language} onChangeText={setLanguage} editable={false} style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, marginTop: 8, color: "#59636E" }} />

      <Pressable onPress={logout} style={{ marginTop: 20, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 12 }}>
        <Text style={{ textAlign: "center", fontWeight: "700" }}>Logout</Text>
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
