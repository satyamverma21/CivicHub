import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import { ISSUE_CATEGORIES, ISSUE_STATUS, formatTimestamp, manuallyAssignIssue } from "../services/issues";
import {
  adminApproveAuthorityRequest,
  adminRejectAuthorityRequest,
  changeUserRole,
  deleteChannel,
  deleteIssueAsAdmin,
  deleteUser,
  forceChangeIssueStatus,
  generateAnalytics,
  getAllAuthorities,
  getAllChannels,
  getAllIssues,
  getAllUsers,
  getChannelDetails,
  getGlobalAuthorityRequests,
  removeAuthorityRole,
  suspendChannel,
  suspendUser,
  unsuspendUser,
  updateChannel
} from "../services/superadmin";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const TABS = ["overview", "channels", "users", "authorities", "issues", "analytics"];

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

function StatCard({ title, value, subtitle, colors, shadows }) {
  return (
    <View style={{
      width: "48%",
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: colors.mode === "dark" ? 1 : 0,
      borderColor: colors.cardBorder,
      ...(shadows?.sm || {})
    }}>
      <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "600" }}>{title}</Text>
      <Text style={{ fontWeight: "800", fontSize: 22, marginTop: 4, color: colors.primary }}>{value}</Text>
      {subtitle ? <Text style={{ color: colors.textSecondary, marginTop: 2, fontSize: 12 }}>{subtitle}</Text> : null}
    </View>
  );
}

function BarRow({ label, value, max, colors }) {
  const pct = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
        <Text style={{ fontWeight: "700", color: colors.text, fontSize: 14 }}>{value}</Text>
      </View>
      <View style={{ marginTop: 4, height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 99 }}>
        <View style={{ width: `${pct}%`, height: 6, borderRadius: 99, backgroundColor: colors.primary }} />
      </View>
    </View>
  );
}

export default function SuperAdminDashboardScreen({ navigation }) {
  const { currentUser, userRole, showErrorToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);

  const [overview, setOverview] = useState(null);
  const [channels, setChannels] = useState([]);
  const [channelDetails, setChannelDetails] = useState(null);
  const [editChannelId, setEditChannelId] = useState(null);
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelDescription, setEditChannelDescription] = useState("");

  const [users, setUsers] = useState([]);
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [authorities, setAuthorities] = useState([]);
  const [authorityFilter, setAuthorityFilter] = useState("all");

  const [issues, setIssues] = useState([]);
  const [issueSearch, setIssueSearch] = useState("");
  const [issueStatusFilter, setIssueStatusFilter] = useState("all");
  const [issueCategoryFilter, setIssueCategoryFilter] = useState("all");
  const [issueChannelFilter, setIssueChannelFilter] = useState("all");
  const [issueStartDate, setIssueStartDate] = useState("");
  const [issueEndDate, setIssueEndDate] = useState("");
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [overrideStatusByIssue, setOverrideStatusByIssue] = useState({});
  const [assignAuthorityByIssue, setAssignAuthorityByIssue] = useState({});

  const [authorityRequests, setAuthorityRequests] = useState([]);
  const [authorityOptions, setAuthorityOptions] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const debouncedUserSearch = useDebouncedValue(userSearch);
  const debouncedIssueSearch = useDebouncedValue(issueSearch);

  const hasAccess = userRole === "SuperAdmin";

  useEffect(() => {
    if (!hasAccess) {
      navigation.replace("Home");
    }
  }, [hasAccess, navigation]);

  const withConfirm = (title, message, handler) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: handler }
    ]);
  };

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      const [metrics, channelsData] = await Promise.all([generateAnalytics(start, end), getAllChannels()]);
      setOverview(metrics.overview);
      setAnalytics(metrics);
      setChannels(channelsData);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [showErrorToast]);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try { setChannels(await getAllChannels()); } catch (error) { showErrorToast(error); } finally { setLoading(false); }
  }, [showErrorToast]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, requests] = await Promise.all([
        getAllUsers({ status: userStatusFilter, search: debouncedUserSearch }),
        getGlobalAuthorityRequests()
      ]);
      setUsers(usersData);
      setAuthorityRequests(requests);
    } catch (error) { showErrorToast(error); } finally { setLoading(false); }
  }, [userStatusFilter, debouncedUserSearch, showErrorToast]);

  const loadAuthorities = useCallback(async () => {
    setLoading(true);
    try { setAuthorities(await getAllAuthorities(authorityFilter)); } catch (error) { showErrorToast(error); } finally { setLoading(false); }
  }, [authorityFilter, showErrorToast]);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const [issuesData, authorityData] = await Promise.all([
        getAllIssues({ status: issueStatusFilter, category: issueCategoryFilter, channelId: issueChannelFilter, startDate: issueStartDate || null, endDate: issueEndDate || null, search: debouncedIssueSearch, pageSize: 50 }),
        getAllAuthorities("active")
      ]);
      setIssues(issuesData.items);
      setAuthorityOptions(authorityData);
    } catch (error) { showErrorToast(error); } finally { setLoading(false); }
  }, [issueStatusFilter, issueCategoryFilter, issueChannelFilter, issueStartDate, issueEndDate, debouncedIssueSearch, showErrorToast]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      setAnalytics(await generateAnalytics(start, end));
    } catch (error) { showErrorToast(error); } finally { setLoading(false); }
  }, [showErrorToast]);

  useFocusEffect(useCallback(() => {
    if (hasAccess) { loadOverview(); }
    return undefined;
  }, [hasAccess, loadOverview]));

  useEffect(() => {
    if (!hasAccess) return;
    if (tab === "channels") loadChannels();
    if (tab === "users") loadUsers();
    if (tab === "authorities") loadAuthorities();
    if (tab === "issues") loadIssues();
    if (tab === "analytics") loadAnalytics();
  }, [tab, hasAccess, loadChannels, loadUsers, loadAuthorities, loadIssues, loadAnalytics]);

  const channelIds = useMemo(() => channels.map((item) => item.id), [channels]);
  const findRequest = useCallback(
    (userId) => authorityRequests.find((request) => request.userId === userId),
    [authorityRequests]
  );

  const maxCategory = Math.max(...(analytics?.issuesByCategory?.map((item) => item.value) || [1]));
  const maxStatus = Math.max(...(analytics?.issuesByStatus?.map((item) => item.value) || [1]));
  const maxChannel = Math.max(...(analytics?.issuesByChannel?.map((item) => item.value) || [1]));
  const maxTime = Math.max(...(analytics?.issuesOverTime?.map((item) => item.count) || [1]));

  const base = {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, color: colors.text, fontSize: 14
  };

  const renderOverview = () => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <StatCard title="Total Channels" value={overview?.totalChannels || 0} colors={colors} shadows={shadows} />
      <StatCard title="Total Users" value={overview?.totalUsers || 0} colors={colors} shadows={shadows} />
      <StatCard title="Total Issues" value={overview?.totalIssues || 0} colors={colors} shadows={shadows} />
      <StatCard title="Resolved" value={overview?.totalResolvedIssues || 0} subtitle={`${(overview?.resolutionRate || 0).toFixed(1)}%`} colors={colors} shadows={shadows} />
      <StatCard title="Authorities" value={overview?.totalAuthorities || 0} colors={colors} shadows={shadows} />
      <StatCard title="Avg Resolution" value={`${(overview?.avgResolutionTimeDays || 0).toFixed(2)} d`} colors={colors} shadows={shadows} />
    </View>
  );

  const renderChannels = () => (
    <View>
      {channels.map((channel) => (
        <View key={channel.id} style={{
          backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10,
          borderWidth: colors.mode === "dark" ? 1 : 0, borderColor: colors.cardBorder, ...(shadows?.sm || {})
        }}>
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 16 }}>{channel.name}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Head: {channel.headName || "-"} · Created: {formatTimestamp(channel.createdAt)}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Users: {channel.userCount} · Issues: {channel.issueCount} · Resolution: {(channel.resolutionRate || 0).toFixed(1)}%</Text>
          <View style={{
            alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6,
            backgroundColor: channel.status === "suspended" ? colors.dangerLight : colors.accentLight
          }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: channel.status === "suspended" ? colors.danger : colors.accent }}>{channel.status || "active"}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <Pressable onPress={async () => setChannelDetails(await getChannelDetails(channel.id))} style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>View</Text></Pressable>
            <Pressable onPress={() => { setEditChannelId(channel.id); setEditChannelName(channel.name || ""); setEditChannelDescription(channel.description || ""); }} style={{ borderWidth: 1.5, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Edit</Text></Pressable>
            <Pressable onPress={() => withConfirm("Delete Channel", `Delete ${channel.name} and all data?`, async () => { try { await deleteChannel(channel.id, currentUser.uid); await loadChannels(); setChannelDetails(null); } catch (error) { showErrorToast(error); } })} style={{ borderWidth: 1.5, borderColor: colors.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: colors.danger, fontWeight: "600", fontSize: 13 }}>Delete</Text></Pressable>
            <Pressable onPress={async () => { try { await suspendChannel(channel.id, channel.status !== "suspended", currentUser.uid); await loadChannels(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1.5, borderColor: colors.warning, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: colors.warning, fontWeight: "600", fontSize: 13 }}>{channel.status === "suspended" ? "Unsuspend" : "Suspend"}</Text></Pressable>
          </View>
        </View>
      ))}
      {editChannelId ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: colors.mode === "dark" ? 1 : 0, borderColor: colors.cardBorder, ...(shadows?.md || {}) }}>
          <Text style={{ fontWeight: "800", marginBottom: 10, color: colors.text, fontSize: 16 }}>Edit Channel</Text>
          <TextInput value={editChannelName} onChangeText={setEditChannelName} placeholder="Name" placeholderTextColor={colors.textTertiary} style={[base, { marginBottom: 8 }]} />
          <TextInput value={editChannelDescription} onChangeText={setEditChannelDescription} placeholder="Description" placeholderTextColor={colors.textTertiary} multiline style={[base, { minHeight: 80, textAlignVertical: "top" }]} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Pressable onPress={async () => { try { await updateChannel(editChannelId, { name: editChannelName, description: editChannelDescription }, currentUser.uid); setEditChannelId(null); await loadChannels(); } catch (error) { showErrorToast(error); } }} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12 }}><Text style={{ color: "#FFF", textAlign: "center", fontWeight: "700" }}>Save</Text></Pressable>
            <Pressable onPress={() => setEditChannelId(null)} style={{ flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingVertical: 12 }}><Text style={{ textAlign: "center", fontWeight: "700", color: colors.text }}>Cancel</Text></Pressable>
          </View>
        </View>
      ) : null}
      {channelDetails ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: colors.mode === "dark" ? 1 : 0, borderColor: colors.cardBorder, ...(shadows?.md || {}) }}>
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 16 }}>Channel Details: {channelDetails.channel.name}</Text>
          <Text style={{ marginTop: 10, fontWeight: "700", color: colors.text }}>Users ({channelDetails.users.length})</Text>
          {channelDetails.users.map((user) => <Text key={user.id} style={{ color: colors.textSecondary, fontSize: 13 }}>{user.name} · {user.email} · {user.role}</Text>)}
          <Text style={{ marginTop: 10, fontWeight: "700", color: colors.text }}>Issues ({channelDetails.issues.length})</Text>
          {channelDetails.issues.map((issue) => <Text key={issue.id} style={{ color: colors.textSecondary, fontSize: 13 }}>{issue.title} · {issue.status}</Text>)}
        </View>
      ) : null}
    </View>
  );

  const renderUsers = () => (
    <View>
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: colors.mode === "dark" ? 1 : 0, borderColor: colors.cardBorder, ...(shadows?.sm || {}) }}>
        <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface }}>
          <Picker selectedValue={userStatusFilter} onValueChange={setUserStatusFilter} style={{ color: colors.text }}>
            <Picker.Item label="All" value="all" /><Picker.Item label="Active" value="active" /><Picker.Item label="Suspended" value="suspended" /><Picker.Item label="Rejected" value="rejected" />
          </Picker>
        </View>
        <TextInput value={userSearch} onChangeText={setUserSearch} placeholder="Search name/email" placeholderTextColor={colors.textTertiary} style={[base, { marginTop: 8 }]} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <Pressable onPress={() => withConfirm("Suspend Users", `Suspend ${selectedUsers.length} users?`, async () => { try { for (const id of selectedUsers) { /* eslint-disable no-await-in-loop */ await suspendUser(id, "Bulk suspended", currentUser.uid); } setSelectedUsers([]); await loadUsers(); } catch (error) { showErrorToast(error); } })} style={{ flex: 1, borderWidth: 1.5, borderColor: colors.warning, borderRadius: 8, paddingVertical: 10 }}><Text style={{ textAlign: "center", fontWeight: "600", color: colors.warning, fontSize: 13 }}>Bulk Suspend</Text></Pressable>
          <Pressable onPress={() => withConfirm("Delete Users", `Delete ${selectedUsers.length} users?`, async () => { try { for (const id of selectedUsers) { /* eslint-disable no-await-in-loop */ await deleteUser(id, currentUser.uid); } setSelectedUsers([]); await loadUsers(); } catch (error) { showErrorToast(error); } })} style={{ flex: 1, borderWidth: 1.5, borderColor: colors.danger, borderRadius: 8, paddingVertical: 10 }}><Text style={{ textAlign: "center", fontWeight: "600", color: colors.danger, fontSize: 13 }}>Bulk Delete</Text></Pressable>
        </View>
      </View>
      {users.map((user) => {
        const selected = selectedUsers.includes(user.id);
        const pending = findRequest(user.id);
        return (
          <View key={user.id} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: selected ? colors.primary : (colors.mode === "dark" ? colors.cardBorder : "transparent"), ...(shadows?.sm || {}) }}>
            <Pressable onPress={() => setSelectedUsers((prev) => prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id])}>
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>{selected ? "✓ " : ""}{user.name || "Unknown"}</Text>
            </Pressable>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{user.email} · {user.role} · {user.status || "active"}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>Joined: {formatTimestamp(user.createdAt)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              <Pressable onPress={() => Alert.alert("Profile", `${user.name}\n${user.email}\n${user.role}`)} style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>View</Text></Pressable>
              {user.status === "suspended" ? (
                <Pressable onPress={async () => { try { await unsuspendUser(user.id, currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1.5, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>Unsuspend</Text></Pressable>
              ) : (
                <Pressable onPress={async () => { try { await suspendUser(user.id, "Suspended", currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1.5, borderColor: colors.warning, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.warning, fontSize: 12, fontWeight: "600" }}>Suspend</Text></Pressable>
              )}
              <Pressable onPress={() => withConfirm("Delete User", `Delete ${user.email}?`, async () => { try { await deleteUser(user.id, currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } })} style={{ borderWidth: 1.5, borderColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600" }}>Delete</Text></Pressable>
              <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 8, minWidth: 130 }}>
                <Picker selectedValue={user.role} onValueChange={async (role) => { try { await changeUserRole(user.id, role, currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } }} style={{ color: colors.text }}>
                  <Picker.Item label="User" value="User" /><Picker.Item label="Authority" value="Authority" /><Picker.Item label="Head" value="Head" />
                </Picker>
              </View>
              {pending ? (
                <>
                  <Pressable onPress={async () => { try { await adminApproveAuthorityRequest(pending.id, currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } }} style={{ backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: "#FFF", fontSize: 12, fontWeight: "600" }}>Approve</Text></Pressable>
                  <Pressable onPress={async () => { try { await adminRejectAuthorityRequest(pending.id, currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1.5, borderColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600" }}>Reject</Text></Pressable>
                </>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderAuthorities = () => (
    <View>
      <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, marginBottom: 12 }}>
        <Picker selectedValue={authorityFilter} onValueChange={setAuthorityFilter} style={{ color: colors.text }}>
          <Picker.Item label="All" value="all" /><Picker.Item label="Pending" value="pending_approval" /><Picker.Item label="Active" value="active" /><Picker.Item label="Inactive" value="inactive" />
        </Picker>
      </View>
      {authorities.map((authority) => {
        const pending = findRequest(authority.id);
        return (
          <View key={authority.id} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: colors.mode === "dark" ? 1 : 0, borderColor: colors.cardBorder, ...(shadows?.sm || {}) }}>
            <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>{authority.name}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Channel: {authority.channelId || "-"} · {authority.status || "active"}</Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
              <View><Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>{authority.issuesAssigned || 0}</Text><Text style={{ fontSize: 11, color: colors.textTertiary }}>Assigned</Text></View>
              <View><Text style={{ fontSize: 16, fontWeight: "800", color: colors.accent }}>{authority.resolvedCount || 0}</Text><Text style={{ fontSize: 11, color: colors.textTertiary }}>Resolved</Text></View>
              <View><Text style={{ fontSize: 16, fontWeight: "800", color: colors.info }}>{(authority.avgResolutionTimeDays || 0).toFixed(1)}d</Text><Text style={{ fontSize: 11, color: colors.textTertiary }}>Avg Time</Text></View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {pending ? <Pressable onPress={async () => { try { await adminApproveAuthorityRequest(pending.id, currentUser.uid); await loadAuthorities(); } catch (error) { showErrorToast(error); } }} style={{ backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: "#FFF", fontSize: 12, fontWeight: "600" }}>Approve</Text></Pressable> : null}
              <Pressable onPress={async () => { try { await removeAuthorityRole(authority.id, currentUser.uid); await loadAuthorities(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1.5, borderColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600" }}>Remove</Text></Pressable>
              <Pressable onPress={() => Alert.alert("Performance", `${authority.name}\nResolved: ${authority.resolvedCount || 0}\nAvg: ${(authority.avgResolutionTimeDays || 0).toFixed(2)} days`)} style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Report</Text></Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderIssues = () => (
    <View>
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: colors.mode === "dark" ? 1 : 0, borderColor: colors.cardBorder, ...(shadows?.sm || {}) }}>
        <TextInput value={issueSearch} onChangeText={setIssueSearch} placeholder="Global issue search" placeholderTextColor={colors.textTertiary} style={base} />
        <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, marginTop: 8, backgroundColor: colors.surface }}>
          <Picker selectedValue={issueStatusFilter} onValueChange={setIssueStatusFilter} style={{ color: colors.text }}>
            <Picker.Item label="All Statuses" value="all" />
            {ISSUE_STATUS.map((status) => <Picker.Item key={status} label={status.replace("_", " ")} value={status} />)}
          </Picker>
        </View>
        <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, marginTop: 8, backgroundColor: colors.surface }}>
          <Picker selectedValue={issueCategoryFilter} onValueChange={setIssueCategoryFilter} style={{ color: colors.text }}>
            <Picker.Item label="All Categories" value="all" />
            {ISSUE_CATEGORIES.map((category) => <Picker.Item key={category} label={category} value={category} />)}
          </Picker>
        </View>
        <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, marginTop: 8, backgroundColor: colors.surface }}>
          <Picker selectedValue={issueChannelFilter} onValueChange={setIssueChannelFilter} style={{ color: colors.text }}>
            <Picker.Item label="All Channels" value="all" />
            {channelIds.map((id) => <Picker.Item key={id} label={id} value={id} />)}
          </Picker>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TextInput value={issueStartDate} onChangeText={setIssueStartDate} placeholder="From YYYY-MM-DD" placeholderTextColor={colors.textTertiary} style={[base, { flex: 1 }]} />
          <TextInput value={issueEndDate} onChangeText={setIssueEndDate} placeholder="To YYYY-MM-DD" placeholderTextColor={colors.textTertiary} style={[base, { flex: 1 }]} />
        </View>
        <Pressable onPress={() => withConfirm("Delete Issues", `Delete ${selectedIssues.length} issues?`, async () => { try { for (const id of selectedIssues) { /* eslint-disable no-await-in-loop */ await deleteIssueAsAdmin(id, currentUser.uid); } setSelectedIssues([]); await loadIssues(); } catch (error) { showErrorToast(error); } })} style={{ marginTop: 10, borderWidth: 1.5, borderColor: colors.danger, borderRadius: 10, paddingVertical: 10 }}><Text style={{ color: colors.danger, textAlign: "center", fontWeight: "600" }}>Bulk Delete Selected</Text></Pressable>
      </View>
      {issues.map((issue) => {
        const selected = selectedIssues.includes(issue.id);
        const nextStatus = overrideStatusByIssue[issue.id] || issue.status;
        const assignedId = assignAuthorityByIssue[issue.id] || "";
        return (
          <View key={issue.id} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: selected ? colors.primary : (colors.mode === "dark" ? colors.cardBorder : "transparent"), ...(shadows?.sm || {}) }}>
            <Pressable onPress={() => setSelectedIssues((prev) => prev.includes(issue.id) ? prev.filter((id) => id !== issue.id) : [...prev, issue.id])}>
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>{selected ? "✓ " : ""}{issue.title}</Text>
            </Pressable>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Channel: {issue.channelId} · {issue.authorName}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Status: {issue.status} · {issue.category || "Other"}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{formatTimestamp(issue.createdAt)}</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
              <Pressable onPress={() => navigation.navigate("IssueDetail", { issueId: issue.id })} style={{ borderWidth: 1.5, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>View</Text></Pressable>
              <Pressable onPress={() => withConfirm("Delete", `Delete ${issue.title}?`, async () => { try { await deleteIssueAsAdmin(issue.id, currentUser.uid); await loadIssues(); } catch (error) { showErrorToast(error); } })} style={{ borderWidth: 1.5, borderColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600" }}>Delete</Text></Pressable>
            </View>
            <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, marginTop: 10, backgroundColor: colors.surface }}>
              <Picker selectedValue={nextStatus} onValueChange={(value) => setOverrideStatusByIssue((prev) => ({ ...prev, [issue.id]: value }))} style={{ color: colors.text }}>
                {ISSUE_STATUS.map((status) => <Picker.Item key={status} label={status.replace("_", " ")} value={status} />)}
              </Picker>
            </View>
            <Pressable onPress={async () => { try { await forceChangeIssueStatus(issue.id, nextStatus, "Admin override", currentUser.uid); await loadIssues(); } catch (error) { showErrorToast(error); } }} style={{ marginTop: 6, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10 }}><Text style={{ textAlign: "center", color: "#FFF", fontWeight: "600", fontSize: 13 }}>Force Status</Text></Pressable>
            <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, marginTop: 8, backgroundColor: colors.surface }}>
              <Picker selectedValue={assignedId} onValueChange={(value) => setAssignAuthorityByIssue((prev) => ({ ...prev, [issue.id]: value }))} style={{ color: colors.text }}>
                <Picker.Item label="Select authority" value="" />
                {authorityOptions.map((authority) => <Picker.Item key={authority.id} label={`${authority.name} (${authority.channelId || "-"})`} value={authority.id} />)}
              </Picker>
            </View>
            <Pressable onPress={async () => { if (!assignedId) return; try { await manuallyAssignIssue(issue.id, [assignedId], currentUser.uid); await loadIssues(); } catch (error) { showErrorToast(error); } }} style={{ marginTop: 6, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 8, paddingVertical: 10 }}><Text style={{ textAlign: "center", color: colors.primary, fontWeight: "600", fontSize: 13 }}>Assign Authority</Text></Pressable>
          </View>
        );
      })}
    </View>
  );

  const renderAnalytics = () => (
    <View>
      {[
        { title: "Issues Over Time", data: (analytics?.issuesOverTime || []).slice(-10), max: maxTime, labelKey: "date", valueKey: "count" },
        { title: "Issues by Category", data: analytics?.issuesByCategory || [], max: maxCategory, labelKey: "name", valueKey: "value" },
        { title: "Issues by Status", data: analytics?.issuesByStatus || [], max: maxStatus, labelKey: "name", valueKey: "value" },
        { title: "Issues by Channel", data: (analytics?.issuesByChannel || []).slice(0, 10), max: maxChannel, labelKey: "channelId", valueKey: "value" }
      ].map((section) => (
        <View key={section.title} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: colors.mode === "dark" ? 1 : 0, borderColor: colors.cardBorder, ...(shadows?.sm || {}) }}>
          <Text style={{ fontWeight: "800", marginBottom: 10, color: colors.text, fontSize: 16 }}>{section.title}</Text>
          {section.data.map((item) => <BarRow key={item[section.labelKey]} label={item[section.labelKey]} value={item[section.valueKey]} max={section.max} colors={colors} />)}
        </View>
      ))}
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: colors.mode === "dark" ? 1 : 0, borderColor: colors.cardBorder, ...(shadows?.sm || {}) }}>
        <Text style={{ fontWeight: "800", marginBottom: 10, color: colors.text, fontSize: 16 }}>Authority Performance</Text>
        {(analytics?.authorityPerformance || []).slice(0, 20).map((item) => (
          <View key={item.authorityId} style={{ marginBottom: 10 }}>
            <Text style={{ fontWeight: "700", color: colors.text }}>{item.name}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Resolved: {item.resolvedCount} · Avg: {(item.avgResolutionTimeDays || 0).toFixed(2)} days</Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (!hasAccess) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}><Text style={{ color: colors.textSecondary }}>Redirecting...</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {loading ? <View style={{ paddingVertical: 8 }}><ActivityIndicator color={colors.primary} /></View> : null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5, marginBottom: 14 }}>SuperAdmin</Text>
        {tab === "overview" ? renderOverview() : null}
        {tab === "channels" ? renderChannels() : null}
        {tab === "users" ? renderUsers() : null}
        {tab === "authorities" ? renderAuthorities() : null}
        {tab === "issues" ? renderIssues() : null}
        {tab === "analytics" ? renderAnalytics() : null}
      </ScrollView>
      <View style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        borderTopWidth: 1, borderColor: colors.border,
        backgroundColor: colors.surface, flexDirection: "row", paddingVertical: 10, paddingBottom: 14,
        ...(shadows?.lg || {})
      }}>
        {TABS.map((key) => (
          <Pressable key={key} onPress={() => setTab(key)} style={{ flex: 1, alignItems: "center" }}>
            <Text style={{
              textAlign: "center",
              color: tab === key ? colors.primary : colors.textTertiary,
              fontWeight: tab === key ? "700" : "500",
              fontSize: 12
            }}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
            {tab === key ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 3 }} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
