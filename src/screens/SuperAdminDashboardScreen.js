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

const TABS = ["overview", "channels", "users", "authorities", "issues", "analytics"];

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

function StatCard({ title, value, subtitle }) {
  return (
    <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, width: "48%" }}>
      <Text style={{ color: "#59636E" }}>{title}</Text>
      <Text style={{ fontWeight: "800", fontSize: 20, marginTop: 4 }}>{value}</Text>
      {subtitle ? <Text style={{ color: "#59636E", marginTop: 2 }}>{subtitle}</Text> : null}
    </View>
  );
}

function BarRow({ label, value, max }) {
  const pct = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text>{label}</Text>
        <Text style={{ fontWeight: "700" }}>{value}</Text>
      </View>
      <View style={{ marginTop: 4, height: 8, backgroundColor: "#E5E7EB", borderRadius: 99 }}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 99, backgroundColor: "#2563EB" }} />
      </View>
    </View>
  );
}

export default function SuperAdminDashboardScreen({ navigation }) {
  const { currentUser, userRole, showErrorToast } = useAuth();
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
    try {
      setChannels(await getAllChannels());
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
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
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [userStatusFilter, debouncedUserSearch, showErrorToast]);

  const loadAuthorities = useCallback(async () => {
    setLoading(true);
    try {
      setAuthorities(await getAllAuthorities(authorityFilter));
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [authorityFilter, showErrorToast]);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const [issuesData, authorityData] = await Promise.all([
        getAllIssues({
          status: issueStatusFilter,
          category: issueCategoryFilter,
          channelId: issueChannelFilter,
          startDate: issueStartDate || null,
          endDate: issueEndDate || null,
          search: debouncedIssueSearch,
          pageSize: 50
        }),
        getAllAuthorities("active")
      ]);
      setIssues(issuesData.items);
      setAuthorityOptions(authorityData);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [
    issueStatusFilter,
    issueCategoryFilter,
    issueChannelFilter,
    issueStartDate,
    issueEndDate,
    debouncedIssueSearch,
    showErrorToast
  ]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      setAnalytics(await generateAnalytics(start, end));
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [showErrorToast]);

  useFocusEffect(
    useCallback(() => {
      if (hasAccess) {
        loadOverview();
      }
      return undefined;
    }, [hasAccess, loadOverview])
  );

  useEffect(() => {
    if (!hasAccess) {
      return;
    }
    if (tab === "channels") {
      loadChannels();
    }
    if (tab === "users") {
      loadUsers();
    }
    if (tab === "authorities") {
      loadAuthorities();
    }
    if (tab === "issues") {
      loadIssues();
    }
    if (tab === "analytics") {
      loadAnalytics();
    }
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

  const renderOverview = () => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <StatCard title="Total Channels" value={overview?.totalChannels || 0} />
      <StatCard title="Total Users" value={overview?.totalUsers || 0} />
      <StatCard title="Total Issues" value={overview?.totalIssues || 0} />
      <StatCard
        title="Resolved"
        value={overview?.totalResolvedIssues || 0}
        subtitle={`${(overview?.resolutionRate || 0).toFixed(1)}%`}
      />
      <StatCard title="Authorities" value={overview?.totalAuthorities || 0} />
      <StatCard title="Avg Resolution" value={`${(overview?.avgResolutionTimeDays || 0).toFixed(2)} d`} />
    </View>
  );

  const renderChannels = () => (
    <View>
      {channels.map((channel) => (
        <View key={channel.id} style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <Text style={{ fontWeight: "800" }}>{channel.name} ({channel.id})</Text>
          <Text>Head: {channel.headName || "-"}</Text>
          <Text>Created: {formatTimestamp(channel.createdAt)}</Text>
          <Text>Users: {channel.userCount} | Issues: {channel.issueCount} | Resolution: {(channel.resolutionRate || 0).toFixed(1)}%</Text>
          <Text>Status: {channel.status || "active"}</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <Pressable onPress={async () => setChannelDetails(await getChannelDetails(channel.id))} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>View</Text></Pressable>
            <Pressable onPress={() => { setEditChannelId(channel.id); setEditChannelName(channel.name || ""); setEditChannelDescription(channel.description || ""); }} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>Edit</Text></Pressable>
            <Pressable onPress={() => withConfirm("Delete Channel", `Delete ${channel.name} and all data?`, async () => { try { await deleteChannel(channel.id, currentUser.uid); await loadChannels(); setChannelDetails(null); } catch (error) { showErrorToast(error); } })} style={{ borderWidth: 1, borderColor: "#CF222E", borderRadius: 6, padding: 8 }}><Text style={{ color: "#CF222E" }}>Delete</Text></Pressable>
            <Pressable onPress={async () => { try { await suspendChannel(channel.id, channel.status !== "suspended", currentUser.uid); await loadChannels(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>{channel.status === "suspended" ? "Unsuspend" : "Suspend"}</Text></Pressable>
          </View>
        </View>
      ))}

      {editChannelId ? (
        <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>Edit Channel</Text>
          <TextInput value={editChannelName} onChangeText={setEditChannelName} placeholder="Name" style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, backgroundColor: "#FFF" }} />
          <TextInput value={editChannelDescription} onChangeText={setEditChannelDescription} placeholder="Description" multiline style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, marginTop: 8, minHeight: 80, textAlignVertical: "top", backgroundColor: "#FFF" }} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable onPress={async () => { try { await updateChannel(editChannelId, { name: editChannelName, description: editChannelDescription }, currentUser.uid); setEditChannelId(null); await loadChannels(); } catch (error) { showErrorToast(error); } }} style={{ flex: 1, backgroundColor: "#0969DA", borderRadius: 6, padding: 8 }}><Text style={{ color: "#FFF", textAlign: "center" }}>Save</Text></Pressable>
            <Pressable onPress={() => setEditChannelId(null)} style={{ flex: 1, borderWidth: 1, borderRadius: 6, padding: 8 }}><Text style={{ textAlign: "center" }}>Cancel</Text></Pressable>
          </View>
        </View>
      ) : null}

      {channelDetails ? (
        <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10 }}>
          <Text style={{ fontWeight: "800" }}>Channel Details: {channelDetails.channel.name}</Text>
          <Text style={{ marginTop: 8, fontWeight: "700" }}>Users ({channelDetails.users.length})</Text>
          {channelDetails.users.map((user) => <Text key={user.id}>{user.name} - {user.email} - {user.role}</Text>)}
          <Text style={{ marginTop: 8, fontWeight: "700" }}>Issues ({channelDetails.issues.length})</Text>
          {channelDetails.issues.map((issue) => <Text key={issue.id}>{issue.title} - {issue.status}</Text>)}
        </View>
      ) : null}
    </View>
  );

  const renderUsers = () => (
    <View>
      <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
        <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, backgroundColor: "#FFF" }}>
          <Picker selectedValue={userStatusFilter} onValueChange={setUserStatusFilter}>
            <Picker.Item label="All" value="all" />
            <Picker.Item label="Active" value="active" />
            <Picker.Item label="Suspended" value="suspended" />
            <Picker.Item label="Rejected" value="rejected" />
          </Picker>
        </View>
        <TextInput value={userSearch} onChangeText={setUserSearch} placeholder="Search name/email" style={{ marginTop: 8, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, backgroundColor: "#FFF" }} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Pressable onPress={() => withConfirm("Suspend Users", `Suspend ${selectedUsers.length} selected users?`, async () => { try { for (const id of selectedUsers) { /* eslint-disable no-await-in-loop */ await suspendUser(id, "Bulk suspended by SuperAdmin", currentUser.uid); } setSelectedUsers([]); await loadUsers(); } catch (error) { showErrorToast(error); } })} style={{ flex: 1, borderWidth: 1, borderRadius: 6, padding: 8 }}><Text style={{ textAlign: "center" }}>Bulk Suspend</Text></Pressable>
          <Pressable onPress={() => withConfirm("Delete Users", `Delete ${selectedUsers.length} selected users?`, async () => { try { for (const id of selectedUsers) { /* eslint-disable no-await-in-loop */ await deleteUser(id, currentUser.uid); } setSelectedUsers([]); await loadUsers(); } catch (error) { showErrorToast(error); } })} style={{ flex: 1, borderWidth: 1, borderColor: "#CF222E", borderRadius: 6, padding: 8 }}><Text style={{ textAlign: "center", color: "#CF222E" }}>Bulk Delete</Text></Pressable>
        </View>
      </View>

      {users.map((user) => {
        const selected = selectedUsers.includes(user.id);
        const pending = findRequest(user.id);
        return (
          <View key={user.id} style={{ borderWidth: 1, borderColor: selected ? "#0969DA" : "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <Pressable onPress={() => setSelectedUsers((prev) => prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id])}>
              <Text style={{ fontWeight: "800" }}>{selected ? "[x]" : "[ ]"} {user.name || "Unknown"}</Text>
            </Pressable>
            <Text>{user.email}</Text>
            <Text>{user.role} | {user.channelId || "-"} | {user.status || "active"}</Text>
            <Text>Joined: {formatTimestamp(user.createdAt)}</Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <Pressable onPress={() => Alert.alert("Profile", `${user.name}\n${user.email}\n${user.role}`)} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>View</Text></Pressable>
              {user.status === "suspended" ? (
                <Pressable onPress={async () => { try { await unsuspendUser(user.id, currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>Unsuspend</Text></Pressable>
              ) : (
                <Pressable onPress={async () => { try { await suspendUser(user.id, "Suspended by SuperAdmin", currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>Suspend</Text></Pressable>
              )}
              <Pressable onPress={() => withConfirm("Delete User", `Delete ${user.email}?`, async () => { try { await deleteUser(user.id, currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } })} style={{ borderWidth: 1, borderColor: "#CF222E", borderRadius: 6, padding: 8 }}><Text style={{ color: "#CF222E" }}>Delete</Text></Pressable>
              <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 6, minWidth: 150 }}>
                <Picker selectedValue={user.role} onValueChange={async (role) => { try { await changeUserRole(user.id, role, currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } }}>
                  <Picker.Item label="User" value="User" />
                  <Picker.Item label="Authority" value="Authority" />
                  <Picker.Item label="Head" value="Head" />
                </Picker>
              </View>
              {pending ? (
                <>
                  <Pressable onPress={async () => { try { await adminApproveAuthorityRequest(pending.id, currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>Approve Request</Text></Pressable>
                  <Pressable onPress={async () => { try { await adminRejectAuthorityRequest(pending.id, currentUser.uid); await loadUsers(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>Reject Request</Text></Pressable>
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
      <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10, backgroundColor: "#FFF" }}>
        <Picker selectedValue={authorityFilter} onValueChange={setAuthorityFilter}>
          <Picker.Item label="All" value="all" />
          <Picker.Item label="Pending" value="pending_approval" />
          <Picker.Item label="Active" value="active" />
          <Picker.Item label="Inactive" value="inactive" />
        </Picker>
      </View>
      {authorities.map((authority) => {
        const pending = findRequest(authority.id);
        return (
          <View key={authority.id} style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <Text style={{ fontWeight: "800" }}>{authority.name}</Text>
            <Text>Channel: {authority.channelId || "-"}</Text>
            <Text>Status: {authority.status || "active"}</Text>
            <Text>Assigned: {authority.issuesAssigned || 0} | Resolved: {authority.resolvedCount || 0} | Avg: {(authority.avgResolutionTimeDays || 0).toFixed(2)}d</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {pending ? <Pressable onPress={async () => { try { await adminApproveAuthorityRequest(pending.id, currentUser.uid); await loadAuthorities(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>Approve Pending</Text></Pressable> : null}
              <Pressable onPress={async () => { try { await removeAuthorityRole(authority.id, currentUser.uid); await loadAuthorities(); } catch (error) { showErrorToast(error); } }} style={{ borderWidth: 1, borderColor: "#CF222E", borderRadius: 6, padding: 8 }}><Text style={{ color: "#CF222E" }}>Remove Authority</Text></Pressable>
              <Pressable onPress={() => Alert.alert("Performance", `${authority.name}\nResolved: ${authority.resolvedCount || 0}\nAvg: ${(authority.avgResolutionTimeDays || 0).toFixed(2)} days`)} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>View Report</Text></Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderIssues = () => (
    <View>
      <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
        <TextInput value={issueSearch} onChangeText={setIssueSearch} placeholder="Global issue search" style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, backgroundColor: "#FFF" }} />
        <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, marginTop: 8, backgroundColor: "#FFF" }}>
          <Picker selectedValue={issueStatusFilter} onValueChange={setIssueStatusFilter}>
            <Picker.Item label="All Statuses" value="all" />
            {ISSUE_STATUS.map((status) => <Picker.Item key={status} label={status.replace("_", " ")} value={status} />)}
          </Picker>
        </View>
        <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, marginTop: 8, backgroundColor: "#FFF" }}>
          <Picker selectedValue={issueCategoryFilter} onValueChange={setIssueCategoryFilter}>
            <Picker.Item label="All Categories" value="all" />
            {ISSUE_CATEGORIES.map((category) => <Picker.Item key={category} label={category} value={category} />)}
          </Picker>
        </View>
        <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, marginTop: 8, backgroundColor: "#FFF" }}>
          <Picker selectedValue={issueChannelFilter} onValueChange={setIssueChannelFilter}>
            <Picker.Item label="All Channels" value="all" />
            {channelIds.map((id) => <Picker.Item key={id} label={id} value={id} />)}
          </Picker>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TextInput value={issueStartDate} onChangeText={setIssueStartDate} placeholder="Start YYYY-MM-DD" style={{ flex: 1, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, backgroundColor: "#FFF" }} />
          <TextInput value={issueEndDate} onChangeText={setIssueEndDate} placeholder="End YYYY-MM-DD" style={{ flex: 1, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, backgroundColor: "#FFF" }} />
        </View>
        <Pressable onPress={() => withConfirm("Delete Issues", `Delete ${selectedIssues.length} selected issues?`, async () => { try { for (const id of selectedIssues) { /* eslint-disable no-await-in-loop */ await deleteIssueAsAdmin(id, currentUser.uid); } setSelectedIssues([]); await loadIssues(); } catch (error) { showErrorToast(error); } })} style={{ marginTop: 8, borderWidth: 1, borderColor: "#CF222E", borderRadius: 6, padding: 8 }}><Text style={{ color: "#CF222E", textAlign: "center" }}>Bulk Delete Selected</Text></Pressable>
      </View>

      {issues.map((issue) => {
        const selected = selectedIssues.includes(issue.id);
        const nextStatus = overrideStatusByIssue[issue.id] || issue.status;
        const assignedId = assignAuthorityByIssue[issue.id] || "";
        return (
          <View key={issue.id} style={{ borderWidth: 1, borderColor: selected ? "#0969DA" : "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <Pressable onPress={() => setSelectedIssues((prev) => prev.includes(issue.id) ? prev.filter((id) => id !== issue.id) : [...prev, issue.id])}>
              <Text style={{ fontWeight: "800" }}>{selected ? "[x]" : "[ ]"} {issue.title}</Text>
            </Pressable>
            <Text>Channel: {issue.channelId} | Reporter: {issue.authorName}</Text>
            <Text>Status: {issue.status} | Category: {issue.category || "Other"}</Text>
            <Text>Created: {formatTimestamp(issue.createdAt)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <Pressable onPress={() => navigation.navigate("IssueDetail", { issueId: issue.id })} style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}><Text>View</Text></Pressable>
              <Pressable onPress={() => withConfirm("Delete Issue", `Delete ${issue.title}?`, async () => { try { await deleteIssueAsAdmin(issue.id, currentUser.uid); await loadIssues(); } catch (error) { showErrorToast(error); } })} style={{ borderWidth: 1, borderColor: "#CF222E", borderRadius: 6, padding: 8 }}><Text style={{ color: "#CF222E" }}>Delete</Text></Pressable>
            </View>
            <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, marginTop: 8, backgroundColor: "#FFF" }}>
              <Picker selectedValue={nextStatus} onValueChange={(value) => setOverrideStatusByIssue((prev) => ({ ...prev, [issue.id]: value }))}>
                {ISSUE_STATUS.map((status) => <Picker.Item key={status} label={status.replace("_", " ")} value={status} />)}
              </Picker>
            </View>
            <Pressable onPress={async () => { try { await forceChangeIssueStatus(issue.id, nextStatus, "Admin override", currentUser.uid); await loadIssues(); } catch (error) { showErrorToast(error); } }} style={{ marginTop: 6, borderWidth: 1, borderRadius: 6, padding: 8 }}><Text style={{ textAlign: "center" }}>Force Status</Text></Pressable>
            <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, marginTop: 8, backgroundColor: "#FFF" }}>
              <Picker selectedValue={assignedId} onValueChange={(value) => setAssignAuthorityByIssue((prev) => ({ ...prev, [issue.id]: value }))}>
                <Picker.Item label="Select authority" value="" />
                {authorityOptions.map((authority) => <Picker.Item key={authority.id} label={`${authority.name} (${authority.channelId || "-"})`} value={authority.id} />)}
              </Picker>
            </View>
            <Pressable onPress={async () => { if (!assignedId) { return; } try { await manuallyAssignIssue(issue.id, [assignedId], currentUser.uid); await loadIssues(); } catch (error) { showErrorToast(error); } }} style={{ marginTop: 6, borderWidth: 1, borderRadius: 6, padding: 8 }}><Text style={{ textAlign: "center" }}>Assign Authority</Text></Pressable>
          </View>
        );
      })}
    </View>
  );

  const renderAnalytics = () => (
    <View>
      <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Issues Over Time</Text>
        {(analytics?.issuesOverTime || []).slice(-10).map((item) => <BarRow key={item.date} label={item.date} value={item.count} max={maxTime} />)}
      </View>
      <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Issues by Category</Text>
        {(analytics?.issuesByCategory || []).map((item) => <BarRow key={item.name} label={item.name} value={item.value} max={maxCategory} />)}
      </View>
      <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Issues by Status</Text>
        {(analytics?.issuesByStatus || []).map((item) => <BarRow key={item.name} label={item.name} value={item.value} max={maxStatus} />)}
      </View>
      <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Issues by Channel</Text>
        {(analytics?.issuesByChannel || []).slice(0, 10).map((item) => <BarRow key={item.channelId} label={item.channelId} value={item.value} max={maxChannel} />)}
      </View>
      <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10 }}>
        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Authority Performance</Text>
        {(analytics?.authorityPerformance || []).slice(0, 20).map((item) => (
          <View key={item.authorityId} style={{ marginBottom: 8 }}>
            <Text style={{ fontWeight: "700" }}>{item.name}</Text>
            <Text>Resolved: {item.resolvedCount} | Avg: {(item.avgResolutionTimeDays || 0).toFixed(2)} days</Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (!hasAccess) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text>Redirecting...</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F6F8FA" }}>
      {loading ? <View style={{ paddingVertical: 8 }}><ActivityIndicator /></View> : null}
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 90 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 10 }}>SuperAdmin Dashboard</Text>
        {tab === "overview" ? renderOverview() : null}
        {tab === "channels" ? renderChannels() : null}
        {tab === "users" ? renderUsers() : null}
        {tab === "authorities" ? renderAuthorities() : null}
        {tab === "issues" ? renderIssues() : null}
        {tab === "analytics" ? renderAnalytics() : null}
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderColor: "#D0D7DE", backgroundColor: "#FFF", flexDirection: "row", paddingVertical: 8 }}>
        {TABS.map((key) => (
          <Pressable key={key} onPress={() => setTab(key)} style={{ flex: 1 }}>
            <Text style={{ textAlign: "center", color: tab === key ? "#0969DA" : "#6B7280", fontWeight: tab === key ? "700" : "500" }}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
