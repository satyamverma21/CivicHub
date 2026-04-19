import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  Text,
  TextInput,
  View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import { useNetInfo } from "@react-native-community/netinfo";
import IssueCard from "../components/IssueCard";
import {
  ISSUE_CATEGORIES,
  getIssuesFeed,
  likeIssue,
  syncOfflineActions
} from "../services/issues";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function FeedSkeleton({ colors }) {
  return (
    <View style={{ padding: 16 }}>
      {[1, 2, 3].map((item) => (
        <View
          key={item}
          style={{
            borderRadius: 16,
            padding: 16,
            marginBottom: 14,
            backgroundColor: colors.surface
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, backgroundColor: colors.skeleton, borderRadius: 20 }} />
            <View style={{ flex: 1 }}>
              <View style={{ width: "50%", height: 12, backgroundColor: colors.skeleton, borderRadius: 6 }} />
              <View style={{ width: "30%", height: 10, backgroundColor: colors.skeleton, borderRadius: 6, marginTop: 6 }} />
            </View>
          </View>
          <View style={{ width: "80%", height: 14, backgroundColor: colors.skeleton, borderRadius: 6 }} />
          <View style={{ width: "100%", height: 10, backgroundColor: colors.skeleton, borderRadius: 6, marginTop: 8 }} />
          <View style={{ width: "100%", height: 120, backgroundColor: colors.skeleton, borderRadius: 12, marginTop: 12 }} />
        </View>
      ))}
    </View>
  );
}

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const SAVED_FILTER_KEY = "feed_saved_filters_v1";

export default function FeedScreen({ navigation }) {
  const { currentUser, channelId, showErrorToast } = useAuth();
  const { colors, shadows } = useTheme();
  const netInfo = useNetInfo();
  const [issues, setIssues] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const debouncedSearch = useDebouncedValue(searchText, 300);
  const issueShareBase = useMemo(() => "https://college-complaints.local/complaints", []);

  const loadSavedFilters = useCallback(async () => {
    const raw = await AsyncStorage.getItem(SAVED_FILTER_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    setSortBy(parsed.sortBy || "recent");
    setStatusFilter(parsed.statusFilter || "all");
    setCategoryFilter(parsed.categoryFilter || "all");
    setAuthorFilter(parsed.authorFilter || "");
    setDateFrom(parsed.dateFrom || "");
    setDateTo(parsed.dateTo || "");
  }, []);

  const saveFilters = useCallback(async () => {
    await AsyncStorage.setItem(
      SAVED_FILTER_KEY,
      JSON.stringify({ sortBy, statusFilter, categoryFilter, authorFilter, dateFrom, dateTo })
    );
  }, [sortBy, statusFilter, categoryFilter, authorFilter, dateFrom, dateTo]);

  const loadFeed = useCallback(
    async ({ refresh = false, reset = false } = {}) => {
      if (!channelId) {
        setIssues([]);
        setLoading(false);
        return;
      }

      if (reset) {
        setLoading(true);
      }

      try {
        const result = await getIssuesFeed(channelId, 10, refresh || reset ? null : lastDoc, "recent", statusFilter);

        if (refresh || reset) {
          setIssues(result.items);
        } else {
          setIssues((prev) => [...prev, ...result.items]);
        }
        setLastDoc(result.lastVisible);
        setHasMore(result.hasMore);
      } catch (error) {
        showErrorToast(error);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [channelId, lastDoc, showErrorToast, statusFilter]
  );

  useFocusEffect(
    useCallback(() => {
      loadSavedFilters().catch(() => {});
      loadFeed({ reset: true });
    }, [loadFeed, loadSavedFilters])
  );

  React.useEffect(() => {
    if (netInfo.isConnected) {
      syncOfflineActions().catch(() => {});
    }
  }, [netInfo.isConnected]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed({ refresh: true });
  };

  const onLoadMore = () => {
    if (!hasMore || loadingMore || loading) {
      return;
    }
    setLoadingMore(true);
    loadFeed();
  };

  const onLike = async (issueId) => {
    try {
      await likeIssue(issueId, currentUser.uid);
      await loadFeed({ refresh: true });
    } catch (error) {
      showErrorToast(error);
    }
  };

  const onShare = async (issueId, title) => {
    try {
      await Share.share({ message: `${title}\n${issueShareBase}/${issueId}` });
    } catch (error) {
      console.log("Share failed", error?.message);
    }
  };

  const filteredIssues = useMemo(() => {
    let items = [...issues];

    if (debouncedSearch) {
      const needle = debouncedSearch.toLowerCase();
      items = items.filter((item) =>
        [item.title, item.description, item.category, item.location, item.authorName].join(" ").toLowerCase().includes(needle)
      );
    }

    if (categoryFilter !== "all") {
      items = items.filter((item) => (item.category || "Other") === categoryFilter);
    }

    if (authorFilter.trim()) {
      const authorNeedle = authorFilter.trim().toLowerCase();
      items = items.filter((item) => (item.authorName || "").toLowerCase().includes(authorNeedle));
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      if (!Number.isNaN(from)) {
        items = items.filter((item) => {
          const t = item.createdAt?.toMillis?.() || new Date(item.createdAt || 0).getTime();
          return t >= from;
        });
      }
    }

    if (dateTo) {
      const to = new Date(dateTo).getTime();
      if (!Number.isNaN(to)) {
        items = items.filter((item) => {
          const t = item.createdAt?.toMillis?.() || new Date(item.createdAt || 0).getTime();
          return t <= to;
        });
      }
    }

    if (sortBy === "most-liked") {
      items.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    } else if (sortBy === "most-commented") {
      items.sort((a, b) => (b.commentsCount || 0) - (a.commentsCount || 0));
    } else {
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    }

    return items;
  }, [issues, debouncedSearch, categoryFilter, authorFilter, dateFrom, dateTo, sortBy]);

  if (loading) {
    return <FeedSkeleton colors={colors} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!netInfo.isConnected ? (
        <View style={{ backgroundColor: colors.warningLight, paddingVertical: 10, paddingHorizontal: 16 }}>
          <Text style={{ color: colors.warningText, textAlign: "center", fontWeight: "600", fontSize: 13 }}>
            Offline mode: showing cached complaints
          </Text>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 }}>
        <View style={{
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: colors.border,
          alignItems: "center",
          paddingHorizontal: 14
        }}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search complaints..."
            placeholderTextColor={colors.textTertiary}
            style={{
              flex: 1,
              paddingVertical: 12,
              fontSize: 15,
              color: colors.text
            }}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => setShowFilters((prev) => !prev)}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 12,
              backgroundColor: showFilters ? colors.primaryLight : colors.surface,
              borderWidth: 1.5,
              borderColor: showFilters ? colors.primary : colors.border,
              alignItems: "center"
            }}
          >
            <Text style={{ fontWeight: "600", color: showFilters ? colors.primary : colors.text, fontSize: 14 }}>
              {showFilters ? "Hide Filters" : "Filter and Sort"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("CreateIssue")}
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center"
            }}
          >
            <Text style={{ fontWeight: "700", color: "#FFFFFF", fontSize: 14 }}>+ File Complaint</Text>
          </Pressable>
        </View>
      </View>

      {showFilters ? (
        <View style={{
          marginHorizontal: 16,
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 8,
          borderWidth: colors.mode === "dark" ? 1 : 0,
          borderColor: colors.cardBorder,
          ...(shadows?.md || {})
        }}>
          <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 6, fontSize: 14 }}>Sort By</Text>
          <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, marginBottom: 10 }}>
            <Picker selectedValue={sortBy} onValueChange={(val) => setSortBy(val)} style={{ color: colors.text }}>
              <Picker.Item label="Newest" value="recent" />
              <Picker.Item label="Most Liked" value="most-liked" />
              <Picker.Item label="Most Commented" value="most-commented" />
            </Picker>
          </View>

          <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 6, fontSize: 14 }}>Status</Text>
          <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, marginBottom: 10 }}>
            <Picker selectedValue={statusFilter} onValueChange={(val) => setStatusFilter(val)} style={{ color: colors.text }}>
              <Picker.Item label="All" value="all" />
              <Picker.Item label="Open" value="open" />
              <Picker.Item label="In Progress" value="in_progress" />
              <Picker.Item label="Resolved" value="resolved" />
              <Picker.Item label="Closed" value="closed" />
            </Picker>
          </View>

          <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 6, fontSize: 14 }}>Department</Text>
          <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, marginBottom: 10 }}>
            <Picker selectedValue={categoryFilter} onValueChange={(val) => setCategoryFilter(val)} style={{ color: colors.text }}>
              <Picker.Item label="All" value="all" />
              {ISSUE_CATEGORIES.map((category) => <Picker.Item key={category} label={category} value={category} />)}
            </Picker>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <TextInput
              value={authorFilter} onChangeText={setAuthorFilter} placeholder="Student name"
              placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.text, backgroundColor: colors.surface, fontSize: 14 }}
            />
            <TextInput
              value={dateFrom} onChangeText={setDateFrom} placeholder="From YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.text, backgroundColor: colors.surface, fontSize: 14 }}
            />
            <TextInput
              value={dateTo} onChangeText={setDateTo} placeholder="To YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.text, backgroundColor: colors.surface, fontSize: 14 }}
            />
          </View>

          <Pressable
            onPress={saveFilters}
            style={{ backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingVertical: 11 }}
          >
            <Text style={{ textAlign: "center", fontWeight: "600", color: colors.primary, fontSize: 14 }}>Save Filters</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={filteredIssues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "600" }}>No complaints yet</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 4 }}>Be the first to file one.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            <IssueCard
              issue={item}
              currentUserId={currentUser?.uid}
              onPress={() => navigation.navigate("IssueDetail", { issueId: item.id })}
              onLikePress={() => onLike(item.id)}
              onSharePress={() => onShare(item.id, item.title)}
            />
          </View>
        )}
        ListFooterComponent={
          filteredIssues.length > 0 ? (
            <View style={{ marginVertical: 8 }}>
              {loadingMore ? <ActivityIndicator color={colors.primary} /> : null}
              {!loadingMore && hasMore ? (
                <Pressable
                  onPress={onLoadMore}
                  style={{
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    borderRadius: 12,
                    paddingVertical: 12,
                    backgroundColor: colors.surface
                  }}
                >
                  <Text style={{ textAlign: "center", fontWeight: "600", color: colors.primary, fontSize: 14 }}>Load More</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null
        }
      />
    </View>
  );
}
