import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, setAuthToken, getAuthToken } from "../services/api";
import { syncOfflineActions } from "../services/issues";
import { registerForPushNotifications } from "../services/notifications";
import { useToast } from "./ToastContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { showErrorToast: showGlobalErrorToast, showSuccessToast } = useToast();
  const [currentUser, setCurrentUser] = useState(null);
  const [channelId, setChannelId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncMe = async () => {
    const token = await getAuthToken();
    if (!token) {
      setCurrentUser(null);
      setChannelId(null);
      setUserRole(null);
      return;
    }

    try {
      const { user } = await apiGet("/api/auth/me");
      setCurrentUser(user);
      setChannelId(user.channelId || null);
      setUserRole(user.role || null);
    } catch (error) {
      await setAuthToken(null);
      setCurrentUser(null);
      setChannelId(null);
      setUserRole(null);
    }
  };

  useEffect(() => {
    syncMe().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    registerForPushNotifications(currentUser.uid).catch(() => {});
    syncOfflineActions().catch(() => {});
  }, [currentUser?.uid]);

  async function signupHead({ email, password, organizationName }) {
    const { token, user } = await apiPost("/api/auth/signup-head", { email, password, organizationName });
    await setAuthToken(token);
    setCurrentUser(user);
    setChannelId(user.channelId || null);
    setUserRole(user.role || null);
  }

  async function signupUser({ email, password, fullName, role, channelIdInput }) {
    const result = await apiPost("/api/auth/signup-user", { email, password, fullName, role, channelIdInput });
    if (result.pendingApproval) {
      return { pendingApproval: true };
    }

    await setAuthToken(result.token);
    setCurrentUser(result.user);
    setChannelId(result.user.channelId || null);
    setUserRole(result.user.role || null);
    return { pendingApproval: false };
  }

  async function login(email, password) {
    const { token, user } = await apiPost("/api/auth/login", { email, password });
    await setAuthToken(token);
    setCurrentUser(user);
    setChannelId(user.channelId || null);
    setUserRole(user.role || null);
  }

  async function logout() {
    try {
      await apiPost("/api/auth/logout", {});
    } catch (error) {
      // Ignore logout failures.
    }
    await setAuthToken(null);
    setCurrentUser(null);
    setChannelId(null);
    setUserRole(null);
  }

  async function getChannelID() {
    return channelId;
  }

  async function getSuperAdminOverview() {
    const [channels, users] = await Promise.all([
      apiGet("/api/superadmin/channels"),
      apiGet("/api/superadmin/users?status=all")
    ]);
    return { channels, users };
  }

  async function superAdminUpdateUserRole(userId, nextRole) {
    await apiPatch(`/api/superadmin/users/${userId}/role`, { role: nextRole });
  }

  async function getPendingAuthorityRequests() {
    return apiGet("/api/head/pending-requests");
  }

  async function approveAuthorityRequest(requestId) {
    await apiPost(`/api/head/requests/${requestId}/approve`, {});
  }

  async function rejectAuthorityRequest(requestId) {
    await apiPost(`/api/head/requests/${requestId}/reject`, {});
  }

  async function getActiveAuthoritiesWithStats() {
    return apiGet("/api/head/authorities");
  }

  async function removeAuthority(authorityId) {
    await apiPost(`/api/head/authorities/${authorityId}/remove`, {});
  }

  async function approveAuthority(userId) {
    const pending = await getPendingAuthorityRequests();
    const request = pending.find((item) => item.userId === userId);
    if (!request) throw new Error("Pending request not found.");
    await approveAuthorityRequest(request.requestId);
  }

  async function rejectAuthority(userId) {
    const pending = await getPendingAuthorityRequests();
    const request = pending.find((item) => item.userId === userId);
    if (!request) throw new Error("Pending request not found.");
    await rejectAuthorityRequest(request.requestId);
  }

  async function updateMyProfile({ name, avatar, bio, privacy }) {
    const { user } = await apiPatch("/api/users/me", { name, avatar, bio, privacy });
    setCurrentUser(user);
  }

  async function updateNotificationSettings(settings) {
    const { user } = await apiPatch("/api/users/me/notifications", { settings });
    setCurrentUser(user);
  }

  async function deleteMyAccount() {
    await apiDelete("/api/auth/account");
    await setAuthToken(null);
    setCurrentUser(null);
    setChannelId(null);
    setUserRole(null);
  }

  async function getMyProfileStats() {
    return apiGet("/api/users/me/stats");
  }

  function showErrorToast(error) {
    showGlobalErrorToast(error);
  }

  const value = useMemo(
    () => ({
      currentUser,
      channelId,
      userRole,
      isLoading,
      signupHead,
      signupUser,
      login,
      logout,
      getChannelID,
      getSuperAdminOverview,
      superAdminUpdateUserRole,
      getPendingAuthorityRequests,
      approveAuthority,
      rejectAuthority,
      approveAuthorityRequest,
      rejectAuthorityRequest,
      getActiveAuthoritiesWithStats,
      removeAuthority,
      updateMyProfile,
      updateNotificationSettings,
      deleteMyAccount,
      getMyProfileStats,
      showErrorToast,
      showSuccessToast
    }),
    [currentUser, channelId, userRole, isLoading, showSuccessToast, showGlobalErrorToast]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
