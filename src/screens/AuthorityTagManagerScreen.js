import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ISSUE_CATEGORIES, getAuthorityTagAssignments, updateAuthorityTags } from "../services/issues";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function AuthorityTagManagerScreen() {
  const { channelId, userRole, showErrorToast, showSuccessToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    if (!["Head", "SuperAdmin"].includes(userRole || "")) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (userRole === "Head" && !channelId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await getAuthorityTagAssignments(channelId);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [channelId, userRole, showErrorToast]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load])
  );

  const toggleTag = async (authorityId, currentTags, nextTag) => {
    if (savingId) return;
    setSavingId(authorityId);
    try {
      const set = new Set(Array.isArray(currentTags) ? currentTags : []);
      if (set.has(nextTag)) set.delete(nextTag); else set.add(nextTag);
      const nextTags = [...set];
      await updateAuthorityTags(authorityId, nextTags);
      setItems((prev) => prev.map((row) => (
        row.id === authorityId ? { ...row, authorityTags: nextTags } : row
      )));
      showSuccessToast("Department tags updated.");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSavingId(null);
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
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      {items.length === 0 ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14 }}>
          <Text style={{ color: colors.textSecondary }}>No active authorities found.</Text>
        </View>
      ) : null}

      {items.map((authority) => {
        const selected = Array.isArray(authority.authorityTags) ? authority.authorityTags : [];
        return (
          <View
            key={authority.id}
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
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{authority.name}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{authority.email}</Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {ISSUE_CATEGORIES.map((tag) => {
                const isActive = selected.includes(tag);
                const isSaving = savingId === authority.id;
                return (
                  <Pressable
                    key={`${authority.id}-${tag}`}
                    onPress={() => toggleTag(authority.id, selected, tag)}
                    disabled={isSaving}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? colors.primaryLight : colors.surfaceAlt,
                      opacity: isSaving ? 0.6 : 1
                    }}
                  >
                    <Text style={{ color: isActive ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
