import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import { ISSUE_STATUS } from "./issues";

const MAX_BATCH = 450;

function timestampToMillis(value) {
  if (!value) {
    return 0;
  }
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function toTimestamp(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }
  const nextDate = new Date(value);
  if (Number.isNaN(nextDate.getTime())) {
    return null;
  }
  return Timestamp.fromDate(nextDate);
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

async function createAuditLog(action, performedBy, targetId, details = {}) {
  if (!performedBy) {
    return;
  }

  await addDoc(collection(db, "logs"), {
    action,
    performedBy,
    targetId,
    timestamp: serverTimestamp(),
    details
  });
}

async function chunkedDelete(items, buildDocRef) {
  for (let start = 0; start < items.length; start += MAX_BATCH) {
    const batch = writeBatch(db);
    const slice = items.slice(start, start + MAX_BATCH);
    slice.forEach((item) => {
      batch.delete(buildDocRef(item));
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}

function getResolvedAt(issue) {
  const history = Array.isArray(issue.statusHistory) ? issue.statusHistory : [];
  const resolvedEntry = history.find((entry) => ["resolved", "closed"].includes(entry.status));
  return resolvedEntry?.changedAt || issue.updatedAt || null;
}

function getResolutionDays(issue) {
  if (!["resolved", "closed"].includes(issue.status)) {
    return null;
  }
  const created = timestampToMillis(issue.createdAt);
  const resolved = timestampToMillis(getResolvedAt(issue));
  if (!created || !resolved || resolved < created) {
    return null;
  }
  return (resolved - created) / (1000 * 60 * 60 * 24);
}

export async function getAllChannels() {
  const [channelsSnap, usersSnap, issuesSnap] = await Promise.all([
    getDocs(collection(db, "channels")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "issues"))
  ]);

  const users = usersSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
  const issues = issuesSnap.docs.map((item) => ({ id: item.id, ...item.data() }));

  return channelsSnap.docs
    .map((item) => {
      const channel = { id: item.id, ...item.data() };
      const channelUsers = users.filter((user) => user.channelId === channel.id);
      const channelIssues = issues.filter((issue) => issue.channelId === channel.id);
      const resolved = channelIssues.filter((issue) => ["resolved", "closed"].includes(issue.status)).length;
      const resolutionRate = channelIssues.length ? (resolved / channelIssues.length) * 100 : 0;
      const head = channelUsers.find((user) => user.role === "Head");

      return {
        ...channel,
        headName: head?.name || "-",
        userCount: channelUsers.length,
        issueCount: channelIssues.length,
        resolvedCount: resolved,
        resolutionRate
      };
    })
    .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
}

export async function getChannelDetails(channelId) {
  const [channelSnap, usersSnap, issuesSnap] = await Promise.all([
    getDoc(doc(db, "channels", channelId)),
    getDocs(query(collection(db, "users"), where("channelId", "==", channelId))),
    getDocs(query(collection(db, "issues"), where("channelId", "==", channelId)))
  ]);

  if (!channelSnap.exists()) {
    throw new Error("Channel not found.");
  }

  return {
    channel: { id: channelSnap.id, ...channelSnap.data() },
    users: usersSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    issues: issuesSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
  };
}

export async function updateChannel(channelId, updates, performedBy) {
  const payload = {
    updatedAt: serverTimestamp()
  };

  if (typeof updates?.name === "string") {
    const nextName = updates.name.trim();
    if (nextName.length < 2) {
      throw new Error("Channel name must be at least 2 characters.");
    }
    payload.name = nextName;
  }

  if (typeof updates?.description === "string") {
    payload.description = updates.description.trim();
  }

  await updateDoc(doc(db, "channels", channelId), payload);
  await createAuditLog("channel_updated", performedBy, channelId, payload);
}

export async function suspendChannel(channelId, suspend, performedBy) {
  await updateDoc(doc(db, "channels", channelId), {
    status: suspend ? "suspended" : "active",
    updatedAt: serverTimestamp()
  });

  await createAuditLog(suspend ? "channel_suspended" : "channel_unsuspended", performedBy, channelId, {
    status: suspend ? "suspended" : "active"
  });
}

async function deleteIssueTree(issueId) {
  const [commentsSnap, updatesSnap, historySnap, notificationsSnap] = await Promise.all([
    getDocs(query(collection(db, "comments"), where("issueId", "==", issueId))),
    getDocs(query(collection(db, "progressUpdates"), where("issueId", "==", issueId))),
    getDocs(collection(db, "issues", issueId, "statusHistory")),
    getDocs(query(collection(db, "notifications"), where("issueId", "==", issueId)))
  ]);

  await Promise.all([
    chunkedDelete(commentsSnap.docs, (item) => doc(db, "comments", item.id)),
    chunkedDelete(updatesSnap.docs, (item) => doc(db, "progressUpdates", item.id)),
    chunkedDelete(historySnap.docs, (item) => doc(db, "issues", issueId, "statusHistory", item.id)),
    chunkedDelete(notificationsSnap.docs, (item) => doc(db, "notifications", item.id))
  ]);

  await deleteDoc(doc(db, "issues", issueId));
}

export async function deleteChannel(channelId, performedBy) {
  const [usersSnap, issuesSnap, requestsSnap] = await Promise.all([
    getDocs(query(collection(db, "users"), where("channelId", "==", channelId))),
    getDocs(query(collection(db, "issues"), where("channelId", "==", channelId))),
    getDocs(query(collection(db, "channelRequests"), where("channelId", "==", channelId)))
  ]);

  const issues = issuesSnap.docs.map((item) => ({ id: item.id, ...item.data() }));

  for (const issue of issues) {
    // eslint-disable-next-line no-await-in-loop
    await deleteIssueTree(issue.id);
  }

  await Promise.all([
    chunkedDelete(usersSnap.docs, (item) => doc(db, "users", item.id)),
    chunkedDelete(requestsSnap.docs, (item) => doc(db, "channelRequests", item.id))
  ]);

  await deleteDoc(doc(db, "channels", channelId));

  await createAuditLog("channel_deleted", performedBy, channelId, {
    deletedUsers: usersSnap.docs.length,
    deletedIssues: issues.length
  });
}

export async function getAllUsers({ status = "all", search = "" } = {}) {
  const usersSnap = await getDocs(collection(db, "users"));
  let items = usersSnap.docs.map((item) => ({ id: item.id, ...item.data() }));

  if (status !== "all") {
    items = items.filter((user) => (user.status || "active") === status);
  }

  const keyword = search.trim().toLowerCase();
  if (keyword) {
    items = items.filter((user) => {
      const hay = [user.name, user.email, user.role, user.channelId, user.status].join(" ").toLowerCase();
      return hay.includes(keyword);
    });
  }

  return items.sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
}

export async function suspendUser(userId, reason, performedBy, unsuspendAt = null) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error("User not found.");
  }

  const userData = userSnap.data();
  await updateDoc(userRef, { status: "suspended", updatedAt: serverTimestamp() });

  await setDoc(doc(db, "suspendedUsers", userId), {
    userId,
    channelId: userData.channelId || null,
    reason: (reason || "Suspended by SuperAdmin").trim(),
    suspendedBy: performedBy,
    suspendedAt: serverTimestamp(),
    unsuspendAt: toTimestamp(unsuspendAt)
  });

  await createAuditLog("user_suspended", performedBy, userId, {
    reason: (reason || "Suspended by SuperAdmin").trim()
  });
}

export async function unsuspendUser(userId, performedBy) {
  await Promise.all([
    deleteDoc(doc(db, "suspendedUsers", userId)).catch(() => null),
    updateDoc(doc(db, "users", userId), {
      status: "active",
      updatedAt: serverTimestamp()
    })
  ]);

  await createAuditLog("user_unsuspended", performedBy, userId, {});
}

export async function deleteUser(userId, performedBy) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error("User not found.");
  }

  const [issuesSnap, commentsSnap, requestsSnap, notificationsSnap] = await Promise.all([
    getDocs(query(collection(db, "issues"), where("authorId", "==", userId))),
    getDocs(query(collection(db, "comments"), where("userId", "==", userId))),
    getDocs(query(collection(db, "channelRequests"), where("userId", "==", userId))),
    getDocs(query(collection(db, "notifications"), where("userId", "==", userId)))
  ]);

  const authoredIssues = issuesSnap.docs.map((item) => ({ id: item.id, ...item.data() }));

  for (const issue of authoredIssues) {
    // eslint-disable-next-line no-await-in-loop
    await deleteIssueTree(issue.id);
  }

  await Promise.all([
    chunkedDelete(commentsSnap.docs, (item) => doc(db, "comments", item.id)),
    chunkedDelete(requestsSnap.docs, (item) => doc(db, "channelRequests", item.id)),
    chunkedDelete(notificationsSnap.docs, (item) => doc(db, "notifications", item.id))
  ]);

  await deleteDoc(doc(db, "suspendedUsers", userId)).catch(() => null);
  await deleteDoc(userRef);

  await createAuditLog("user_deleted", performedBy, userId, {
    deletedIssues: authoredIssues.length,
    deletedComments: commentsSnap.docs.length
  });
}

export async function getAllIssues(filters = {}) {
  const {
    status = "all",
    category = "all",
    channelId = "all",
    startDate = null,
    endDate = null,
    pageSize = 20,
    lastDoc = null,
    search = ""
  } = filters;

  const constraints = [orderBy("createdAt", "desc"), limit(pageSize)];
  if (status !== "all") {
    constraints.unshift(where("status", "==", status));
  }
  if (category !== "all") {
    constraints.unshift(where("category", "==", category));
  }
  if (channelId !== "all") {
    constraints.unshift(where("channelId", "==", channelId));
  }

  const startTs = toTimestamp(startDate);
  const endTs = toTimestamp(endDate);
  if (startTs) {
    constraints.unshift(where("createdAt", ">=", startTs));
  }
  if (endTs) {
    constraints.unshift(where("createdAt", "<=", endTs));
  }

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const issuesQuery = query(collection(db, "issues"), ...constraints);
  const snap = await getDocs(issuesQuery);
  let items = snap.docs.map((item) => ({ id: item.id, ...item.data() }));

  const keyword = (search || "").trim().toLowerCase();
  if (keyword) {
    items = items.filter((issue) => {
      const hay = [issue.title, issue.description, issue.authorName, issue.channelId, issue.category]
        .join(" ")
        .toLowerCase();
      return hay.includes(keyword);
    });
  }

  return {
    items,
    lastVisible: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize
  };
}

export async function forceChangeIssueStatus(issueId, newStatus, reason, performedBy) {
  if (!ISSUE_STATUS.includes(newStatus)) {
    throw new Error("Invalid status.");
  }

  const issueRef = doc(db, "issues", issueId);
  const issueSnap = await getDoc(issueRef);
  if (!issueSnap.exists()) {
    throw new Error("Issue not found.");
  }

  const issueData = issueSnap.data();
  const nextHistory = Array.isArray(issueData.statusHistory) ? [...issueData.statusHistory] : [];
  nextHistory.push({
    status: newStatus,
    changedBy: "SuperAdmin",
    changedById: performedBy,
    changedAt: Timestamp.now(),
    note: (reason || "Admin override").trim()
  });

  await updateDoc(issueRef, {
    status: newStatus,
    statusHistory: nextHistory,
    updatedAt: serverTimestamp()
  });

  await addDoc(collection(db, "issues", issueId, "statusHistory"), {
    status: newStatus,
    changedById: performedBy,
    changedByName: "SuperAdmin",
    changedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    note: (reason || "Admin override").trim()
  });

  await addDoc(collection(db, "progressUpdates"), {
    issueId,
    authorityId: performedBy,
    authorityName: "SuperAdmin",
    text: (reason || `Force changed status to ${newStatus}`).trim(),
    images: [],
    status: newStatus,
    createdAt: serverTimestamp()
  });

  await addDoc(collection(db, "notifications"), {
    userId: issueData.authorId,
    issueId,
    title: "Issue Status Updated",
    body: `SuperAdmin changed status to ${newStatus.replace("_", " ")}.`,
    type: "issue_status_changed",
    read: false,
    createdAt: serverTimestamp()
  });

  await createAuditLog("issue_status_forced", performedBy, issueId, {
    previousStatus: issueData.status,
    newStatus,
    reason: (reason || "Admin override").trim()
  });
}

export async function getAllAuthorities(status = "all") {
  const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "Authority")));
  const issuesSnap = await getDocs(collection(db, "issues"));

  const issues = issuesSnap.docs.map((item) => ({ id: item.id, ...item.data() }));

  let authorities = usersSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
  if (status !== "all") {
    authorities = authorities.filter((item) => item.status === status);
  }

  const mapped = authorities.map((authority) => {
    const assignedIssues = issues.filter((issue) =>
      Array.isArray(issue.assignedAuthorities) ? issue.assignedAuthorities.includes(authority.id) : false
    );

    const resolvedIssues = assignedIssues.filter((issue) => ["resolved", "closed"].includes(issue.status));
    const resolutionTimes = resolvedIssues
      .map((issue) => getResolutionDays(issue))
      .filter((days) => typeof days === "number");

    return {
      ...authority,
      issuesAssigned: assignedIssues.length,
      resolvedCount: resolvedIssues.length,
      avgResolutionTimeDays: average(resolutionTimes)
    };
  });

  return mapped.sort((a, b) => a.avgResolutionTimeDays - b.avgResolutionTimeDays);
}

export async function adminApproveAuthorityRequest(requestId, performedBy) {
  const requestRef = doc(db, "channelRequests", requestId);
  const snap = await getDoc(requestRef);
  if (!snap.exists()) {
    throw new Error("Request not found.");
  }

  const data = snap.data();
  await Promise.all([
    updateDoc(requestRef, {
      status: "approved",
      approvedBy: performedBy,
      approvedAt: serverTimestamp()
    }),
    updateDoc(doc(db, "users", data.userId), {
      status: "active"
    })
  ]);

  await createAuditLog("authority_request_approved", performedBy, data.userId, {
    requestId
  });
}

export async function adminRejectAuthorityRequest(requestId, performedBy) {
  const requestRef = doc(db, "channelRequests", requestId);
  const snap = await getDoc(requestRef);
  if (!snap.exists()) {
    throw new Error("Request not found.");
  }

  const data = snap.data();
  await Promise.all([
    deleteDoc(requestRef),
    updateDoc(doc(db, "users", data.userId), {
      status: "rejected",
      channelId: null
    })
  ]);

  await createAuditLog("authority_request_rejected", performedBy, data.userId, {
    requestId
  });
}

export async function generateAnalytics(startDate, endDate) {
  const startTs = toTimestamp(startDate);
  const endTs = toTimestamp(endDate);

  let issuesQuery = query(collection(db, "issues"));
  if (startTs && endTs) {
    issuesQuery = query(collection(db, "issues"), where("createdAt", ">=", startTs), where("createdAt", "<=", endTs));
  } else if (startTs) {
    issuesQuery = query(collection(db, "issues"), where("createdAt", ">=", startTs));
  } else if (endTs) {
    issuesQuery = query(collection(db, "issues"), where("createdAt", "<=", endTs));
  }

  const [channelsSnap, usersSnap, issuesSnap] = await Promise.all([
    getDocs(collection(db, "channels")),
    getDocs(collection(db, "users")),
    getDocs(issuesQuery)
  ]);

  const channels = channelsSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
  const users = usersSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
  const issues = issuesSnap.docs.map((item) => ({ id: item.id, ...item.data() }));

  const totalIssues = issues.length;
  const resolvedIssues = issues.filter((issue) => ["resolved", "closed"].includes(issue.status));
  const resolutionRate = totalIssues ? (resolvedIssues.length / totalIssues) * 100 : 0;

  const totalAuthorities = users.filter((user) => user.role === "Authority").length;

  const resolutionDays = resolvedIssues
    .map((issue) => getResolutionDays(issue))
    .filter((days) => typeof days === "number");

  const issuesByCategory = {};
  const issuesByStatus = {};
  const issuesByChannel = {};
  const issuesOverTime = {};

  issues.forEach((issue) => {
    const category = issue.category || "Other";
    issuesByCategory[category] = (issuesByCategory[category] || 0) + 1;

    const status = issue.status || "open";
    issuesByStatus[status] = (issuesByStatus[status] || 0) + 1;

    const channel = issue.channelId || "unknown";
    issuesByChannel[channel] = (issuesByChannel[channel] || 0) + 1;

    const key = new Date(timestampToMillis(issue.createdAt)).toISOString().slice(0, 10);
    if (key && key !== "1970-01-01") {
      issuesOverTime[key] = (issuesOverTime[key] || 0) + 1;
    }
  });

  const authorities = users.filter((user) => user.role === "Authority");
  const authorityPerformance = authorities
    .map((authority) => {
      const assigned = issues.filter((issue) =>
        Array.isArray(issue.assignedAuthorities) ? issue.assignedAuthorities.includes(authority.id) : false
      );
      const resolved = assigned.filter((issue) => ["resolved", "closed"].includes(issue.status));
      const times = resolved.map((issue) => getResolutionDays(issue)).filter((days) => typeof days === "number");

      return {
        authorityId: authority.id,
        name: authority.name || "Unknown",
        channelId: authority.channelId || null,
        resolvedCount: resolved.length,
        avgResolutionTimeDays: average(times)
      };
    })
    .sort((a, b) => a.avgResolutionTimeDays - b.avgResolutionTimeDays);

  return {
    overview: {
      totalChannels: channels.length,
      totalUsers: users.length,
      totalIssues,
      totalResolvedIssues: resolvedIssues.length,
      resolutionRate,
      totalAuthorities,
      avgResolutionTimeDays: average(resolutionDays)
    },
    issuesOverTime: Object.keys(issuesOverTime)
      .sort()
      .map((date) => ({ date, count: issuesOverTime[date] })),
    issuesByCategory: Object.entries(issuesByCategory).map(([name, value]) => ({ name, value })),
    issuesByStatus: Object.entries(issuesByStatus).map(([name, value]) => ({ name, value })),
    issuesByChannel: Object.entries(issuesByChannel).map(([channelId, value]) => ({ channelId, value })),
    authorityPerformance
  };
}



export async function getGlobalAuthorityRequests() {
  const snap = await getDocs(
    query(
      collection(db, "channelRequests"),
      where("requestType", "==", "authority_join"),
      where("status", "==", "pending")
    )
  );

  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt));
}

export async function changeUserRole(userId, role, performedBy) {
  const allowed = ["User", "Authority", "Head", "SuperAdmin"];
  if (!allowed.includes(role)) {
    throw new Error("Invalid role.");
  }

  await updateDoc(doc(db, "users", userId), {
    role,
    updatedAt: serverTimestamp()
  });

  await createAuditLog("user_role_changed", performedBy, userId, { role });
}

export async function removeAuthorityRole(authorityId, performedBy) {
  await updateDoc(doc(db, "users", authorityId), {
    role: "User",
    status: "inactive",
    updatedAt: serverTimestamp()
  });

  await createAuditLog("authority_removed", performedBy, authorityId, {});
}

export async function deleteIssueAsAdmin(issueId, performedBy) {
  const issueSnap = await getDoc(doc(db, "issues", issueId));
  if (!issueSnap.exists()) {
    throw new Error("Issue not found.");
  }

  await deleteIssueTree(issueId);
  await createAuditLog("issue_deleted", performedBy, issueId, {});
}
