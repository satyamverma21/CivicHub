import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import StatusBadge from "../components/StatusBadge";
import { formatTimestamp, getAuthorityDashboard, updateIssueStatus } from "../services/issues";
import { useAuth } from "../context/AuthContext";

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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F6F8FA" }}>
      <View style={{ padding: 12, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? "#0969DA" : "#D0D7DE",
                backgroundColor: selected ? "#E7F3FF" : "#FFFFFF"
              }}
            >
              <Text style={{ color: selected ? "#0969DA" : "#2F353D", fontWeight: "700" }}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={issues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <Text style={{ color: "#59636E" }}>No issues in this status.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const nextStatuses = STATUS_TRANSITIONS[item.status] || [];
          return (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "#D8DEE4",
                borderRadius: 12,
                padding: 12,
                marginBottom: 12
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontWeight: "800", fontSize: 16, flex: 1, paddingRight: 8 }}>{item.title}</Text>
                <StatusBadge status={item.status} />
              </View>

              <Text style={{ color: "#2F353D", marginTop: 6 }} numberOfLines={2}>
                {item.description}
              </Text>

              <Text style={{ color: "#59636E", marginTop: 8 }}>
                Reporter: {item.authorName} • {formatTimestamp(item.createdAt)}
              </Text>

              <Text style={{ color: "#2F353D", marginTop: 6, fontWeight: "600" }}>
                Progress updates: {item.progressUpdatesCount || 0}
              </Text>

              <View style={{ marginTop: 10, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8 }}>
                <Picker
                  enabled={nextStatuses.length > 0 && savingIssueId !== item.id}
                  selectedValue={nextStatuses[0] || item.status}
                  onValueChange={(value) => onStatusChange(item, value)}
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
                style={{ marginTop: 10, borderWidth: 1, borderColor: "#0969DA", borderRadius: 8, padding: 10 }}
              >
                <Text style={{ color: "#0969DA", textAlign: "center", fontWeight: "700" }}>View Details</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

