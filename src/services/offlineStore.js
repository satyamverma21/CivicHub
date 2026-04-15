import AsyncStorage from "@react-native-async-storage/async-storage";

const FEED_CACHE_KEY = "offline_feed_cache_v1";
const ISSUE_CACHE_PREFIX = "offline_issue_v1_";
const COMMENTS_CACHE_PREFIX = "offline_comments_v1_";
const QUEUE_KEY = "offline_action_queue_v1";

async function getJson(key, fallback) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

async function setJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function cacheFeed(items) {
  await setJson(FEED_CACHE_KEY, { items, savedAt: Date.now() });
}

export async function readCachedFeed() {
  return getJson(FEED_CACHE_KEY, { items: [], savedAt: 0 });
}

export async function cacheIssue(issueId, issue) {
  await setJson(`${ISSUE_CACHE_PREFIX}${issueId}`, { issue, savedAt: Date.now() });
}

export async function readCachedIssue(issueId) {
  return getJson(`${ISSUE_CACHE_PREFIX}${issueId}`, { issue: null, savedAt: 0 });
}

export async function cacheComments(issueId, comments) {
  await setJson(`${COMMENTS_CACHE_PREFIX}${issueId}`, { comments, savedAt: Date.now() });
}

export async function readCachedComments(issueId) {
  return getJson(`${COMMENTS_CACHE_PREFIX}${issueId}`, { comments: [], savedAt: 0 });
}

export async function enqueueAction(action) {
  const queue = await getJson(QUEUE_KEY, []);
  queue.push({ ...action, queuedAt: Date.now(), id: `${Date.now()}-${Math.random()}` });
  await setJson(QUEUE_KEY, queue);
}

export async function readQueuedActions() {
  return getJson(QUEUE_KEY, []);
}

export async function clearQueuedActions(ids) {
  const queue = await getJson(QUEUE_KEY, []);
  const idSet = new Set(ids);
  const nextQueue = queue.filter((item) => !idSet.has(item.id));
  await setJson(QUEUE_KEY, nextQueue);
}

export async function replaceQueue(actions) {
  await setJson(QUEUE_KEY, actions || []);
}