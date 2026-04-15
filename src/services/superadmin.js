import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import { ISSUE_STATUS } from "./issues";

function toQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.set(key, String(value));
  });
  const query = qs.toString();
  return query ? `?${query}` : "";
}

export async function getAllChannels() {
  return apiGet("/api/superadmin/channels");
}

export async function getChannelDetails(channelId) {
  return apiGet(`/api/superadmin/channels/${channelId}`);
}

export async function updateChannel(channelId, updates) {
  await apiPatch(`/api/superadmin/channels/${channelId}`, updates);
}

export async function suspendChannel(channelId, suspend) {
  await apiPost(`/api/superadmin/channels/${channelId}/suspend`, { suspend });
}

export async function deleteChannel(channelId) {
  await apiDelete(`/api/superadmin/channels/${channelId}`);
}

export async function getAllUsers({ status = "all", search = "" } = {}) {
  return apiGet(`/api/superadmin/users${toQuery({ status, search })}`);
}

export async function suspendUser(userId, reason, performedBy, unsuspendAt = null) {
  await apiPost(`/api/superadmin/users/${userId}/suspend`, { reason, performedBy, unsuspendAt });
}

export async function unsuspendUser(userId, performedBy) {
  await apiPost(`/api/superadmin/users/${userId}/unsuspend`, { performedBy });
}

export async function deleteUser(userId, performedBy) {
  await apiDelete(`/api/superadmin/users/${userId}`);
}

export async function getAllIssues(filters = {}) {
  const { status = "all", category = "all", channelId = "all", search = "" } = filters;
  const result = await apiGet(`/api/superadmin/issues${toQuery({ status, category, channelId, search })}`);
  return {
    items: result.items || [],
    lastVisible: null,
    hasMore: false
  };
}

export async function forceChangeIssueStatus(issueId, newStatus, reason, performedBy) {
  if (!ISSUE_STATUS.includes(newStatus)) {
    throw new Error("Invalid status.");
  }
  await apiPost(`/api/superadmin/issues/${issueId}/status`, { status: newStatus, reason, performedBy });
}

export async function getAllAuthorities(status = "all") {
  return apiGet(`/api/superadmin/authorities${toQuery({ status })}`);
}

export async function adminApproveAuthorityRequest(requestId, performedBy) {
  await apiPost(`/api/superadmin/authority-requests/${requestId}/approve`, { performedBy });
}

export async function adminRejectAuthorityRequest(requestId, performedBy) {
  await apiPost(`/api/superadmin/authority-requests/${requestId}/reject`, { performedBy });
}

export async function generateAnalytics(startDate, endDate) {
  return apiGet(`/api/superadmin/analytics${toQuery({ startDate, endDate })}`);
}

export async function getGlobalAuthorityRequests() {
  return apiGet("/api/superadmin/authority-requests");
}

export async function changeUserRole(userId, role, performedBy) {
  await apiPatch(`/api/superadmin/users/${userId}/role`, { role, performedBy });
}

export async function removeAuthorityRole(authorityId, performedBy) {
  await apiPost(`/api/superadmin/authorities/${authorityId}/remove`, { performedBy });
}

export async function deleteIssueAsAdmin(issueId, performedBy) {
  await apiDelete(`/api/superadmin/issues/${issueId}`);
}
