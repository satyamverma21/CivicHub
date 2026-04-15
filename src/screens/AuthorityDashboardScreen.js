import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import StatusBadge from "../components/StatusBadge";
import { formatTimestamp, getAuthorityDashboard, updateIssueStatus } from "../services/issues";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const STATUS_TRANSITIONS = {
  open: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["closed"],
  closed: []
};

const TABS = [
  { key: "open", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" }
];

export default function AuthorityDashboardScreen({ navigation }) {
  const { currentUser, channelId, userRole, showErrorToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [loading, setLoading] = useState(true);
  const [groupedIssues, setGroupedIssues] = useState({ open: [], in_progress: [], resolved: [], closed: [] });
  const [activeTab, setActiveTab] = useState("open");
  const [savingIssueId, setSavingIssueId] = useState(null);

  const loadDashboard = useCallback(async () => {
    if (!currentUser?.uid || !channelId) {
      setGroupedIssues({ open: [], in_progress: [], resolved: [], closed: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getAuthorityDashboard(currentUser.uid, channelId);
      setGroupedIssues(data);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, channelId, showErrorToast]);

  useFocusEffect(
    useCallback(() => {
      if (!["Authority", "Head", "SuperAdmin"].includes(userRole)) {
        return undefined;
      }
      loadDashboard();
      return undefined;
    }, [loadDashboard, userRole])
  );

  const issues = useMemo(() => groupedIssues[activeTab] || [], [groupedIssues, activeTab]);

  const onStatusChange = async (issue, nextStatus) => {
    if (savingIssueId) {
      return;
    }
    setSavingIssueId(issue.id);
    try {
      await updateIssueStatus(issue.id, nextStatus, currentUser.uid, "");
      await loadDashboard();
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSavingIssueId(null);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Tab bar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            const count = (groupedIssues[tab.key] || []).length;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderWidth: selected ? 0 : 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Text style={{ color: selected ? "#FFFFFF" : colors.text, fontWeight: "600", fontSize: 14 }}>
                  {tab.label}
                </Text>
                {count > 0 ? (
                  <View style={{
                    backgroundColor: selected ? "rgba(255,255,255,0.25)" : colors.primaryLight,
                    borderRadius: 10,
                    paddingHorizontal: 7,
                    paddingVertical: 1,
                    minWidth: 22,
                    alignItems: "center"
                  }}>
                    <Text style={{ color: selected ? "#FFFFFF" : colors.primary, fontSize: 12, fontWeight: "700" }}>
                      {count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={issues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={{ paddingVertical: 50, alignItems: "center" }}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>📋</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "600" }}>No issues here</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 4 }}>All caught up!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const nextStatuses = STATUS_TRANSITIONS[item.status] || [];
          return (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: colors.mode === "dark" ? 1 : 0,
                borderColor: colors.cardBorder,
                ...(shadows?.md || {})
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontWeight: "700", fontSize: 16, flex: 1, paddingRight: 10, color: colors.text }}>{item.title}</Text>
                <StatusBadge status={item.status} />
              </View>

              <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
                {item.description}
              </Text>

              <Text style={{ color: colors.textTertiary, marginTop: 10, fontSize: 13 }}>
                Reporter: {item.authorName} · {formatTimestamp(item.createdAt)}
              </Text>

              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 13 }}>
                  Progress: {item.progressUpdatesCount || 0} updates
                </Text>
              </View>

              <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, marginTop: 12, backgroundColor: colors.surface }}>
                <Picker
                  enabled={nextStatuses.length > 0 && savingIssueId !== item.id}
                  selectedValue={nextStatuses[0] || item.status}
                  onValueChange={(value) => onStatusChange(item, value)}
                  style={{ color: colors.text }}
                >
                  {nextStatuses.length === 0 ? (
                    <Picker.Item label="No further transition" value={item.status} />
                  ) : (
                    nextStatuses.map((status) => (
                      <Picker.Item key={status} label={`Move to ${status.replace("_", " ")}`} value={status} />
                    ))
                  )}
                </Picker>
              </View>

              <Pressable
                onPress={() => navigation.navigate("IssueDetail", { issueId: item.id })}
                style={{
                  marginTop: 12,
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  borderRadius: 10,
                  paddingVertical: 11,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>View Details</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}
