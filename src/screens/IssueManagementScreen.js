import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import {
  formatTimestamp,
  getActiveAuthorities,
  getIssueById,
  getStatusHistory,
  manuallyAssignIssue,
  updateIssueStatus
} from "../services/issues";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { inputStyle } from "../styles";

const STATUS_TRANSITIONS = {
  open: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["closed"],
  closed: []
};

export default function IssueManagementScreen({ route }) {
  const { issueId } = route.params || {};
  const { currentUser, userRole, channelId, showErrorToast, showSuccessToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [issue, setIssue] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const [selectedAuthorities, setSelectedAuthorities] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("open");
  const [statusNote, setStatusNote] = useState("");
  const roleKey = String(userRole || currentUser?.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  const base = inputStyle(colors);

  const isAssignedAuthority = useMemo(
    () => Array.isArray(issue?.assignedAuthorities) && issue.assignedAuthorities.includes(currentUser?.uid),
    [issue, currentUser?.uid]
  );
  const canUpdateStatus = ["head", "superadmin"].includes(roleKey) || isAssignedAuthority;
  const canAssignAuthorities = ["head", "superadmin"].includes(roleKey);
  const nextAllowedStatuses = STATUS_TRANSITIONS[issue?.status] || [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [issueData, historyData] = await Promise.all([
        getIssueById(issueId),
        getStatusHistory(issueId)
      ]);
      setIssue(issueData);
      setStatusHistory(Array.isArray(historyData) ? historyData : []);
      setSelectedAuthorities(Array.isArray(issueData?.assignedAuthorities) ? issueData.assignedAuthorities : []);
      setSelectedStatus((STATUS_TRANSITIONS[issueData?.status] || [issueData?.status || "open"])[0] || issueData?.status || "open");

      if (canAssignAuthorities) {
        const authorityRows = await getActiveAuthorities(issueData?.channelId || channelId);
        setAuthorities(Array.isArray(authorityRows) ? authorityRows : []);
      } else {
        setAuthorities([]);
      }
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [issueId, canAssignAuthorities, channelId, showErrorToast]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load])
  );

  const onSaveStatus = async () => {
    if (savingStatus || !canUpdateStatus) return;
    if (nextAllowedStatuses.length === 0) {
      showErrorToast(new Error("No further status changes allowed."));
      return;
    }
    setSavingStatus(true);
    try {
      await updateIssueStatus(issueId, selectedStatus, currentUser.uid, statusNote);
      setStatusNote("");
      showSuccessToast("Status updated.");
      await load();
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSavingStatus(false);
    }
  };

  const toggleAuthority = (authorityId) => {
    setSelectedAuthorities((prev) =>
      prev.includes(authorityId) ? prev.filter((id) => id !== authorityId) : [...prev, authorityId]
    );
  };

  const onSaveAssignments = async () => {
    if (savingAssignments || !canAssignAuthorities) return;
    setSavingAssignments(true);
    try {
      await manuallyAssignIssue(issueId, selectedAuthorities);
      showSuccessToast("Assignments saved.");
      await load();
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSavingAssignments(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!issue) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "600" }}>Complaint not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.sm || {})
      }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Workflow Controls</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>
          {issue.title}
        </Text>
      </View>

      {canUpdateStatus ? (
        <View style={{
          marginTop: 12,
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: colors.mode === "dark" ? 1 : 0,
          borderColor: colors.cardBorder,
          ...(shadows?.sm || {})
        }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 10 }}>Change Status</Text>
          <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface }}>
            <Picker
              enabled={nextAllowedStatuses.length > 0}
              selectedValue={selectedStatus}
              onValueChange={(value) => setSelectedStatus(value)}
              style={{ color: colors.text }}
            >
              {nextAllowedStatuses.length === 0 ? (
                <Picker.Item label="No more transitions" value={issue.status} />
              ) : (
                nextAllowedStatuses.map((status) => (
                  <Picker.Item key={status} label={status.replace("_", " ")} value={status} />
                ))
              )}
            </Picker>
          </View>
          <TextInput
            value={statusNote}
            onChangeText={setStatusNote}
            placeholder="Optional status note"
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[base, { marginTop: 10, minHeight: 84, textAlignVertical: "top" }]}
          />
          <Pressable
            onPress={onSaveStatus}
            disabled={savingStatus || nextAllowedStatuses.length === 0}
            style={{
              marginTop: 10,
              backgroundColor: colors.accent,
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
              opacity: savingStatus || nextAllowedStatuses.length === 0 ? 0.6 : 1
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{savingStatus ? "Saving..." : "Update Status"}</Text>
          </Pressable>
        </View>
      ) : null}

      {canAssignAuthorities ? (
        <View style={{
          marginTop: 12,
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: colors.mode === "dark" ? 1 : 0,
          borderColor: colors.cardBorder,
          ...(shadows?.sm || {})
        }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 10 }}>Assign Authorities</Text>
          {authorities.length === 0 ? (
            <Text style={{ color: colors.textTertiary }}>No active authorities found.</Text>
          ) : null}
          {authorities.map((authority) => {
            const selected = selectedAuthorities.includes(authority.id);
            return (
              <Pressable
                key={authority.id}
                onPress={() => toggleAuthority(authority.id)}
                style={{
                  borderWidth: 1.2,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight : colors.surfaceAlt,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{authority.name}</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 2, fontSize: 12 }}>{authority.email}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onSaveAssignments}
            disabled={savingAssignments}
            style={{
              marginTop: 8,
              backgroundColor: colors.primary,
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
              opacity: savingAssignments ? 0.6 : 1
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{savingAssignments ? "Saving..." : "Save Assignments"}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{
        marginTop: 12,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.sm || {})
      }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 10 }}>Status History</Text>
        {statusHistory.length === 0 ? (
          <Text style={{ color: colors.textTertiary }}>No status updates yet.</Text>
        ) : statusHistory.map((entry) => (
          <View key={entry.id} style={{ marginBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingBottom: 10 }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
              {entry.status.replace("_", " ")} · {entry.changedByName}
            </Text>
            {entry.note ? <Text style={{ color: colors.textSecondary, marginTop: 2, fontSize: 13 }}>{entry.note}</Text> : null}
            <Text style={{ color: colors.textTertiary, marginTop: 2, fontSize: 12 }}>{formatTimestamp(entry.createdAt)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
