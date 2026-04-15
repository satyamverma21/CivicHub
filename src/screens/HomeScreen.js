import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../services/api";
import { useTheme } from "../context/ThemeContext";

function QuickAction({ title, subtitle, onPress, colors, shadows, iconText, accentColor }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.md || {})
      }}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: accentColor || colors.primaryLight,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10
      }}>
        <Text style={{ fontSize: 18 }}>{iconText}</Text>
      </View>
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
  const { colors, shadows, spacing } = useTheme();

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

  const firstName = (currentUser?.name || currentUser?.email || "").split(" ")[0] || "there";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      {/* Welcome */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 15, color: colors.textSecondary, fontWeight: "500" }}>
          Welcome back,
        </Text>
        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5, marginTop: 2 }}>
          {firstName} 👋
        </Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <View style={{
            backgroundColor: colors.primaryLight,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 6
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
                Channel: {channelId}
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

      {/* Quick Actions */}
      {channelId ? (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
            Quick Actions
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            <QuickAction
              title="Issues Feed"
              subtitle="Browse & discuss"
              onPress={() => navigation.navigate("Feed")}
              colors={colors}
              shadows={shadows}
              iconText="📋"
            />
            <QuickAction
              title="Report Issue"
              subtitle="Text, image or voice"
              onPress={() => navigation.navigate("CreateIssue")}
              colors={colors}
              shadows={shadows}
              iconText="✏️"
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
            No channel assigned
          </Text>
          <Text style={{ color: colors.warningText, fontSize: 13, marginTop: 4, opacity: 0.8 }}>
            Contact your organization head to join a channel.
          </Text>
        </View>
      )}

      {/* Role Dashboards */}
      {["Authority", "Head", "SuperAdmin"].includes(userRole) ? (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
            Dashboards
          </Text>
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => navigation.navigate("AuthorityDashboard")}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                borderWidth: colors.mode === "dark" ? 1 : 0,
                borderColor: colors.cardBorder,
                ...(shadows?.sm || {})
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.infoLight, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 20 }}>⚡</Text>
              </View>
              <View>
                <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Authority Dashboard</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Manage assigned issues</Text>
              </View>
            </Pressable>

            {userRole === "Head" ? (
              <Pressable
                onPress={() => navigation.navigate("HeadDashboard")}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  borderWidth: colors.mode === "dark" ? 1 : 0,
                  borderColor: colors.cardBorder,
                  ...(shadows?.sm || {})
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 20 }}>👑</Text>
                </View>
                <View>
                  <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Head Dashboard</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Approve authorities & manage</Text>
                </View>
              </Pressable>
            ) : null}

            {userRole === "SuperAdmin" ? (
              <Pressable
                onPress={() => navigation.navigate("SuperAdminDashboard")}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  borderWidth: colors.mode === "dark" ? 1 : 0,
                  borderColor: colors.cardBorder,
                  ...(shadows?.sm || {})
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.dangerLight, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 20 }}>🛡</Text>
                </View>
                <View>
                  <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>SuperAdmin Panel</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Full system governance</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Profile & Settings */}
      <View style={{ gap: 10, marginTop: 8 }}>
        <Pressable
          onPress={() => navigation.navigate("Profile")}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            borderWidth: colors.mode === "dark" ? 1 : 0,
            borderColor: colors.cardBorder,
            ...(shadows?.sm || {})
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 14 }}>
              {(currentUser?.name || "U")[0].toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Profile</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{currentUser?.email || ""}</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("Settings")}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            borderWidth: colors.mode === "dark" ? 1 : 0,
            borderColor: colors.cardBorder,
            ...(shadows?.sm || {})
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </View>
          <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Settings</Text>
        </Pressable>

        <Pressable
          onPress={logout}
          style={{ paddingVertical: 16, alignItems: "center", marginTop: 8 }}
        >
          <Text style={{ color: colors.textTertiary, fontWeight: "600", fontSize: 14 }}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
