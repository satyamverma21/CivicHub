import NetInfo from "@react-native-community/netinfo";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm, API_BASE_URL } from "./api";
import { logError } from "./crashlog";
import {
  cacheComments,
  cacheFeed,
  cacheIssue,
  clearQueuedActions,
  enqueueAction,
  readCachedComments,
  readCachedFeed,
  readCachedIssue,
  readQueuedActions
} from "./offlineStore";
import { assertRateLimit, incrementRateLimit } from "./rateLimit";
import { withRetry, withTimeout } from "./retry";
import { sanitizeTextInput } from "./sanitization";

export const ISSUE_CATEGORIES = [
  "Academic",
  "Hostel",
  "Canteen",
  "Faculty",
  "Infrastructure",
  "Administration",
  "Library",
  "Transport",
  "Examination",
  "Other"
];
export const ISSUE_STATUS = ["open", "in_progress", "resolved", "closed"];

const LIKE_THROTTLE_MS = 600;
const likeLastPressedAt = new Map();

function normalizeText(value) {
  return sanitizeTextInput(value || "");
}

async function isOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state?.isConnected && state?.isInternetReachable !== false);
}

async function uploadImages(assets = []) {
  if (!assets.length) return [];

  const formData = new FormData();
  for (const asset of assets) {
    // eslint-disable-next-line no-await-in-loop
    const optimized = await manipulateAsync(asset.uri, [{ resize: { width: 1024, height: 1024 } }], {
      compress: 0.8,
      format: SaveFormat.JPEG
    });

    formData.append("images", {
      uri: optimized.uri,
      name: `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
      type: "image/jpeg"
    });
  }

  const response = await withTimeout(withRetry(() => apiPostForm("/api/upload/images", formData), { retries: 2, baseDelayMs: 600 }), 20000);
  return response.urls || [];
}

export async function createIssue(title, description, images = [], category, currentUser, channelId, options = {}) {
  if (!currentUser?.uid || !channelId) throw new Error("Missing user or channel.");
  await assertRateLimit("issue", currentUser.uid);

  if (!(await isOnline())) {
    await enqueueAction({ type: "createIssue", payload: { title, description, images, category, currentUser, channelId, options } });
    await incrementRateLimit("issue", currentUser.uid);
    return `queued-${Date.now()}`;
  }

  const imageUrls = await uploadImages(images);
  const payload = {
    title: normalizeText(title),
    description: normalizeText(description),
    images: imageUrls,
    category: category || null,
    manualAssignedAuthorities: Array.isArray(options?.manualAssignedAuthorities) ? options.manualAssignedAuthorities : []
  };

  const result = await apiPost("/api/issues", payload);
  await incrementRateLimit("issue", currentUser.uid);
  return result.issueId;
}

export async function assignAuthoritiesToIssue(issueId, category) {
  const issue = await getIssueById(issueId);
  if (!issue) throw new Error("Issue not found.");
  const authorities = await getActiveAuthorities(issue.channelId);
  const ids = authorities.map((item) => item.id);
  const result = await apiPost(`/api/issues/${issueId}/assign`, { authorityIds: ids, category });
  return result.assignedAuthorities || ids;
}

export async function manuallyAssignIssue(issueId, authorityIds) {
  const result = await apiPost(`/api/issues/${issueId}/assign`, { authorityIds });
  return result.assignedAuthorities || authorityIds;
}

export async function getActiveAuthorities(channelId) {
  const items = await apiGet(`/api/authorities/active?channelId=${encodeURIComponent(channelId || "")}`);
  return items.map((i) => ({ id: i.id || i.uid, ...i }));
}

export async function getAuthorityDashboard(authorityId, channelId) {
  return apiGet(`/api/authority/dashboard?authorityId=${encodeURIComponent(authorityId)}&channelId=${encodeURIComponent(channelId)}`);
}

export async function getIssuesFeed(channelId, pageSize = 10, lastDoc = null, sortBy = "recent", status = "all") {
  const page = Number(lastDoc?.page || 1);

  try {
    const result = await apiGet(
      `/api/issues/feed?channelId=${encodeURIComponent(channelId)}&pageSize=${pageSize}&page=${page}&sortBy=${encodeURIComponent(sortBy)}&status=${encodeURIComponent(status)}`
    );

    const items = result.items || [];
    await cacheFeed(items);

    return {
      items,
      lastVisible: result.hasMore ? { page: page + 1 } : null,
      hasMore: Boolean(result.hasMore)
    };
  } catch (error) {
    const cached = await readCachedFeed();
    return { items: cached.items || [], lastVisible: null, hasMore: false };
  }
}

export async function getIssueById(issueId) {
  try {
    const result = await apiGet(`/api/issues/${issueId}`);
    await cacheIssue(issueId, result.issue);
    return result.issue;
  } catch (error) {
    const cached = await readCachedIssue(issueId);
    return cached.issue;
  }
}

export async function likeIssue(issueId, userId) {
  if (!issueId || !userId) throw new Error("Missing issue or user.");
  const lastPressed = likeLastPressedAt.get(userId) || 0;
  if (Date.now() - lastPressed < LIKE_THROTTLE_MS) return;
  likeLastPressedAt.set(userId, Date.now());

  if (!(await isOnline())) {
    await enqueueAction({ type: "likeIssue", payload: { issueId, userId } });
    return;
  }

  await apiPost(`/api/issues/${issueId}/like`, {});
}

export async function addComment(issueId, userId, text) {
  const nextText = normalizeText(text);
  if (nextText.length < 1) throw new Error("Comment cannot be empty.");
  await assertRateLimit("comment", userId);

  if (!(await isOnline())) {
    await enqueueAction({ type: "addComment", payload: { issueId, userId, text: nextText } });
    await incrementRateLimit("comment", userId);
    return;
  }

  await apiPost(`/api/issues/${issueId}/comments`, { text: nextText });
  await incrementRateLimit("comment", userId);
}

export async function getComments(issueId) {
  try {
    const result = await apiGet(`/api/issues/${issueId}/comments`);
    await cacheComments(issueId, result.comments || []);
    return result.comments || [];
  } catch (error) {
    const cached = await readCachedComments(issueId);
    return cached.comments || [];
  }
}

export async function addProgressUpdate(issueId, authorityId, text, images = []) {
  const imageUrls = await uploadImages(images);
  await apiPost(`/api/issues/${issueId}/progress`, {
    authorityId,
    text: normalizeText(text),
    images: imageUrls
  });
}

export async function getProgressUpdates(issueId) {
  const result = await apiGet(`/api/issues/${issueId}/progress`);
  return result.updates || [];
}

export async function deleteIssue(issueId) {
  await apiDelete(`/api/issues/${issueId}`);
}

export async function updateIssueStatus(issueId, newStatus, authorityId, note = "") {
  await apiPost(`/api/issues/${issueId}/status`, {
    status: newStatus,
    authorityId,
    note: normalizeText(note)
  });
}

export async function getStatusHistory(issueId) {
  const result = await apiGet(`/api/issues/${issueId}/status-history`);
  return result.history || [];
}

export async function updateIssue(issueId, userId, { title, description, category }) {
  await apiPatch(`/api/issues/${issueId}`, {
    title: normalizeText(title),
    description: normalizeText(description),
    category,
    userId
  });
}

function containsAny(text, keywords) {
  const hay = String(text || "").toLowerCase();
  return keywords.some((keyword) => hay.includes(keyword));
}

export function generatePossibleSolutions(issue) {
  const category = String(issue?.category || "").toLowerCase();
  const text = `${issue?.title || ""} ${issue?.description || ""}`.toLowerCase();

  const byCategory = {
    academic: [
      "Review course material mismatch with current syllabus and share corrected resources with the class.",
      "Schedule a coordinator meeting with student representatives within 48 hours.",
      "Issue a timeline update for pending academic action and publish it on the student portal."
    ],
    hostel: [
      "Assign a hostel warden inspection slot and log findings with room/block details.",
      "Create a maintenance ticket with priority and completion ETA for hostel facilities.",
      "Share interim mitigation steps with affected hostel residents until full resolution."
    ],
    canteen: [
      "Conduct a hygiene and quality audit for the canteen vendor this week.",
      "Review meal pricing and serving consistency against approved college guidelines.",
      "Collect student feedback for one week and implement top recurring improvements."
    ],
    faculty: [
      "Arrange a mediated discussion between faculty coordinator and class representatives.",
      "Document concern points and convert them into an actionable follow-up checklist.",
      "Escalate unresolved conduct or teaching concerns to the HoD with evidence."
    ],
    infrastructure: [
      "Create a facilities work order with exact location, photos, and urgency level.",
      "Set a repair window and publish expected downtime to affected departments.",
      "Verify completion on-site and attach closure proof before marking resolved."
    ],
    administration: [
      "Route the complaint to the responsible office with a strict response deadline.",
      "Publish required documents/process steps clearly to avoid repeat complaints.",
      "Track this case in weekly admin review until closure confirmation."
    ],
    library: [
      "Audit the reported library service gap and assign owner-level accountability.",
      "Update issue queue visibility for students (pending, in progress, resolved).",
      "Pilot an immediate workaround while long-term correction is implemented."
    ],
    transport: [
      "Verify route timing adherence for the affected transport schedule.",
      "Coordinate with transport vendor and publish corrected pickup/drop timetable.",
      "Collect attendance impact data to prioritize route-level changes."
    ],
    examination: [
      "Validate the exam-related complaint against official exam cell records.",
      "Issue a formal clarification notice to affected students with next steps.",
      "Set and communicate a grievance resolution deadline with responsible officer."
    ]
  };

  let ideas = byCategory[category] || [];
  if (ideas.length === 0 && containsAny(text, ["hostel", "room", "mess"])) ideas = byCategory.hostel;
  if (ideas.length === 0 && containsAny(text, ["canteen", "food", "meal"])) ideas = byCategory.canteen;
  if (ideas.length === 0 && containsAny(text, ["exam", "result", "marks"])) ideas = byCategory.examination;
  if (ideas.length === 0 && containsAny(text, ["faculty", "teacher", "class"])) ideas = byCategory.faculty;
  if (ideas.length === 0) {
    ideas = [
      "Assign the complaint to the correct department owner with a defined SLA.",
      "Add a short action plan and communicate the timeline to affected students.",
      "Confirm completion with evidence and update complaint status immediately."
    ];
  }

  return ideas.slice(0, 3).map((entry, index) => ({
    id: `generated-${issue?.id || "issue"}-${index + 1}`,
    text: entry,
    source: "generated",
    applied: false,
    appliedBy: "",
    appliedAt: null
  }));
}

export async function updatePossibleSolutions(issueId, solutions, note = "") {
  const payload = {
    solutions: Array.isArray(solutions) ? solutions : [],
    note: normalizeText(note)
  };
  return apiPatch(`/api/issues/${issueId}/possible-solutions`, payload);
}

export async function generatePossibleSolutionsWithAI(issueId) {
  return apiPost(`/api/issues/${issueId}/possible-solutions/generate`, {});
}

export function formatTimestamp(value) {
  const millis = typeof value === "number" ? value : Number(value || 0);
  if (!millis) return "";
  return new Date(millis).toLocaleString();
}

export async function syncOfflineActions() {
  if (!(await isOnline())) return { synced: 0, failed: 0 };

  const queued = await readQueuedActions();
  if (queued.length === 0) return { synced: 0, failed: 0 };

  const processedIds = [];
  let failed = 0;

  for (const item of queued) {
    try {
      if (item.type === "createIssue") {
        const p = item.payload || {};
        // eslint-disable-next-line no-await-in-loop
        await createIssue(p.title, p.description, p.images || [], p.category || null, p.currentUser, p.channelId, p.options || {});
      } else if (item.type === "addComment") {
        // eslint-disable-next-line no-await-in-loop
        await addComment(item.payload.issueId, item.payload.userId, item.payload.text);
      } else if (item.type === "likeIssue") {
        // eslint-disable-next-line no-await-in-loop
        await likeIssue(item.payload.issueId, item.payload.userId);
      }
      processedIds.push(item.id);
    } catch (error) {
      failed += 1;
      await logError(error, "offline_sync");
    }
  }

  await clearQueuedActions(processedIds);
  return { synced: processedIds.length, failed };
}

export function absoluteUploadUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url}`;
}
