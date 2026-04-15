import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { formatTimestamp } from "../services/issues";
import { useAuth } from "../context/AuthContext";

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
    if (processingId) {
      return;
    }

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
    if (processingId) {
      return;
    }

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
    if (processingId) {
      return;
    }

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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Head Dashboard</Text>

      <View style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 10 }}>Pending Authority Requests</Text>
        {pendingRequests.length === 0 ? <Text style={{ color: "#59636E" }}>No pending requests.</Text> : null}

        {pendingRequests.map((item) => (
          <View
            key={item.requestId}
            style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}
          >
            <Text style={{ fontWeight: "700" }}>{item.name}</Text>
            <Text style={{ color: "#2F353D" }}>{item.email}</Text>
            <Text style={{ color: "#59636E", marginTop: 4 }}>Requested: {formatTimestamp(item.createdAt)}</Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={() => onApprove(item.requestId)}
                style={{ backgroundColor: "#1A7F37", borderRadius: 8, padding: 10, flex: 1, opacity: processingId ? 0.6 : 1 }}
              >
                <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700" }}>Approve</Text>
              </Pressable>
              <Pressable
                onPress={() => onReject(item.requestId)}
                style={{ borderWidth: 1, borderColor: "#CF222E", borderRadius: 8, padding: 10, flex: 1, opacity: processingId ? 0.6 : 1 }}
              >
                <Text style={{ color: "#CF222E", textAlign: "center", fontWeight: "700" }}>Reject</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 10 }}>Active Authorities</Text>
        {activeAuthorities.length === 0 ? <Text style={{ color: "#59636E" }}>No active authorities.</Text> : null}

        {activeAuthorities.map((item) => (
          <View
            key={item.id}
            style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10, marginBottom: 10 }}
          >
            <Text style={{ fontWeight: "700" }}>{item.name}</Text>
            <Text style={{ color: "#2F353D" }}>{item.email}</Text>
            <Text style={{ marginTop: 4 }}>Issues assigned: {item.issuesAssigned || 0}</Text>
            <Text>Resolved count: {item.resolvedCount || 0}</Text>

            <Pressable
              onPress={() => onRemove(item.id)}
              style={{ marginTop: 10, borderWidth: 1, borderColor: "#CF222E", borderRadius: 8, padding: 10, opacity: processingId ? 0.6 : 1 }}
            >
              <Text style={{ color: "#CF222E", textAlign: "center", fontWeight: "700" }}>Remove Authority</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

