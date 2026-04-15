import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebase";

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
    const snap = await getDocs(
      query(collection(db, "notifications"), where("userId", "==", currentUser.uid), where("read", "==", false))
    );
    setUnreadNotifications(snap.size);
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
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={{ fontSize: 24, marginBottom: 8 }}>Home</Text>
      <Text>Email: {currentUser?.email || "-"}</Text>
      <Text>Role: {userRole || "-"}</Text>
      <Text style={{ marginTop: 4 }}>Channel ID: {channelId || "Not assigned"}</Text>
      <Text style={{ marginTop: 4 }}>Notifications: {unreadNotifications}</Text>

      {channelId ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          <Pressable onPress={() => navigation.navigate("Feed")} style={{ borderWidth: 1, padding: 10, borderRadius: 6 }}>
            <Text>Open Feed</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("CreateIssue")} style={{ borderWidth: 1, padding: 10, borderRadius: 6 }}>
            <Text>Quick Create Issue</Text>
          </Pressable>
        </View>
      ) : null}

      {["Authority", "Head", "SuperAdmin"].includes(userRole) ? (
        <Pressable
          onPress={() => navigation.navigate("AuthorityDashboard")}
          style={{ borderWidth: 1, padding: 10, borderRadius: 6, marginTop: 10 }}
        >
          <Text>Open Authority Dashboard</Text>
        </Pressable>
      ) : null}

      {userRole === "Head" ? (
        <Pressable
          onPress={() => navigation.navigate("HeadDashboard")}
          style={{ borderWidth: 1, padding: 10, borderRadius: 6, marginTop: 10 }}
        >
          <Text>Open Head Dashboard</Text>
        </Pressable>
      ) : null}

      {userRole === "SuperAdmin" ? (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 18, marginBottom: 10 }}>SuperAdmin Panel</Text>
          <Pressable
            onPress={() => navigation.navigate("SuperAdminDashboard")}
            style={{ borderWidth: 1, padding: 10, borderRadius: 6, marginBottom: 10 }}
          >
            <Text>Open SuperAdmin Dashboard</Text>
          </Pressable>
          {loadingAdminData ? <Text>Loading channels and users...</Text> : null}
          {!loadingAdminData ? <Text>Channels: {adminChannels.length}</Text> : null}
          {!loadingAdminData ? <Text>Users: {adminUsers.length}</Text> : null}

          {!loadingAdminData &&
            adminUsers.map((item) => (
              <View
                key={item.id}
                style={{ borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 10 }}
              >
                <Text>{item.email}</Text>
                <Text>Current Role: {item.role}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {["Head", "User", "Authority"].map((role) => (
                    <Pressable
                      key={role}
                      onPress={() => onRoleChange(item.id, role)}
                      style={{ borderWidth: 1, padding: 8, borderRadius: 6 }}
                    >
                      <Text>Set {role}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
        </View>
      ) : null}

      <Pressable onPress={() => navigation.navigate("Profile")} style={{ borderWidth: 1, padding: 10, borderRadius: 6, marginTop: 16 }}>
        <Text>Profile</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Settings")} style={{ borderWidth: 1, padding: 10, borderRadius: 6, marginTop: 10 }}>
        <Text>Settings</Text>
      </Pressable>
      <Pressable onPress={logout} style={{ borderWidth: 1, padding: 10, borderRadius: 6, marginTop: 10 }}>
        <Text>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}
