import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../services/api";
import { useTheme } from "../context/ThemeContext";

export default function HomeScreen({ navigation }) {
  const {
    currentUser,
    channelId,
    userRole,
    logout,
    getSuperAdminOverview,
    superAdminUpdateUserRole,
    showErrorToast
  } = useAuth();
  const { colors } = useTheme();

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminChannels, setAdminChannels] = useState([]);
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadSuperAdmin = useCallback(async () => {
    if (userRole !== "SuperAdmin") {
      return;
    }
    setLoadingAdminData(true);
    try {
      const result = await getSuperAdminOverview();
      setAdminChannels(result.channels);
      setAdminUsers(result.users);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoadingAdminData(false);
    }
  }, [userRole, getSuperAdminOverview, showErrorToast]);

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
      loadSuperAdmin();
      loadUnread().catch(showErrorToast);
    }, [loadSuperAdmin, loadUnread, showErrorToast])
  );

  const onRoleChange = async (userId, role) => {
    try {
      await superAdminUpdateUserRole(userId, role);
      await loadSuperAdmin();
    } catch (error) {
      showErrorToast(error);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={{ fontSize: 24, marginBottom: 8, color: colors.text, fontWeight: "700" }}>Home</Text>
      <Text style={{ color: colors.text }}>Email: {currentUser?.email || "-"}</Text>
      <Text style={{ color: colors.text }}>Role: {userRole || "-"}</Text>
      <Text style={{ marginTop: 4, color: colors.text }}>Channel ID: {channelId || "Not assigned"}</Text>
      <Text style={{ marginTop: 4, color: colors.text }}>Notifications: {unreadNotifications}</Text>

      {channelId ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          <Pressable onPress={() => navigation.navigate("Feed")} style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, borderRadius: 6 }}>
            <Text style={{ color: colors.text }}>Open Feed</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("CreateIssue")} style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, borderRadius: 6 }}>
            <Text style={{ color: colors.text }}>Quick Create Issue</Text>
          </Pressable>
        </View>
      ) : null}

      {["Authority", "Head", "SuperAdmin"].includes(userRole) ? (
        <Pressable
          onPress={() => navigation.navigate("AuthorityDashboard")}
          style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, borderRadius: 6, marginTop: 10 }}
        >
          <Text style={{ color: colors.text }}>Open Authority Dashboard</Text>
        </Pressable>
      ) : null}

      {userRole === "Head" ? (
        <Pressable
          onPress={() => navigation.navigate("HeadDashboard")}
          style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, borderRadius: 6, marginTop: 10 }}
        >
          <Text style={{ color: colors.text }}>Open Head Dashboard</Text>
        </Pressable>
      ) : null}

      {userRole === "SuperAdmin" ? (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 18, marginBottom: 10, color: colors.text, fontWeight: "700" }}>SuperAdmin Panel</Text>
          <Pressable
            onPress={() => navigation.navigate("SuperAdminDashboard")}
            style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, borderRadius: 6, marginBottom: 10 }}
          >
            <Text style={{ color: colors.text }}>Open SuperAdmin Dashboard</Text>
          </Pressable>
          {loadingAdminData ? <Text style={{ color: colors.text }}>Loading channels and users...</Text> : null}
          {!loadingAdminData ? <Text style={{ color: colors.text }}>Channels: {adminChannels.length}</Text> : null}
          {!loadingAdminData ? <Text style={{ color: colors.text }}>Users: {adminUsers.length}</Text> : null}

          {!loadingAdminData &&
            adminUsers.map((item) => (
              <View
                key={item.id}
                style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 8, padding: 10, marginTop: 10 }}
              >
                <Text style={{ color: colors.text }}>{item.email}</Text>
                <Text style={{ color: colors.text }}>Current Role: {item.role}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {["Head", "User", "Authority"].map((role) => (
                    <Pressable
                      key={role}
                      onPress={() => onRoleChange(item.id, role)}
                      style={{ borderWidth: 1, borderColor: colors.border, padding: 8, borderRadius: 6 }}
                    >
                      <Text style={{ color: colors.text }}>Set {role}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
        </View>
      ) : null}

      <Pressable onPress={() => navigation.navigate("Profile")} style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, borderRadius: 6, marginTop: 16 }}>
        <Text style={{ color: colors.text }}>Profile</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Settings")} style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, borderRadius: 6, marginTop: 10 }}>
        <Text style={{ color: colors.text }}>Settings</Text>
      </Pressable>
      <Pressable onPress={logout} style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, borderRadius: 6, marginTop: 10 }}>
        <Text style={{ color: colors.text }}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}
