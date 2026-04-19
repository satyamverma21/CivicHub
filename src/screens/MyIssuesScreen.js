import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { formatTimestamp } from "../services/issues";

const ISSUE_TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" }
];

export default function MyIssuesScreen({ navigation }) {
  const { currentUser, userRole, getMyProfileStats, showErrorToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    if (!currentUser?.uid || userRole !== "User") {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getMyProfileStats();
      setItems(Array.isArray(data?.myIssues) ? data.myIssues : []);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, userRole, getMyProfileStats, showErrorToast]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load])
  );

  const filtered = useMemo(
    () => items.filter((issue) => activeTab === "all" || issue.status === activeTab),
    [items, activeTab]
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {ISSUE_TABS.map((tab) => {
          const selected = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor: selected ? colors.primary : colors.surface,
                borderWidth: selected ? 0 : 1,
                borderColor: colors.border
              }}
            >
              <Text style={{ color: selected ? "#FFFFFF" : colors.text, fontWeight: "600", fontSize: 13 }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 14,
            borderWidth: colors.mode === "dark" ? 1 : 0,
            borderColor: colors.cardBorder,
            ...(shadows?.sm || {})
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No issues in this tab.</Text>
        </View>
      ) : null}

      {!loading && filtered.map((issue) => (
        <Pressable
          key={issue.id}
          onPress={() => navigation.navigate("IssueDetail", { issueId: issue.id })}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            borderWidth: colors.mode === "dark" ? 1 : 0,
            borderColor: colors.cardBorder,
            ...(shadows?.sm || {})
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
            {issue.title}
          </Text>
          <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <StatusBadge status={issue.status} />
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{formatTimestamp(issue.createdAt)}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
