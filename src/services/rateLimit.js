import AsyncStorage from "@react-native-async-storage/async-storage";

const LIMITS = {
  issue: { max: 5, key: "rate_issue" },
  comment: { max: 20, key: "rate_comment" }
};

function todayKey(prefix) {
  const now = new Date();
  const day = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  return `${prefix}_${day}`;
}

export async function assertRateLimit(type, userId) {
  const cfg = LIMITS[type];
  if (!cfg || !userId) {
    return;
  }

  const key = `${todayKey(cfg.key)}_${userId}`;
  const current = Number((await AsyncStorage.getItem(key)) || 0);
  if (current >= cfg.max) {
    throw new Error(`Rate limit reached: max ${cfg.max} ${type}s per day.`);
  }
}

export async function incrementRateLimit(type, userId) {
  const cfg = LIMITS[type];
  if (!cfg || !userId) {
    return;
  }
  const key = `${todayKey(cfg.key)}_${userId}`;
  const current = Number((await AsyncStorage.getItem(key)) || 0);
  await AsyncStorage.setItem(key, String(current + 1));
}