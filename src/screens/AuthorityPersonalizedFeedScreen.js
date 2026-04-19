import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import StatusBadge from "../components/StatusBadge";
import { getAuthorityPersonalizedFeed, formatTimestamp } from "../services/issues";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" }
];

export default function AuthorityPersonalizedFeedScreen({ navigation }) {
  const { channelId, showErrorToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [authorityTags, setAuthorityTags] = useState([]);

  const load = useCallback(async (nextStatus = status) => {
    if (!channelId) {
      setItems([]);
      setAuthorityTags([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getAuthorityPersonalizedFeed(channelId, nextStatus);
      setItems(Array.isArray(result?.items) ? result.items : []);
      setAuthorityTags(Array.isArray(result?.authorityTags) ? result.authorityTags : []);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [channelId, status, showErrorToast]);

  useFocusEffect(
    useCallback(() => {
      load(status);
      return undefined;
    }, [load, status])
  );

  const summaryText = useMemo(() => {
    if (!authorityTags.length) return "You will receive issues directly assigned to you and all 'Other' issues.";
    return `Tagged departments: ${authorityTags.join(", ")} + all 'Other' issues.`;
  }, [authorityTags]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{summaryText}</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {STATUS_TABS.map((tab) => {
          const selected = status === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setStatus(tab.key);
                load(tab.key);
              }}
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

      {!loading && items.length === 0 ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No issues found for this feed.</Text>
        </View>
      ) : null}

      {!loading && items.map((issue) => (
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
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>{issue.title}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }} numberOfLines={2}>{issue.description}</Text>
          <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <StatusBadge status={issue.status} />
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{formatTimestamp(issue.createdAt)}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
