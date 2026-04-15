import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function ToggleRow({ label, description, value, onToggle, colors }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontWeight: "600", color: colors.text, fontSize: 15 }}>{label}</Text>
        {description ? <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{description}</Text> : null}
      </View>
      <View style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        backgroundColor: value ? colors.accent : colors.border,
        justifyContent: "center",
        paddingHorizontal: 3
      }}>
        <View style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: "#FFFFFF",
          alignSelf: value ? "flex-end" : "flex-start"
        }} />
      </View>
    </Pressable>
  );
}

function SectionHeader({ title, colors }) {
  return (
    <Text style={{
      fontSize: 13,
      fontWeight: "700",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 24,
      marginBottom: 8,
      marginLeft: 4
    }}>
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const { currentUser, logout, deleteMyAccount, updateMyProfile, updateNotificationSettings, showErrorToast } = useAuth();
  const { preference, setThemePreference, colors, shadows } = useTheme();
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
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5 }}>Settings</Text>

      {/* Privacy Section */}
      <SectionHeader title="Privacy" colors={colors} />
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.sm || {})
      }}>
        <ToggleRow label="Show Full Name" description="Display your full name publicly" value={showFullName} onToggle={() => setShowFullName((prev) => !prev)} colors={colors} />
        <ToggleRow label="Anonymous Posts" description="Hide your identity when posting" value={anonymousPosts} onToggle={() => setAnonymousPosts((prev) => !prev)} colors={colors} />
        <Pressable
          onPress={savePrivacy}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 10,
            paddingVertical: 12,
            marginTop: 14,
            opacity: saving ? 0.6 : 1
          }}
        >
          <Text style={{ textAlign: "center", color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
            {saving ? "Saving..." : "Save Privacy Settings"}
          </Text>
        </Pressable>
      </View>

      {/* Notifications Section */}
      <SectionHeader title="Notifications" colors={colors} />
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.sm || {})
      }}>
        <ToggleRow label="All Notifications" value={Boolean(notificationSettings.all)} onToggle={() => toggleNoti("all")} colors={colors} />
        <ToggleRow label="New Issues" value={Boolean(notificationSettings.newIssue)} onToggle={() => toggleNoti("newIssue")} colors={colors} />
        <ToggleRow label="Comments" value={Boolean(notificationSettings.comment)} onToggle={() => toggleNoti("comment")} colors={colors} />
        <ToggleRow label="Assignments" value={Boolean(notificationSettings.assignment)} onToggle={() => toggleNoti("assignment")} colors={colors} />
        <ToggleRow label="Status Changes" value={Boolean(notificationSettings.status)} onToggle={() => toggleNoti("status")} colors={colors} />
        <ToggleRow label="Progress Updates" value={Boolean(notificationSettings.progress)} onToggle={() => toggleNoti("progress")} colors={colors} />
        <ToggleRow label="Authority Approval" value={Boolean(notificationSettings.approval)} onToggle={() => toggleNoti("approval")} colors={colors} />
      </View>

      {/* Appearance Section */}
      <SectionHeader title="Appearance" colors={colors} />
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.sm || {})
      }}>
        <Text style={{ fontWeight: "600", color: colors.text, fontSize: 15, marginBottom: 8 }}>Theme</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { key: "system", label: "System" },
            { key: "light", label: "Light" },
            { key: "dark", label: "Dark" }
          ].map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setThemePreference(item.key)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: preference === item.key ? colors.primary : colors.surfaceAlt,
                borderWidth: preference === item.key ? 0 : 1,
                borderColor: colors.border,
                alignItems: "center"
              }}
            >
              <Text style={{
                fontWeight: "600",
                color: preference === item.key ? "#FFFFFF" : colors.text,
                fontSize: 14
              }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Danger Zone */}
      <SectionHeader title="Account" colors={colors} />
      <View style={{ gap: 10 }}>
        <Pressable
          onPress={logout}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            borderWidth: colors.mode === "dark" ? 1 : 0,
            borderColor: colors.cardBorder,
            ...(shadows?.sm || {})
          }}
        >
          <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Sign Out</Text>
        </Pressable>

        <Pressable
          onPress={() => Alert.alert("Delete Account", "This action is permanent and cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => deleteMyAccount().catch(showErrorToast) }
          ])}
          style={{
            borderWidth: 1.5,
            borderColor: colors.danger,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center"
          }}
        >
          <Text style={{ fontWeight: "700", color: colors.danger, fontSize: 15 }}>Delete Account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
