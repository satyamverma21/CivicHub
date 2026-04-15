import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { formatTimestamp } from "../services/issues";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function HeadDashboardScreen() {
  const {
    currentUser,
    getPendingAuthorityRequests,
    approveAuthorityRequest,
    rejectAuthorityRequest,
    getActiveAuthoritiesWithStats,
    removeAuthority,
    showErrorToast
  } = useAuth();
  const { colors, shadows } = useTheme();

  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeAuthorities, setActiveAuthorities] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, active] = await Promise.all([
        getPendingAuthorityRequests(),
        getActiveAuthoritiesWithStats()
      ]);
      setPendingRequests(pending);
      setActiveAuthorities(active);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [getPendingAuthorityRequests, getActiveAuthoritiesWithStats, showErrorToast]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
      return undefined;
    }, [loadAll])
  );

  const onApprove = async (requestId) => {
    if (processingId) return;
    setProcessingId(requestId);
    try {
      await approveAuthorityRequest(requestId, currentUser?.uid);
      await loadAll();
    } catch (error) {
      showErrorToast(error);
    } finally {
      setProcessingId(null);
    }
  };

  const onReject = async (requestId) => {
    if (processingId) return;
    setProcessingId(requestId);
    try {
      await rejectAuthorityRequest(requestId);
      await loadAll();
    } catch (error) {
      showErrorToast(error);
    } finally {
      setProcessingId(null);
    }
  };

  const onRemove = async (authorityId) => {
    if (processingId) return;
    setProcessingId(authorityId);
    try {
      await removeAuthority(authorityId);
      await loadAll();
    } catch (error) {
      showErrorToast(error);
    } finally {
      setProcessingId(null);
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
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5, marginBottom: 20 }}>
        Head Dashboard
      </Text>

      {/* Pending Requests */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Pending Requests</Text>
          {pendingRequests.length > 0 ? (
            <View style={{ backgroundColor: colors.warningLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: colors.warning, fontWeight: "700", fontSize: 12 }}>{pendingRequests.length}</Text>
            </View>
          ) : null}
        </View>

        {pendingRequests.length === 0 ? (
          <View style={{
            backgroundColor: colors.surfaceAlt,
            borderRadius: 14,
            padding: 20,
            alignItems: "center"
          }}>
            <Text style={{ color: colors.textTertiary, fontSize: 15 }}>No pending requests</Text>
          </View>
        ) : null}

        {pendingRequests.map((item) => (
          <View
            key={item.requestId}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              marginBottom: 10,
              borderWidth: colors.mode === "dark" ? 1 : 0,
              borderColor: colors.cardBorder,
              ...(shadows?.md || {})
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.text, fontSize: 16 }}>{item.name}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}>{item.email}</Text>
            <Text style={{ color: colors.textTertiary, marginTop: 6, fontSize: 12 }}>
              Requested: {formatTimestamp(item.createdAt)}
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => onApprove(item.requestId)}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 10,
                  paddingVertical: 11,
                  flex: 1,
                  alignItems: "center",
                  opacity: processingId ? 0.6 : 1
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>Approve</Text>
              </Pressable>
              <Pressable
                onPress={() => onReject(item.requestId)}
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.danger,
                  borderRadius: 10,
                  paddingVertical: 10,
                  flex: 1,
                  alignItems: "center",
                  opacity: processingId ? 0.6 : 1
                }}
              >
                <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 14 }}>Reject</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      {/* Active Authorities */}
      <View>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
          Active Authorities ({activeAuthorities.length})
        </Text>

        {activeAuthorities.length === 0 ? (
          <View style={{
            backgroundColor: colors.surfaceAlt,
            borderRadius: 14,
            padding: 20,
            alignItems: "center"
          }}>
            <Text style={{ color: colors.textTertiary, fontSize: 15 }}>No active authorities</Text>
          </View>
        ) : null}

        {activeAuthorities.map((item) => (
          <View
            key={item.id}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              marginBottom: 10,
              borderWidth: colors.mode === "dark" ? 1 : 0,
              borderColor: colors.cardBorder,
              ...(shadows?.sm || {})
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.text, fontSize: 16 }}>{item.name}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}>{item.email}</Text>

            <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.primary }}>{item.issuesAssigned || 0}</Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>Assigned</Text>
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.accent }}>{item.resolvedCount || 0}</Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>Resolved</Text>
              </View>
            </View>

            <Pressable
              onPress={() => onRemove(item.id)}
              style={{
                marginTop: 12,
                borderWidth: 1.5,
                borderColor: colors.danger,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: "center",
                opacity: processingId ? 0.6 : 1
              }}
            >
              <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 14 }}>Remove Authority</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
