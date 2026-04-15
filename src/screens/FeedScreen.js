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
import { ISSUE_CATEGORIES, getIssuesFeed, likeIssue, syncOfflineActions } from "../services/issues";
import { useAuth } from "../context/AuthContext";

function FeedSkeleton() {
  return (
    <View style={{ padding: 16 }}>
      {[1, 2, 3].map((item) => (
        <View
          key={item}
          style={{
            borderWidth: 1,
            borderColor: "#E1E7EE",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            backgroundColor: "#FAFBFC"
          }}
        >
          <View style={{ width: "40%", height: 12, backgroundColor: "#E9EDF2", borderRadius: 6 }} />
          <View style={{ width: "70%", height: 12, backgroundColor: "#E9EDF2", borderRadius: 6, marginTop: 8 }} />
          <View style={{ width: "100%", height: 110, backgroundColor: "#E9EDF2", borderRadius: 8, marginTop: 10 }} />
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

  const issueShareBase = useMemo(() => "https://communityapp.local/issues", []);

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
    return <FeedSkeleton />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F6F8FA" }}>
      {!netInfo.isConnected ? (
        <View style={{ backgroundColor: "#FFF1D6", padding: 10 }}>
          <Text style={{ color: "#8A4B00", textAlign: "center", fontWeight: "600" }}>
            Offline mode. Showing cached data.
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, gap: 8 }}>
        <Pressable onPress={() => setShowFilters((prev) => !prev)} style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, flex: 1 }}>
          <Text style={{ textAlign: "center", fontWeight: "600" }}>Filter / Sort</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("CreateIssue")} style={{ backgroundColor: "#0969DA", borderRadius: 8, padding: 10, flex: 1 }}>
          <Text style={{ textAlign: "center", fontWeight: "700", color: "#FFFFFF" }}>Report Issue</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search title, description, category, location"
          style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, backgroundColor: "#FFFFFF" }}
        />
      </View>

      {showFilters ? (
        <View style={{ marginHorizontal: 12, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, backgroundColor: "#FFFFFF", marginBottom: 8 }}>
          <Text style={{ paddingTop: 10, paddingHorizontal: 10, fontWeight: "700" }}>Sort</Text>
          <Picker selectedValue={sortBy} onValueChange={(val) => setSortBy(val)}>
            <Picker.Item label="Newest" value="recent" />
            <Picker.Item label="Most Liked" value="most-liked" />
            <Picker.Item label="Most Commented" value="most-commented" />
          </Picker>

          <Text style={{ paddingHorizontal: 10, fontWeight: "700" }}>Status</Text>
          <Picker selectedValue={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
            <Picker.Item label="All" value="all" />
            <Picker.Item label="Open" value="open" />
            <Picker.Item label="In Progress" value="in_progress" />
            <Picker.Item label="Resolved" value="resolved" />
            <Picker.Item label="Closed" value="closed" />
          </Picker>

          <Text style={{ paddingHorizontal: 10, fontWeight: "700" }}>Category</Text>
          <Picker selectedValue={categoryFilter} onValueChange={(val) => setCategoryFilter(val)}>
            <Picker.Item label="All" value="all" />
            {ISSUE_CATEGORIES.map((category) => <Picker.Item key={category} label={category} value={category} />)}
          </Picker>

          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 10, paddingBottom: 10 }}>
            <TextInput value={authorFilter} onChangeText={setAuthorFilter} placeholder="Author" style={{ flex: 1, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10 }} />
            <TextInput value={dateFrom} onChangeText={setDateFrom} placeholder="From YYYY-MM-DD" style={{ flex: 1, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10 }} />
            <TextInput value={dateTo} onChangeText={setDateTo} placeholder="To YYYY-MM-DD" style={{ flex: 1, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10 }} />
          </View>

          <Pressable onPress={saveFilters} style={{ marginHorizontal: 10, marginBottom: 10, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10 }}>
            <Text style={{ textAlign: "center", fontWeight: "600" }}>Save Filters</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={filteredIssues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<View style={{ paddingVertical: 50, alignItems: "center" }}><Text style={{ color: "#59636E" }}>No issues yet. Be the first to report!</Text></View>}
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            currentUserId={currentUser?.uid}
            onPress={() => navigation.navigate("IssueDetail", { issueId: item.id })}
            onLikePress={() => onLike(item.id)}
            onSharePress={() => onShare(item.id, item.title)}
          />
        )}
        ListFooterComponent={
          filteredIssues.length > 0 ? (
            <View style={{ marginVertical: 8 }}>
              {loadingMore ? <ActivityIndicator /> : null}
              {!loadingMore && hasMore ? (
                <Pressable onPress={onLoadMore} style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10 }}>
                  <Text style={{ textAlign: "center", fontWeight: "600" }}>Load More</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null
        }
      />
    </View>
  );
}
