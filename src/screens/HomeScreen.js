import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { pressFeedbackStyle } from "../styles";

function QuickAction({ title, subtitle, onPress, colors, shadows, accentColor }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          borderWidth: colors.mode === "dark" ? 1 : 0,
          borderColor: colors.cardBorder,
          ...(shadows?.md || {})
        },
        pressFeedbackStyle(pressed)
      ]}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: accentColor || colors.primaryLight,
        marginBottom: 10
      }} />
      <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>{title}</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const {
    currentUser,
    channelId,
    userRole,
    logout,
    showErrorToast
  } = useAuth();
  const { colors, shadows } = useTheme();

  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!currentUser?.uid) {
      setUnreadNotifications(0);
      return;
    }
    const data = await apiGet("/api/notifications");
    setUnreadNotifications((data.items || []).filter((item) => !item.read).length);
  }, [currentUser?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadUnread().catch(showErrorToast);
    }, [loadUnread, showErrorToast])
  );

  const firstName = (currentUser?.name || currentUser?.email || "").split(" ")[0] || "Student";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 15, color: colors.textSecondary, fontWeight: "500" }}>
          College Complaint Portal
        </Text>
        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5, marginTop: 2 }}>
          Welcome, {firstName}
        </Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <View style={{
            backgroundColor: colors.primaryLight,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 6
          }}>
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
              {userRole || "User"}
            </Text>
          </View>
          {channelId ? (
            <View style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 6
            }}>
              <Text style={{ color: colors.textSecondary, fontWeight: "500", fontSize: 13 }}>
                College ID: {channelId}
              </Text>
            </View>
          ) : null}
          {unreadNotifications > 0 ? (
            <View style={{
              backgroundColor: colors.dangerLight,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 6
            }}>
              <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 13 }}>
                {unreadNotifications} unread
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {channelId ? (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
            Quick Actions
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            <QuickAction
              title="Complaints Feed"
              subtitle="Browse student complaints"
              onPress={() => navigation.navigate("Feed")}
              colors={colors}
              shadows={shadows}
            />
            <QuickAction
              title="File Complaint"
              subtitle="Submit issue with details"
              onPress={() => navigation.navigate("CreateIssue")}
              colors={colors}
              shadows={shadows}
              accentColor={colors.accentLight}
            />
          </View>
        </View>
      ) : (
        <View style={{
          backgroundColor: colors.warningLight,
          borderRadius: 16,
          padding: 16,
          marginBottom: 20
        }}>
          <Text style={{ color: colors.warningText, fontWeight: "700", fontSize: 15 }}>
            No college channel assigned
          </Text>
          <Text style={{ color: colors.warningText, fontSize: 13, marginTop: 4, opacity: 0.8 }}>
            Contact your college admin to join the correct channel.
          </Text>
        </View>
      )}

      {["Authority", "Head", "SuperAdmin"].includes(userRole) ? (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
            Management Dashboards
          </Text>
          <View style={{ gap: 10 }}>
            {userRole === "Authority" ? (
              <>
                <Pressable
                  onPress={() => navigation.navigate("AuthorityPersonalizedFeed")}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      padding: 16,
                      borderWidth: colors.mode === "dark" ? 1 : 0,
                      borderColor: colors.cardBorder,
                      ...(shadows?.sm || {})
                    },
                    pressFeedbackStyle(pressed)
                  ]}
                >
                  <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Personalized Feed</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Assigned + department-tagged complaints</Text>
                </Pressable>
              </>
            ) : null}

            <Pressable
              onPress={() => navigation.navigate("AuthorityDashboard")}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: colors.mode === "dark" ? 1 : 0,
                  borderColor: colors.cardBorder,
                  ...(shadows?.sm || {})
                },
                pressFeedbackStyle(pressed)
              ]}
            >
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Authority Dashboard</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Manage assigned complaints</Text>
            </Pressable>

            {userRole === "Head" ? (
              <Pressable
                onPress={() => navigation.navigate("HeadDashboard")}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: colors.mode === "dark" ? 1 : 0,
                    borderColor: colors.cardBorder,
                    ...(shadows?.sm || {})
                  },
                  pressFeedbackStyle(pressed)
                ]}
              >
                <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Head Dashboard</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Approve authorities and monitor resolution</Text>
              </Pressable>
            ) : null}

            {["Head", "SuperAdmin"].includes(userRole || "") ? (
              <Pressable
                onPress={() => navigation.navigate("AuthorityTagManager")}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: colors.mode === "dark" ? 1 : 0,
                    borderColor: colors.cardBorder,
                    ...(shadows?.sm || {})
                  },
                  pressFeedbackStyle(pressed)
                ]}
              >
                <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Authority Department Tags</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Assign one or more department tags per authority</Text>
              </Pressable>
            ) : null}

            {userRole === "SuperAdmin" ? (
              <Pressable
                onPress={() => navigation.navigate("SuperAdminDashboard")}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: colors.mode === "dark" ? 1 : 0,
                    borderColor: colors.cardBorder,
                    ...(shadows?.sm || {})
                  },
                  pressFeedbackStyle(pressed)
                ]}
              >
                <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Super Admin Panel</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>System-wide college governance</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 10, marginTop: 8 }}>
        {userRole === "User" ? (
          <Pressable
            onPress={() => navigation.navigate("MyIssues")}
            style={({ pressed }) => [
              {
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: colors.mode === "dark" ? 1 : 0,
                borderColor: colors.cardBorder,
                ...(shadows?.sm || {})
              },
              pressFeedbackStyle(pressed)
            ]}
          >
            <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>My Issues</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13 }}>View your complaints by status</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => navigation.navigate("Profile")}
          style={({ pressed }) => [
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              borderWidth: colors.mode === "dark" ? 1 : 0,
              borderColor: colors.cardBorder,
              ...(shadows?.sm || {})
            },
            pressFeedbackStyle(pressed)
          ]}
        >
          <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Profile</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{currentUser?.email || ""}</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("Settings")}
          style={({ pressed }) => [
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              borderWidth: colors.mode === "dark" ? 1 : 0,
              borderColor: colors.cardBorder,
              ...(shadows?.sm || {})
            },
            pressFeedbackStyle(pressed)
          ]}
        >
          <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Settings</Text>
        </Pressable>

        <Pressable
          onPress={logout}
          style={({ pressed }) => [{ paddingVertical: 16, alignItems: "center", marginTop: 8 }, pressFeedbackStyle(pressed)]}
        >
          <Text style={{ color: colors.textTertiary, fontWeight: "600", fontSize: 14 }}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
