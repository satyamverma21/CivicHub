import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import NetInfo from "@react-native-community/netinfo";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";
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
  "Pothole",
  "Water",
  "Electricity",
  "Roads",
  "Waste",
  "Health",
  "Other"
];

export const ISSUE_STATUS = ["open", "in_progress", "resolved", "closed"];

const STATUS_TRANSITIONS = {
  open: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["closed"],
  closed: []
};

const CATEGORY_KEYWORDS = {
  pothole: ["pothole", "road", "roads", "street"],
  water: ["water", "leak", "supply", "drain"],
  electricity: ["electricity", "power", "transformer", "wire"],
  roads: ["road", "roads", "traffic", "bridge"],
  waste: ["waste", "garbage", "trash", "sanitation"],
  health: ["health", "hospital", "clinic", "medical"],
  other: []
};
const LIKE_THROTTLE_MS = 600;
const likeLastPressedAt = new Map();

function normalizeText(value) {
  return sanitizeTextInput(value || "");
}

async function isOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state?.isConnected && state?.isInternetReachable !== false);
}

function timestampToMillis(value) {
  if (!value) {
    return 0;
  }
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }
  return date.getTime();
}

function toStatusLabel(status) {
  return (status || "").replace("_", " ");
}

async function ensureValidImage(asset) {
  const name = asset?.fileName || "image.jpg";
  const size = Number(asset?.fileSize || 0);
  if (size > 5 * 1024 * 1024) {
    throw new Error(`${name} exceeds 5MB.`);
  }
}

function validateIssueInput(title, description, category, images) {
  const nextTitle = normalizeText(title);
  const nextDescription = normalizeText(description);

  if (nextTitle.length < 5 || nextTitle.length > 100) {
    throw new Error("Title must be 5-100 characters.");
  }
  if (nextDescription.length < 10 || nextDescription.length > 5000) {
    throw new Error("Description must be 10-5000 characters.");
  }
  if (images.length > 3) {
    throw new Error("You can upload at most 3 images.");
  }
  if (category && !ISSUE_CATEGORIES.includes(category)) {
    throw new Error("Invalid category selected.");
  }

  return { nextTitle, nextDescription };
}

function validateProgressText(text) {
  const nextText = normalizeText(text);
  if (nextText.length < 10 || nextText.length > 2000) {
    throw new Error("Progress update text must be 10-2000 characters.");
  }
  return nextText;
}

async function uploadIssueImages(issueId, images, folder = "images", maxCount = 3) {
  if (images.length > maxCount) {
    throw new Error(`You can upload at most ${maxCount} images.`);
  }

  const uploadTasks = images.map(async (asset, index) => {
    await ensureValidImage(asset);

    const optimized = await manipulateAsync(
      asset.uri,
      [{ resize: { width: 1024, height: 1024 } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );

    const blob = await withTimeout(
      withRetry(async () => {
        const response = await fetch(optimized.uri);
        return response.blob();
      }, { retries: 2, baseDelayMs: 400 }),
      15000
    );

    const imageRef = ref(storage, `issues/${issueId}/${folder}/${Date.now()}-${index}.jpg`);
    await withTimeout(
      withRetry(
        () => uploadBytes(imageRef, blob, { contentType: "image/jpeg" }),
        { retries: 2, baseDelayMs: 600 }
      ),
      20000
    );

    return getDownloadURL(imageRef);
  });

  return Promise.all(uploadTasks);
}

async function getUserProfile(userId) {
  const userSnap = await getDoc(doc(db, "users", userId));
  if (!userSnap.exists()) {
    throw new Error("User not found.");
  }

  const user = userSnap.data();
  return {
    id: userId,
    name: user.name || "Unknown",
    email: user.email || "",
    avatar: user.avatar || "",
    role: user.role || "User",
    channelId: user.channelId || null,
    status: user.status || "active"
  };
}

async function createNotification(userId, issueId, title, body, type, meta = {}) {
  if (!userId) {
    return;
  }

  await addDoc(collection(db, "notifications"), {
    userId,
    issueId,
    title,
    body,
    type,
    screen: issueId ? "IssueDetail" : "Home",
    read: false,
    createdAt: serverTimestamp(),
    ...meta
  });
}

function canActorManageIssue(actor, issueData) {
  if (actor.role === "SuperAdmin") {
    return true;
  }
  if (!["Authority", "Head"].includes(actor.role)) {
    return false;
  }
  if (!actor.channelId || actor.channelId !== issueData.channelId) {
    return false;
  }
  if (actor.role === "Head") {
    return true;
  }

  const assignedAuthorities = Array.isArray(issueData.assignedAuthorities)
    ? issueData.assignedAuthorities
    : [];
  return assignedAuthorities.includes(actor.id);
}

function validateStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    throw new Error("Issue is already in the selected status.");
  }

  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Invalid transition: ${currentStatus} -> ${nextStatus}`);
  }
}

function buildHistoryEntry(status, actorName, actorId, note = "") {
  return {
    status,
    changedBy: actorName || "Unknown",
    changedById: actorId,
    changedAt: Timestamp.now(),
    note: normalizeText(note)
  };
}

async function findAuthorityMatches(channelId, category) {
  if (!channelId) {
    return [];
  }

  const authoritiesQuery = query(
    collection(db, "users"),
    where("channelId", "==", channelId),
    where("role", "==", "Authority"),
    where("status", "==", "active")
  );
  const authoritiesSnap = await getDocs(authoritiesQuery);
  const authorities = authoritiesSnap.docs.map((item) => ({ id: item.id, ...item.data() }));

  if (authorities.length === 0) {
    return [];
  }

  if (!category) {
    return authorities.map((authority) => authority.id);
  }

  const keywords = CATEGORY_KEYWORDS[category.toLowerCase()] || [];
  const matched = authorities
    .filter((authority) => {
      const haystack = [
        authority.name,
        authority.email,
        authority.department,
        Array.isArray(authority.categories) ? authority.categories.join(" ") : "",
        authority.expertise
      ]
        .join(" ")
        .toLowerCase();

      return keywords.some((keyword) => haystack.includes(keyword));
    })
    .map((authority) => authority.id);

  return matched.length > 0 ? matched : authorities.map((authority) => authority.id);
}

async function notifyAuthoritiesAssigned(issueId, authorityIds, issueTitle) {
  await Promise.all(
    authorityIds.map((authorityId) =>
      createNotification(
        authorityId,
        issueId,
        "New Issue Assigned",
        `New assigned issue: ${issueTitle}`,
        "authority_assigned_issue"
      )
    )
  );
}

async function notifyChannelMembersNewIssue(issueId, channelId, issueTitle, actorId) {
  const usersSnap = await getDocs(query(collection(db, "users"), where("channelId", "==", channelId)));
  const targets = usersSnap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((user) => user.id !== actorId);

  await Promise.all(
    targets.map((user) =>
      createNotification(
        user.id,
        issueId,
        "New Issue in Channel",
        `New issue reported: ${issueTitle}`,
        "new_issue_channel"
      )
    )
  );
}

export async function createIssue(
  title,
  description,
  images = [],
  category,
  currentUser,
  channelId,
  options = {}
) {
  if (!currentUser?.uid || !channelId) {
    throw new Error("Missing user or channel.");
  }
  await assertRateLimit("issue", currentUser.uid);

  if (!(await isOnline())) {
    await enqueueAction({
      type: "createIssue",
      payload: { title, description, images, category, currentUser, channelId, options }
    });
    await incrementRateLimit("issue", currentUser.uid);
    return `queued-${Date.now()}`;
  }

  const channelSnap = await getDoc(doc(db, "channels", channelId));
  if (!channelSnap.exists()) {
    throw new Error("Channel not found.");
  }
  if (channelSnap.data()?.status === "suspended") {
    throw new Error("This channel is suspended. New issue posting is disabled.");
  }

  const { nextTitle, nextDescription } = validateIssueInput(title, description, category, images);

  const issueRef = doc(collection(db, "issues"));
  const manualAuthorities = Array.isArray(options?.manualAssignedAuthorities)
    ? options.manualAssignedAuthorities.filter(Boolean)
    : null;
  const assignedAuthorities = manualAuthorities
    ? Array.from(new Set(manualAuthorities))
    : await findAuthorityMatches(channelId, category);
  const imageUrls = await uploadIssueImages(issueRef.id, images);
  const initialHistory = buildHistoryEntry("open", currentUser.name || "Unknown", currentUser.uid);

  await runTransaction(db, async (tx) => {
    tx.set(issueRef, {
      title: nextTitle,
      description: nextDescription,
      authorId: currentUser.uid,
      authorName: currentUser.name || "Unknown",
      authorAvatar: currentUser.avatar || "",
      authorRole: currentUser.role || "User",
      channelId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      images: imageUrls,
      status: "open",
      statusHistory: [initialHistory],
      assignedAuthorities,
      likes: [],
      likesCount: 0,
      commentsCount: 0,
      progressUpdatesCount: 0,
      category: category || null,
      location: null,
      audioUrl: options?.audioUrl || null,
      isAIRefined: Boolean(options?.isAIRefined),
      aiSummary: normalizeText(options?.aiSummary || ""),
      refinedBy: options?.refinedBy || "user",
      keywords: Array.isArray(options?.keywords) ? options.keywords.filter(Boolean).slice(0, 20) : [],
      isVoiceReport: Boolean(options?.isVoiceReport)
    });
  });

  await addDoc(collection(db, "issues", issueRef.id, "statusHistory"), {
    status: "open",
    changedById: currentUser.uid,
    changedByName: currentUser.name || "Unknown",
    changedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    note: ""
  });

  await notifyAuthoritiesAssigned(issueRef.id, assignedAuthorities, nextTitle);
  await notifyChannelMembersNewIssue(issueRef.id, channelId, nextTitle, currentUser.uid);
  await incrementRateLimit("issue", currentUser.uid);

  return issueRef.id;
}

export async function assignAuthoritiesToIssue(issueId, category) {
  const issueRef = doc(db, "issues", issueId);
  const issueSnap = await getDoc(issueRef);
  if (!issueSnap.exists()) {
    throw new Error("Issue not found.");
  }

  const issue = issueSnap.data();
  const matchedAuthorities = await findAuthorityMatches(issue.channelId, category || issue.category || null);

  await updateDoc(issueRef, {
    assignedAuthorities: matchedAuthorities,
    updatedAt: serverTimestamp()
  });

  await notifyAuthoritiesAssigned(issueId, matchedAuthorities, issue.title || "Issue");
  return matchedAuthorities;
}

export async function manuallyAssignIssue(issueId, authorityIds, headId) {
  const actor = await getUserProfile(headId);
  if (!["Head", "SuperAdmin"].includes(actor.role)) {
    throw new Error("Only Head can reassign issues.");
  }

  const issueRef = doc(db, "issues", issueId);
  const issueSnap = await getDoc(issueRef);
  if (!issueSnap.exists()) {
    throw new Error("Issue not found.");
  }

  const issueData = issueSnap.data();
  if (actor.role !== "SuperAdmin" && actor.channelId !== issueData.channelId) {
    throw new Error("You can only reassign issues in your channel.");
  }

  const validAuthorityIds = Array.from(new Set((authorityIds || []).filter(Boolean)));

  await updateDoc(issueRef, {
    assignedAuthorities: validAuthorityIds,
    updatedAt: serverTimestamp()
  });

  await notifyAuthoritiesAssigned(issueId, validAuthorityIds, issueData.title || "Issue");
  return validAuthorityIds;
}

export async function getActiveAuthorities(channelId) {
  if (!channelId) {
    return [];
  }

  const authoritiesQuery = query(
    collection(db, "users"),
    where("channelId", "==", channelId),
    where("role", "==", "Authority"),
    where("status", "==", "active")
  );

  const snap = await getDocs(authoritiesQuery);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function getAuthorityDashboard(authorityId, channelId) {
  if (!authorityId || !channelId) {
    return { open: [], in_progress: [], resolved: [], closed: [] };
  }

  const dashboardQuery = query(
    collection(db, "issues"),
    where("assignedAuthorities", "array-contains", authorityId)
  );

  const snap = await getDocs(dashboardQuery);
  const grouped = { open: [], in_progress: [], resolved: [], closed: [] };

  snap.docs.forEach((item) => {
    const issue = { id: item.id, ...item.data() };
    if (issue.channelId !== channelId) {
      return;
    }
    const status = ISSUE_STATUS.includes(issue.status) ? issue.status : "open";
    grouped[status].push(issue);
  });

  ISSUE_STATUS.forEach((status) => {
    grouped[status] = grouped[status].sort(
      (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt)
    );
  });

  return grouped;
}

export async function getIssuesFeed(channelId, pageSize = 10, lastDoc = null, sortBy = "recent", status = "all") {
  if (!channelId) {
    return { items: [], lastVisible: null, hasMore: false };
  }

  const constraints = [where("channelId", "==", channelId)];
  if (status && status !== "all") {
    constraints.push(where("status", "==", status));
  }

  if (sortBy === "most-liked") {
    constraints.push(orderBy("likesCount", "desc"));
    constraints.push(orderBy("createdAt", "desc"));
  } else {
    constraints.push(orderBy("createdAt", "desc"));
  }

  constraints.push(limit(pageSize));
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  try {
    const feedQuery = query(collection(db, "issues"), ...constraints);
    const snap = await getDocs(feedQuery);

    const items = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const lastVisible = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    if (!lastDoc) {
      await cacheFeed(items);
    }

    return {
      items,
      lastVisible,
      hasMore: snap.docs.length === pageSize
    };
  } catch (error) {
    const cached = await readCachedFeed();
    return {
      items: cached.items || [],
      lastVisible: null,
      hasMore: false
    };
  }
}

export async function getIssueById(issueId) {
  try {
    const snap = await getDoc(doc(db, "issues", issueId));
    if (!snap.exists()) {
      return null;
    }
    const issue = { id: snap.id, ...snap.data() };
    await cacheIssue(issueId, issue);
    return issue;
  } catch (error) {
    const cached = await readCachedIssue(issueId);
    return cached.issue;
  }
}

export async function likeIssue(issueId, userId) {
  if (!issueId || !userId) {
    throw new Error("Missing issue or user.");
  }
  const lastPressed = likeLastPressedAt.get(userId) || 0;
  if (Date.now() - lastPressed < LIKE_THROTTLE_MS) {
    return;
  }
  likeLastPressedAt.set(userId, Date.now());

  if (!(await isOnline())) {
    await enqueueAction({ type: "likeIssue", payload: { issueId, userId } });
    return;
  }

  const issueRef = doc(db, "issues", issueId);
  await runTransaction(db, async (tx) => {
    const issueSnap = await tx.get(issueRef);
    if (!issueSnap.exists()) {
      throw new Error("Issue not found.");
    }

    const data = issueSnap.data();
    const likes = Array.isArray(data.likes) ? data.likes : [];
    const isLiked = likes.includes(userId);
    const nextLikes = isLiked ? likes.filter((id) => id !== userId) : [...likes, userId];

    tx.update(issueRef, {
      likes: nextLikes,
      likesCount: nextLikes.length,
      updatedAt: serverTimestamp()
    });
  });
}

async function getCommentAuthorProfile(userId) {
  const userSnap = await getDoc(doc(db, "users", userId));
  if (!userSnap.exists()) {
    return {
      userName: "Unknown",
      userAvatar: ""
    };
  }
  const user = userSnap.data();
  return {
    userName: user.name || "Unknown",
    userAvatar: user.avatar || ""
  };
}

export async function addComment(issueId, userId, text) {
  const nextText = normalizeText(text);
  if (nextText.length < 1) {
    throw new Error("Comment cannot be empty.");
  }
  await assertRateLimit("comment", userId);

  if (!(await isOnline())) {
    await enqueueAction({ type: "addComment", payload: { issueId, userId, text: nextText } });
    await incrementRateLimit("comment", userId);
    return;
  }

  const issueRef = doc(db, "issues", issueId);
  const profile = await getCommentAuthorProfile(userId);

  let assignedAuthorities = [];
  let issueTitle = "Issue";
  let issueAuthorId = "";

  await runTransaction(db, async (tx) => {
    const issueSnap = await tx.get(issueRef);
    if (!issueSnap.exists()) {
      throw new Error("Issue not found.");
    }

    const issueData = issueSnap.data();
    assignedAuthorities = Array.isArray(issueData.assignedAuthorities) ? issueData.assignedAuthorities : [];
    issueTitle = issueData.title || "Issue";
    issueAuthorId = issueData.authorId || "";

    const commentRef = doc(collection(db, "comments"));
    tx.set(commentRef, {
      issueId,
      userId,
      userName: profile.userName,
      userAvatar: profile.userAvatar,
      text: nextText,
      createdAt: serverTimestamp()
    });

    tx.update(issueRef, {
      commentsCount: increment(1),
      updatedAt: serverTimestamp()
    });
  });

  await Promise.all(
    assignedAuthorities
      .filter((authorityId) => authorityId !== userId)
      .map((authorityId) =>
        createNotification(
          authorityId,
          issueId,
          "New Comment on Assigned Issue",
          `${profile.userName} commented on \"${issueTitle}\".`,
          "reporter_comment"
        )
      )
  );
  if (issueAuthorId && issueAuthorId !== userId) {
    await createNotification(
      issueAuthorId,
      issueId,
      "New Comment",
      `${profile.userName} commented on \"${issueTitle}\".`,
      "reporter_comment"
    );
  }
  await incrementRateLimit("comment", userId);
}

export async function getComments(issueId) {
  try {
    const commentsQuery = query(
      collection(db, "comments"),
      where("issueId", "==", issueId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(commentsQuery);
    const comments = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    await cacheComments(issueId, comments);
    return comments;
  } catch (error) {
    const cached = await readCachedComments(issueId);
    return cached.comments || [];
  }
}

export async function addProgressUpdate(issueId, authorityId, text, images = []) {
  const nextText = validateProgressText(text);
  if (images.length > 2) {
    throw new Error("You can upload at most 2 images.");
  }

  const actor = await getUserProfile(authorityId);
  if (actor.role !== "Authority") {
    throw new Error("Only authorities can add progress updates.");
  }

  const issueRef = doc(db, "issues", issueId);
  const issueSnap = await getDoc(issueRef);
  if (!issueSnap.exists()) {
    throw new Error("Issue not found.");
  }

  const issueData = issueSnap.data();
  if (!canActorManageIssue(actor, issueData)) {
    throw new Error("You are not assigned to this issue.");
  }

  const imageUrls = await uploadIssueImages(issueId, images, "progress", 2);

  await addDoc(collection(db, "progressUpdates"), {
    issueId,
    authorityId,
    authorityName: actor.name,
    text: nextText,
    images: imageUrls,
    status: issueData.status,
    createdAt: serverTimestamp()
  });

  await updateDoc(issueRef, {
    progressUpdatesCount: increment(1),
    updatedAt: serverTimestamp()
  });

  await createNotification(
    issueData.authorId,
    issueId,
    "New Progress Update",
    `${actor.name} posted a progress update on \"${issueData.title || "Issue"}\".`,
    "progress_update"
  );
}

export async function getProgressUpdates(issueId) {
  const updatesQuery = query(
    collection(db, "progressUpdates"),
    where("issueId", "==", issueId),
    orderBy("createdAt", "asc")
  );

  const snap = await getDocs(updatesQuery);
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function deleteIssue(issueId, userId) {
  const issueRef = doc(db, "issues", issueId);
  const issueSnap = await getDoc(issueRef);
  if (!issueSnap.exists()) {
    throw new Error("Issue not found.");
  }

  const data = issueSnap.data();
  if (data.authorId !== userId) {
    throw new Error("Only issue author can delete this issue.");
  }

  const images = Array.isArray(data.images) ? data.images : [];
  await Promise.all(
    images.map(async (url) => {
      try {
        await deleteObject(ref(storage, url));
      } catch (error) {
        console.log("Failed to delete image:", url, error?.message);
      }
    })
  );

  const [commentsSnap, historySnap, progressSnap] = await Promise.all([
    getDocs(query(collection(db, "comments"), where("issueId", "==", issueId))),
    getDocs(collection(db, "issues", issueId, "statusHistory")),
    getDocs(query(collection(db, "progressUpdates"), where("issueId", "==", issueId)))
  ]);

  const batch = writeBatch(db);
  commentsSnap.docs.forEach((item) => batch.delete(doc(db, "comments", item.id)));
  historySnap.docs.forEach((item) => batch.delete(doc(db, "issues", issueId, "statusHistory", item.id)));
  progressSnap.docs.forEach((item) => batch.delete(doc(db, "progressUpdates", item.id)));
  batch.delete(issueRef);
  await batch.commit();
}

export async function updateIssueStatus(issueId, newStatus, authorityId, note = "") {
  if (!ISSUE_STATUS.includes(newStatus)) {
    throw new Error("Invalid status selected.");
  }

  const actor = await getUserProfile(authorityId);
  if (!["Authority", "Head", "SuperAdmin"].includes(actor.role)) {
    throw new Error("Only Authority or Head can change issue status.");
  }

  const issueRef = doc(db, "issues", issueId);
  const historyEntry = buildHistoryEntry(newStatus, actor.name, authorityId, note);

  await runTransaction(db, async (tx) => {
    const issueSnap = await tx.get(issueRef);
    if (!issueSnap.exists()) {
      throw new Error("Issue not found.");
    }

    const issueData = issueSnap.data();
    if (!canActorManageIssue(actor, issueData)) {
      throw new Error("You are not assigned to this issue.");
    }

    validateStatusTransition(issueData.status, newStatus);

    const existingHistory = Array.isArray(issueData.statusHistory) ? issueData.statusHistory : [];

    tx.update(issueRef, {
      status: newStatus,
      statusHistory: [...existingHistory, historyEntry],
      updatedAt: serverTimestamp()
    });
  });

  await addDoc(collection(db, "issues", issueId, "statusHistory"), {
    status: newStatus,
    changedById: authorityId,
    changedByName: actor.name,
    changedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    note: normalizeText(note)
  });

  const issueSnap = await getDoc(issueRef);
  const issueData = issueSnap.data();

  const noteText = normalizeText(note) || `Status changed to ${toStatusLabel(newStatus)}.`;
  await addDoc(collection(db, "progressUpdates"), {
    issueId,
    authorityId,
    authorityName: actor.name,
    text: noteText,
    images: [],
    status: newStatus,
    createdAt: serverTimestamp()
  });

  await updateDoc(issueRef, {
    progressUpdatesCount: increment(1),
    updatedAt: serverTimestamp()
  });

  await createNotification(
    issueData?.authorId,
    issueId,
    "Issue Status Updated",
    `Issue status changed to ${toStatusLabel(newStatus)}.`,
    "issue_status_changed",
    { status: newStatus }
  );
}

export async function getStatusHistory(issueId) {
  const historyQuery = query(
    collection(db, "issues", issueId, "statusHistory"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(historyQuery);
  return snap.docs
    .map((item) => {
      const data = item.data();
      return { id: item.id, ...data, createdAt: data.createdAt || data.changedAt };
    })
    .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
}

export async function updateIssue(issueId, userId, { title, description, category }) {
  const issueRef = doc(db, "issues", issueId);
  const issueSnap = await getDoc(issueRef);
  if (!issueSnap.exists()) {
    throw new Error("Issue not found.");
  }
  const issueData = issueSnap.data();
  if (issueData.authorId !== userId) {
    throw new Error("Only issue author can edit this issue.");
  }

  const { nextTitle, nextDescription } = validateIssueInput(
    title ?? issueData.title,
    description ?? issueData.description,
    category ?? issueData.category,
    []
  );

  await updateDoc(issueRef, {
    title: nextTitle,
    description: nextDescription,
    category: category ?? issueData.category ?? null,
    updatedAt: serverTimestamp()
  });
}

export function formatTimestamp(value) {
  const millis = timestampToMillis(value);
  if (!millis) {
    return "";
  }
  return new Date(millis).toLocaleString();
}

export async function syncOfflineActions() {
  if (!(await isOnline())) {
    return { synced: 0, failed: 0 };
  }

  const queued = await readQueuedActions();
  if (queued.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const processedIds = [];
  let failed = 0;

  for (const item of queued) {
    try {
      if (item.type === "createIssue") {
        const payload = item.payload || {};
        // eslint-disable-next-line no-await-in-loop
        await createIssue(
          payload.title,
          payload.description,
          payload.images || [],
          payload.category || null,
          payload.currentUser,
          payload.channelId,
          payload.options || {}
        );
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


