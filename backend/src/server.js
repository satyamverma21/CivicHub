require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { initDb } = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SUPER_ADMIN_EMAIL = "superadmin@communityapp.com";
const NIM_BASE_URL = String(process.env.NIM_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
const NIM_MODEL = String(process.env.NIM_MODEL || "meta/llama-3.3-70b-instruct");
const NIM_API_KEY = String(process.env.NIM_API_KEY || process.env.NVIDIA_API_KEY || "");
const NIM_FALLBACK_MODELS = String(
  process.env.NIM_FALLBACK_MODELS ||
  "meta/llama-3.1-70b-instruct,meta/llama-3.1-8b-instruct,mistralai/mixtral-8x7b-instruct-v0.1"
).split(",").map((entry) => entry.trim()).filter(Boolean);
const AI_TIMEOUT_MS = Math.max(4000, Number(process.env.AI_TIMEOUT_MS || 30000));
let nimClientModulePromise = null;

const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadsDir, "images");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".bin";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const MAX_UPLOAD_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".gif", ".bmp"]);
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_FILE_SIZE, files: 5 },
  fileFilter: (req, file, cb) => {
    const mime = String(file?.mimetype || "").toLowerCase();
    const extension = path.extname(String(file?.originalname || "")).toLowerCase();
    if (!mime.startsWith("image/") && !IMAGE_EXTENSIONS.has(extension)) {
      cb(new Error("Only image files are allowed."));
      return;
    }
    cb(null, true);
  }
});
const uploadIssueImages = upload.fields([
  { name: "images", maxCount: 5 },
  { name: "images[]", maxCount: 5 },
  { name: "file", maxCount: 5 },
  { name: "files", maxCount: 5 }
]);

const j = (v, fallback) => {
  try { return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const s = (v) => String(v || "").replace(/<script.*?>.*?<\/script>/gi, "").replace(/[<>]/g, "").trim();
const now = () => Date.now();
const id = (p = "id") => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const ISSUE_CATEGORIES = [
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
const ISSUE_CATEGORY_MAP = ISSUE_CATEGORIES.reduce((acc, category) => {
  acc[category.toLowerCase()] = category;
  return acc;
}, {});

function trimTo(value, max = 400) {
  return s(String(value || "")).slice(0, max);
}

function normalizeIssueCategory(value) {
  const normalized = s(value || "").toLowerCase();
  return ISSUE_CATEGORY_MAP[normalized] || "Other";
}

function normalizeAuthorityTags(input) {
  const source = Array.isArray(input) ? input : [];
  const unique = [];
  for (const entry of source) {
    const normalized = normalizeIssueCategory(entry);
    if (!unique.includes(normalized)) unique.push(normalized);
  }
  return unique;
}

function normalizeIssueLocation(value) {
  const text = trimTo(value || "", 220);
  return text || null;
}

function normalizeIssueImages(input, max = 5) {
  if (!Array.isArray(input)) return [];
  const unique = [];
  for (const entry of input) {
    const raw = String(entry || "").trim();
    const value = raw.replace(/\\/g, "/");
    if (!value) continue;
    const uploadPathMatch = value.match(/(?:^|\/)(uploads\/images\/[^?#\s]+)/i);
    const normalized = uploadPathMatch
      ? `/${uploadPathMatch[1].replace(/^\/+/, "")}`
      : (value.startsWith("uploads/images/") ? `/${value}` : value);
    if (!normalized.startsWith("/uploads/images/") && !normalized.startsWith("http://") && !normalized.startsWith("https://")) continue;
    if (unique.includes(normalized)) continue;
    unique.push(normalized);
    if (unique.length >= max) break;
  }
  return unique;
}

async function deleteIssueImageIfUnused(db, imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url.startsWith("/uploads/images/")) return;

  const issueRef = await db.get("SELECT id FROM issues WHERE images_json LIKE ? LIMIT 1", `%${url}%`);
  if (issueRef) return;
  const progressRef = await db.get("SELECT id FROM progress_updates WHERE images_json LIKE ? LIMIT 1", `%${url}%`);
  if (progressRef) return;

  const fileName = path.basename(url);
  const filePath = path.join(uploadsDir, "images", fileName);
  await fs.promises.unlink(filePath).catch(() => {});
}

function authorityMatchesIssue(row, authorityId, authorityTags, issueCategory) {
  const assigned = j(row.assigned_authorities_json, []);
  if (assigned.includes(authorityId)) return true;
  if (issueCategory === "Other") return true;
  return authorityTags.includes(issueCategory);
}

function parseAiTextList(raw) {
  if (!raw) return [];
  const text = String(raw).trim();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        parsed = null;
      }
    }
  }

  const arr = Array.isArray(parsed) ? parsed : [];
  const normalized = arr
    .map((item) => {
      if (typeof item === "string") return trimTo(item, 220);
      if (item && typeof item === "object") return trimTo(item.text || item.solution || item.step || "", 220);
      return "";
    })
    .filter((entry) => entry.length >= 8);

  return [...new Set(normalized)].slice(0, 6);
}

function buildAiPrompt(issue) {
  return [
    "You are helping a college complaint authority resolve a student complaint.",
    "Return JSON array only. No markdown. No explanation.",
    "Each item must be one practical action step (8-180 chars).",
    "Focus on realistic and policy-safe institutional actions.",
    "",
    `Title: ${trimTo(issue.title, 180)}`,
    `Category: ${trimTo(issue.category || "Other", 60)}`,
    `Status: ${trimTo(issue.status || "open", 30)}`,
    `Location: ${trimTo(issue.location || "N/A", 80)}`,
    `Description: ${trimTo(issue.description, 1200)}`,
    "",
    "Generate 4-6 actionable solution steps."
  ].join("\n");
}

async function getNimClientModule() {
  if (!nimClientModulePromise) {
    nimClientModulePromise = import("./nim-client.mjs");
  }
  return nimClientModulePromise;
}

async function generateAiSolutions(issue) {
  const prompt = buildAiPrompt(issue);
  const systemPrompt = "You generate concise institutional resolution steps. Return only valid JSON array of strings.";
  if (!NIM_API_KEY) {
    throw new Error("NIM API key missing. Set NIM_API_KEY or NVIDIA_API_KEY in backend environment.");
  }
  const { createNimChatCompletion } = await getNimClientModule();
  const aiResponse = await createNimChatCompletion({
    apiKey: NIM_API_KEY,
    baseURL: NIM_BASE_URL,
    model: NIM_MODEL,
    fallbackModels: NIM_FALLBACK_MODELS,
    systemPrompt,
    userPrompt: prompt,
    temperature: 0.2,
    topP: 0.7,
    maxTokens: 1024,
    timeoutMs: AI_TIMEOUT_MS
  });
  const outputText = String(aiResponse?.text || "");

  const entries = parseAiTextList(outputText);
  if (entries.length === 0) {
    throw new Error("AI did not return valid solution suggestions.");
  }

  return {
    provider: "nim",
    model: String(aiResponse?.model || NIM_MODEL),
    entries
  };
}

function toUser(row) {
  if (!row) return null;
  return {
    uid: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    channelId: row.channel_id,
    status: row.status,
    avatar: row.avatar || "",
    bio: row.bio || "",
    authorityTags: j(row.authority_tags_json, []),
    privacy: j(row.privacy_json, { showFullName: true, anonymousPosts: false }),
    notificationSettings: j(row.notification_settings_json, {
      all: true,
      newIssue: true,
      comment: true,
      assignment: true,
      status: true,
      progress: true,
      approval: true
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toIssue(row) {
  const possibleSolutionsPayload = j(row.possible_solutions_json, { solutions: [], note: "" });
  const possibleSolutions = Array.isArray(possibleSolutionsPayload)
    ? possibleSolutionsPayload
    : (possibleSolutionsPayload?.solutions || []);
  const possibleSolutionsNote = Array.isArray(possibleSolutionsPayload)
    ? ""
    : s(possibleSolutionsPayload?.note || "");

  const normalizedImages = normalizeIssueImages(j(row.images_json, []), 50);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    authorRole: row.author_role,
    channelId: row.channel_id,
    status: row.status,
    category: row.category,
    location: row.location,
    images: normalizedImages,
    assignedAuthorities: j(row.assigned_authorities_json, []),
    likes: j(row.likes_json, []),
    likesCount: row.likes_count || 0,
    commentsCount: row.comments_count || 0,
    progressUpdatesCount: row.progress_updates_count || 0,
    statusHistory: j(row.status_history_json, []),
    audioUrl: row.audio_url,
    isAIRefined: Boolean(row.is_ai_refined),
    aiSummary: row.ai_summary || "",
    refinedBy: row.refined_by || "user",
    keywords: j(row.keywords_json, []),
    isVoiceReport: Boolean(row.is_voice_report),
    possibleSolutions,
    possibleSolutionsNote,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    req.token = token;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

const role = (...allowed) => (req, res, next) => {
  if (!allowed.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
  return next();
};

async function notify(db, { userId, issueId = null, title, body, type, screen = null, meta = {} }) {
  await db.run(
    `INSERT INTO notifications (id, user_id, issue_id, title, body, type, screen, read, created_at, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    id("noti"),
    userId,
    issueId,
    title,
    body,
    type,
    screen || (issueId ? "IssueDetail" : "Home"),
    now(),
    JSON.stringify(meta)
  );
}

async function assertRateLimit(db, userId, action, max) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${userId}_${action}_${day}`;
  const row = await db.get("SELECT * FROM daily_limits WHERE id = ?", key);
  if (!row) return;
  if (row.count >= max) throw new Error(`Rate limit reached: max ${max} ${action} per day.`);
}

async function consumeRateLimit(db, userId, action) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${userId}_${action}_${day}`;
  const row = await db.get("SELECT * FROM daily_limits WHERE id = ?", key);
  if (!row) {
    await db.run(
      "INSERT INTO daily_limits (id, user_id, action, day_key, count) VALUES (?, ?, ?, ?, 1)",
      key,
      userId,
      action,
      day
    );
    return;
  }
  await db.run("UPDATE daily_limits SET count = count + 1 WHERE id = ?", key);
}

async function ensureSuperAdmin(db) {
  const e = await db.get("SELECT id FROM users WHERE email = ?", SUPER_ADMIN_EMAIL);
  if (e) return;
  const hash = await bcrypt.hash("Admin1234", 10);
  const t = now();
  await db.run(
    `INSERT INTO users (id, email, password_hash, name, role, status, avatar, bio, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', '', '', ?, ?)`,
    id("usr"), SUPER_ADMIN_EMAIL, hash, "Super Admin", "SuperAdmin", t, t
  );
}

async function deleteIssueCascade(db, issueId) {
  const issue = await db.get("SELECT images_json FROM issues WHERE id = ?", issueId);
  const updates = await db.all("SELECT images_json FROM progress_updates WHERE issue_id = ?", issueId);
  const removableImages = [
    ...j(issue?.images_json, []),
    ...updates.flatMap((row) => j(row.images_json, []))
  ];

  await db.run("DELETE FROM comments WHERE issue_id = ?", issueId);
  await db.run("DELETE FROM progress_updates WHERE issue_id = ?", issueId);
  await db.run("DELETE FROM notifications WHERE issue_id = ?", issueId);
  await db.run("DELETE FROM issues WHERE id = ?", issueId);

  for (const image of [...new Set(removableImages)]) {
    // eslint-disable-next-line no-await-in-loop
    await deleteIssueImageIfUnused(db, image);
  }
}

async function resolveAuthorityRequest(db, requestId, actorId, decision, expectedChannelId = null) {
  const request = await db.get("SELECT * FROM channel_requests WHERE id = ?", requestId);
  if (!request) return null;
  if (expectedChannelId && request.channel_id !== expectedChannelId) return null;

  if (decision === "approve") {
    await db.run(
      "UPDATE channel_requests SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?",
      actorId,
      now(),
      request.id
    );
    await db.run("UPDATE users SET status = 'active', updated_at = ? WHERE id = ?", now(), request.user_id);
    return request;
  }

  if (decision === "reject") {
    await db.run("DELETE FROM channel_requests WHERE id = ?", request.id);
    await db.run("UPDATE users SET status = 'rejected', channel_id = NULL, updated_at = ? WHERE id = ?", now(), request.user_id);
    return request;
  }

  throw new Error(`Unsupported authority request decision: ${decision}`);
}

app.get("/api/health", (req, res) => res.json({ ok: true, ts: now() }));

app.post("/api/auth/signup-head", async (req, res) => {
  const db = await initDb();
  const email = s(req.body.email).toLowerCase();
  const password = String(req.body.password || "");
  const organizationName = s(req.body.organizationName);
  if (!email || !password || organizationName.length < 3) return res.status(400).json({ error: "Invalid input" });

  const exists = await db.get("SELECT id FROM users WHERE email = ?", email);
  if (exists) return res.status(400).json({ error: "Email already registered" });

  let channelId;
  for (;;) {
    channelId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const c = await db.get("SELECT id FROM channels WHERE id = ?", channelId);
    if (!c) break;
  }

  const uid = id("usr");
  const hash = await bcrypt.hash(password, 10);
  const t = now();
  await db.run(
    `INSERT INTO users (id, email, password_hash, name, role, channel_id, status, avatar, bio, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'Head', ?, 'active', '', '', ?, ?)`,
    uid, email, hash, organizationName, channelId, t, t
  );
  await db.run(
    `INSERT INTO channels (id, name, head_id, head_email, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', 'active', ?, ?)`,
    channelId, organizationName, uid, email, t, t
  );

  const token = jwt.sign({ uid, role: "Head", channelId }, JWT_SECRET, { expiresIn: "30d" });
  await db.run("INSERT INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)", token, uid, t);
  const user = await db.get("SELECT * FROM users WHERE id = ?", uid);
  res.json({ token, user: toUser(user) });
});

app.post("/api/auth/signup-user", async (req, res) => {
  const db = await initDb();
  const email = s(req.body.email).toLowerCase();
  const password = String(req.body.password || "");
  const fullName = s(req.body.fullName);
  const userRole = s(req.body.role);
  const channelId = s(req.body.channelIdInput).toUpperCase();
  if (!["User", "Authority"].includes(userRole)) return res.status(400).json({ error: "Invalid role" });

  const channel = await db.get("SELECT id FROM channels WHERE id = ?", channelId);
  if (!channel) return res.status(400).json({ error: "Invalid Channel ID" });

  const exists = await db.get("SELECT id FROM users WHERE email = ?", email);
  if (exists) return res.status(400).json({ error: "Email already registered" });

  const uid = id("usr");
  const hash = await bcrypt.hash(password, 10);
  const status = userRole === "Authority" ? "pending_approval" : "active";
  const t = now();
  await db.run(
    `INSERT INTO users (id, email, password_hash, name, role, channel_id, status, avatar, bio, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)`,
    uid, email, hash, fullName, userRole, channelId, status, t, t
  );

  if (userRole === "Authority") {
    await db.run(
      `INSERT INTO channel_requests (id, user_id, channel_id, request_type, status, created_at)
       VALUES (?, ?, ?, 'authority_join', 'pending', ?)`,
      id("req"), uid, channelId, t
    );
    return res.json({ pendingApproval: true });
  }

  const token = jwt.sign({ uid, role: userRole, channelId }, JWT_SECRET, { expiresIn: "30d" });
  await db.run("INSERT INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)", token, uid, t);
  const user = await db.get("SELECT * FROM users WHERE id = ?", uid);
  return res.json({ token, user: toUser(user), pendingApproval: false });
});

app.post("/api/auth/login", async (req, res) => {
  const db = await initDb();
  const email = s(req.body.email).toLowerCase();
  const password = String(req.body.password || "");
  const user = await db.get("SELECT * FROM users WHERE email = ?", email);
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: "Invalid credentials" });
  if (user.status === "suspended") return res.status(403).json({ error: "Your account is suspended by SuperAdmin." });
  if (user.role === "Authority" && user.status === "pending_approval") return res.status(403).json({ error: "Awaiting admin approval" });

  const token = jwt.sign({ uid: user.id, role: user.role, channelId: user.channel_id || null }, JWT_SECRET, { expiresIn: "30d" });
  await db.run("INSERT INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)", token, user.id, now());
  res.json({ token, user: toUser(user) });
});

app.get("/api/auth/me", auth, async (req, res) => {
  const db = await initDb();
  const user = await db.get("SELECT * FROM users WHERE id = ?", req.user.uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: toUser(user) });
});

app.post("/api/auth/logout", auth, async (req, res) => {
  const db = await initDb();
  await db.run("DELETE FROM auth_tokens WHERE token = ?", req.token);
  res.json({ ok: true });
});

app.delete("/api/auth/account", auth, async (req, res) => {
  const db = await initDb();
  await db.run("DELETE FROM users WHERE id = ?", req.user.uid);
  await db.run("DELETE FROM auth_tokens WHERE user_id = ?", req.user.uid);
  res.json({ ok: true });
});

app.patch("/api/users/me", auth, async (req, res) => {
  const db = await initDb();
  const current = await db.get("SELECT * FROM users WHERE id = ?", req.user.uid);
  if (!current) return res.status(404).json({ error: "User not found" });
  const name = s(req.body.name) || current.name;
  const avatar = s(req.body.avatar) || "";
  const bio = s(req.body.bio) || "";
  const pushToken = s(req.body.pushToken || "");
  const privacy = req.body.privacy || j(current.privacy_json, { showFullName: true, anonymousPosts: false });

  await db.run(
    "UPDATE users SET name = ?, avatar = ?, bio = ?, privacy_json = ?, push_token = ?, updated_at = ? WHERE id = ?",
    name, avatar, bio, JSON.stringify(privacy), pushToken || current.push_token || "", now(), req.user.uid
  );
  const user = await db.get("SELECT * FROM users WHERE id = ?", req.user.uid);
  res.json({ user: toUser(user) });
});

app.patch("/api/users/me/notifications", auth, async (req, res) => {
  const db = await initDb();
  await db.run(
    "UPDATE users SET notification_settings_json = ?, updated_at = ? WHERE id = ?",
    JSON.stringify(req.body.settings || {}), now(), req.user.uid
  );
  const user = await db.get("SELECT * FROM users WHERE id = ?", req.user.uid);
  res.json({ user: toUser(user) });
});

app.get("/api/users/me/stats", auth, async (req, res) => {
  const db = await initDb();
  const myIssues = await db.all("SELECT * FROM issues WHERE author_id = ? ORDER BY created_at DESC", req.user.uid);
  const myComments = await db.all("SELECT * FROM comments WHERE user_id = ? ORDER BY created_at DESC", req.user.uid);
  const assigned = await db.all("SELECT * FROM issues WHERE assigned_authorities_json LIKE ?", `%${req.user.uid}%`);
  const issuesResolved = assigned.filter((i) => ["resolved", "closed"].includes(i.status)).length;

  res.json({
    issuesCreated: myIssues.length,
    commentsMade: myComments.length,
    issuesResolved,
    myIssues: myIssues.map(toIssue),
    myComments: myComments.map((c) => ({ id: c.id, issueId: c.issue_id, userId: c.user_id, userName: c.user_name, userAvatar: c.user_avatar, text: c.text, createdAt: c.created_at }))
  });
});
app.get("/api/authorities/active", auth, async (req, res) => {
  const db = await initDb();
  const channelId = s(req.query.channelId || req.user.channelId);
  const rows = await db.all("SELECT * FROM users WHERE channel_id = ? AND role = 'Authority' AND status = 'active' ORDER BY name ASC", channelId);
  res.json(rows.map((r) => ({ id: r.id, ...toUser(r) })));
});

app.get("/api/authorities/tag-assignments", auth, role("Head", "SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const channelId = s(req.query.channelId || req.user.channelId);
  const rows = channelId
    ? await db.all(
      "SELECT * FROM users WHERE channel_id = ? AND role = 'Authority' AND status = 'active' ORDER BY name ASC",
      channelId
    )
    : await db.all("SELECT * FROM users WHERE role = 'Authority' AND status = 'active' ORDER BY name ASC");
  res.json(rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    channelId: row.channel_id,
    authorityTags: normalizeAuthorityTags(j(row.authority_tags_json, []))
  })));
});

app.patch("/api/authorities/:id/tags", auth, role("Head", "SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const authority = await db.get("SELECT * FROM users WHERE id = ? AND role = 'Authority'", req.params.id);
  if (!authority) return res.status(404).json({ error: "Authority not found" });
  if (req.user.role === "Head" && authority.channel_id !== req.user.channelId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const tags = normalizeAuthorityTags(req.body.tags);
  await db.run(
    "UPDATE users SET authority_tags_json = ?, updated_at = ? WHERE id = ?",
    JSON.stringify(tags),
    now(),
    authority.id
  );
  const updated = await db.get("SELECT * FROM users WHERE id = ?", authority.id);
  res.json({ authority: { id: updated.id, ...toUser(updated) } });
});

app.post("/api/upload/images", auth, (req, res) => {
  uploadIssueImages(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: s(error.message || "Image upload failed.") });
    }
    const files = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat().filter(Boolean);
    if (files.length === 0) {
      return res.status(400).json({ error: "No image files received. Please reselect images and try again." });
    }
    const urls = files.map((file) => `/uploads/images/${path.basename(file.path)}`);
    return res.json({ urls });
  });
});

app.post("/api/issues", auth, async (req, res) => {
  const db = await initDb();
  const user = await db.get("SELECT * FROM users WHERE id = ?", req.user.uid);
  if (!user) return res.status(404).json({ error: "User not found" });

  const title = s(req.body.title);
  const description = s(req.body.description);
  if (title.length < 5 || description.length < 10) return res.status(400).json({ error: "Invalid issue input" });

  const issueId = id("iss");
  const t = now();
  const category = normalizeIssueCategory(req.body.category);
  const images = normalizeIssueImages(req.body.images, 5);
  const location = normalizeIssueLocation(req.body.location);
  const manual = Array.isArray(req.body.manualAssignedAuthorities) ? req.body.manualAssignedAuthorities : [];
  const allAuthorities = await db.all(
    "SELECT id, authority_tags_json FROM users WHERE channel_id = ? AND role = 'Authority' AND status = 'active'",
    user.channel_id
  );
  const matchedByTag = allAuthorities
    .filter((row) => {
      if (category === "Other") return true;
      const tags = normalizeAuthorityTags(j(row.authority_tags_json, []));
      return tags.includes(category);
    })
    .map((row) => row.id);
  const assigned = category === "Other"
    ? allAuthorities.map((row) => row.id)
    : (manual.length ? [...new Set(manual)] : matchedByTag);
  const history = [{ status: "open", changedBy: user.name, changedById: user.id, changedAt: t, note: "" }];

  await db.run(
    `INSERT INTO issues (id, title, description, author_id, author_name, author_avatar, author_role, channel_id, status, category, location,
      images_json, assigned_authorities_json, likes_json, likes_count, comments_count, progress_updates_count, status_history_json, possible_solutions_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, '[]', 0, 0, 0, ?, ?, ?, ?)`,
    issueId,
    title,
    description,
    user.id,
    user.name,
    user.avatar || "",
    user.role,
    user.channel_id,
    category,
    location,
    JSON.stringify(images),
    JSON.stringify(assigned),
    JSON.stringify(history),
    JSON.stringify({ solutions: [], note: "" }),
    t,
    t
  );

  for (const aid of assigned) {
    await notify(db, { userId: aid, issueId, title: "New Issue Assigned", body: `New assigned issue: ${title}`, type: "authority_assigned_issue" });
  }
  const members = await db.all("SELECT id FROM users WHERE channel_id = ?", user.channel_id);
  for (const m of members) {
    if (m.id === user.id) continue;
    await notify(db, { userId: m.id, issueId, title: "New Issue in Channel", body: `New issue reported: ${title}`, type: "new_issue_channel" });
  }

  res.json({ issueId });
});

app.get("/api/issues/feed", auth, async (req, res) => {
  const db = await initDb();
  const channelId = s(req.query.channelId || req.user.channelId);
  const status = s(req.query.status || "all");
  const sortBy = s(req.query.sortBy || "recent");
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Math.min(50, Number(req.query.pageSize || 10)));
  const offset = (page - 1) * pageSize;

  let where = "WHERE channel_id = ?";
  const params = [channelId];
  if (status !== "all") { where += " AND status = ?"; params.push(status); }

  let order = "ORDER BY created_at DESC";
  if (sortBy === "most-liked") order = "ORDER BY likes_count DESC, created_at DESC";
  if (sortBy === "most-commented") order = "ORDER BY comments_count DESC, created_at DESC";

  const rows = await db.all(`SELECT * FROM issues ${where} ${order} LIMIT ? OFFSET ?`, ...params, pageSize, offset);
  const count = await db.get(`SELECT COUNT(*) as c FROM issues ${where}`, ...params);
  res.json({ items: rows.map(toIssue), hasMore: offset + rows.length < Number(count?.c || 0), page });
});

app.get("/api/issues/:id", auth, async (req, res) => {
  const db = await initDb();
  const row = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!row) return res.status(404).json({ error: "Issue not found" });
  res.json({ issue: toIssue(row) });
});

app.patch("/api/issues/:id", auth, async (req, res) => {
  const db = await initDb();
  const row = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!row) return res.status(404).json({ error: "Issue not found" });
  if (row.author_id !== req.user.uid) return res.status(403).json({ error: "Forbidden" });

  const nextTitle = s(req.body.title || row.title);
  const nextDescription = s(req.body.description || row.description);
  const nextCategory = req.body.category || row.category;
  const nextLocation = Object.prototype.hasOwnProperty.call(req.body, "location")
    ? normalizeIssueLocation(req.body.location)
    : row.location;
  const currentImages = j(row.images_json, []);
  const nextImages = Object.prototype.hasOwnProperty.call(req.body, "images")
    ? normalizeIssueImages(req.body.images, 5)
    : currentImages;

  await db.run(
    "UPDATE issues SET title = ?, description = ?, category = ?, location = ?, images_json = ?, updated_at = ? WHERE id = ?",
    nextTitle,
    nextDescription,
    nextCategory,
    nextLocation,
    JSON.stringify(nextImages),
    now(),
    req.params.id
  );

  const removedImages = currentImages.filter((img) => !nextImages.includes(img));
  for (const removed of removedImages) {
    // eslint-disable-next-line no-await-in-loop
    await deleteIssueImageIfUnused(db, removed);
  }
  res.json({ ok: true });
});

app.delete("/api/issues/:id", auth, async (req, res) => {
  const db = await initDb();
  const row = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!row) return res.status(404).json({ error: "Issue not found" });
  const roleKey = String(req.user.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (row.author_id !== req.user.uid && !["head", "superadmin", "admin"].includes(roleKey)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await deleteIssueCascade(db, req.params.id);
  res.json({ ok: true });
});

app.post("/api/issues/:id/like", auth, async (req, res) => {
  const db = await initDb();
  const row = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!row) return res.status(404).json({ error: "Issue not found" });
  const likes = j(row.likes_json, []);
  const i = likes.indexOf(req.user.uid);
  if (i >= 0) likes.splice(i, 1); else likes.push(req.user.uid);
  await db.run("UPDATE issues SET likes_json = ?, likes_count = ?, updated_at = ? WHERE id = ?", JSON.stringify(likes), likes.length, now(), row.id);
  res.json({ likesCount: likes.length, liked: likes.includes(req.user.uid) });
});

app.post("/api/issues/:id/comments", auth, async (req, res) => {
  const db = await initDb();
  const issue = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  try { await assertRateLimit(db, req.user.uid, "comment", 40); } catch (error) { return res.status(429).json({ error: error.message }); }

  const user = await db.get("SELECT * FROM users WHERE id = ?", req.user.uid);
  const text = s(req.body.text);
  await db.run(
    `INSERT INTO comments (id, issue_id, user_id, user_name, user_avatar, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id("cmt"),
    issue.id,
    user.id,
    user.name,
    user.avatar || "",
    text,
    now()
  );
  await db.run("UPDATE issues SET comments_count = comments_count + 1, updated_at = ? WHERE id = ?", now(), issue.id);

  if (issue.author_id !== user.id) {
    await notify(db, { userId: issue.author_id, issueId: issue.id, title: "New Comment", body: `${user.name} commented on \"${issue.title}\".`, type: "reporter_comment" });
  }
  await consumeRateLimit(db, req.user.uid, "comment");
  res.json({ ok: true });
});

app.get("/api/issues/:id/comments", auth, async (req, res) => {
  const db = await initDb();
  const rows = await db.all("SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at DESC", req.params.id);
  res.json({ comments: rows.map((c) => ({ id: c.id, issueId: c.issue_id, userId: c.user_id, userName: c.user_name, userAvatar: c.user_avatar, text: c.text, createdAt: c.created_at })) });
});

app.post("/api/issues/:id/progress", auth, role("Authority", "Head", "SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const issue = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue not found" });

  const user = await db.get("SELECT * FROM users WHERE id = ?", req.user.uid);
  await db.run(
    `INSERT INTO progress_updates (id, issue_id, authority_id, authority_name, text, images_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id("upd"),
    issue.id,
    user.id,
    user.name,
    s(req.body.text),
    JSON.stringify(Array.isArray(req.body.images) ? req.body.images : []),
    issue.status,
    now()
  );
  await db.run("UPDATE issues SET progress_updates_count = progress_updates_count + 1, updated_at = ? WHERE id = ?", now(), issue.id);
  await notify(db, { userId: issue.author_id, issueId: issue.id, title: "New Progress Update", body: `${user.name} posted a progress update on \"${issue.title}\".`, type: "progress_update" });
  res.json({ ok: true });
});

app.get("/api/issues/:id/progress", auth, async (req, res) => {
  const db = await initDb();
  const rows = await db.all("SELECT * FROM progress_updates WHERE issue_id = ? ORDER BY created_at ASC", req.params.id);
  res.json({ updates: rows.map((r) => ({ id: r.id, issueId: r.issue_id, authorityId: r.authority_id, authorityName: r.authority_name, text: r.text, images: j(r.images_json, []), status: r.status, createdAt: r.created_at })) });
});

app.post("/api/issues/:id/status", auth, role("Authority", "Head", "SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const issue = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  const actor = await db.get("SELECT * FROM users WHERE id = ?", req.user.uid);
  const history = j(issue.status_history_json, []);
  history.push({ status: s(req.body.status), changedBy: actor.name, changedById: actor.id, changedAt: now(), note: s(req.body.note || "") });

  await db.run("UPDATE issues SET status = ?, status_history_json = ?, updated_at = ? WHERE id = ?", s(req.body.status), JSON.stringify(history), now(), issue.id);
  await notify(db, { userId: issue.author_id, issueId: issue.id, title: "Issue Status Updated", body: `Issue status changed to ${s(req.body.status).replace("_", " ")}.`, type: "issue_status_changed" });
  res.json({ ok: true });
});

app.patch("/api/issues/:id/possible-solutions", auth, role("Authority", "Head", "SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const issue = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  if (req.user.role !== "SuperAdmin" && issue.channel_id !== req.user.channelId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const solutions = (Array.isArray(req.body.solutions) ? req.body.solutions : [])
    .slice(0, 12)
    .map((item) => {
      const text = s(item?.text || "");
      if (text.length < 5) return null;
      return {
        id: s(item?.id || id("sol")),
        text,
        source: s(item?.source || "manual") === "generated" ? "generated" : "manual",
        applied: Boolean(item?.applied),
        appliedBy: s(item?.appliedBy || ""),
        appliedAt: Number(item?.appliedAt || 0) || null,
        updatedAt: now()
      };
    })
    .filter(Boolean);

  const note = s(req.body.note || "");
  const payload = {
    solutions,
    note: note.slice(0, 1500),
    updatedBy: req.user.uid,
    updatedAt: now()
  };

  await db.run(
    "UPDATE issues SET possible_solutions_json = ?, updated_at = ? WHERE id = ?",
    JSON.stringify(payload),
    now(),
    issue.id
  );
  res.json({ possibleSolutions: solutions, possibleSolutionsNote: payload.note });
});

app.post("/api/issues/:id/possible-solutions/generate", auth, role("Authority", "Head", "SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const issue = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  if (req.user.role !== "SuperAdmin" && issue.channel_id !== req.user.channelId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const aiResult = await generateAiSolutions(issue);
    const currentPayload = j(issue.possible_solutions_json, { solutions: [], note: "" });
    const existingSolutions = Array.isArray(currentPayload)
      ? currentPayload
      : (Array.isArray(currentPayload?.solutions) ? currentPayload.solutions : []);
    const preserved = existingSolutions.filter((item) => item && item.source !== "generated");

    const generated = aiResult.entries.map((text, index) => ({
      id: id(`sol_ai_${index + 1}`),
      text,
      source: "generated",
      applied: false,
      appliedBy: "",
      appliedAt: null,
      updatedAt: now()
    }));

    const dedup = new Set();
    const solutions = [...preserved, ...generated]
      .map((item) => ({
        id: s(item?.id || id("sol")),
        text: trimTo(item?.text || "", 220),
        source: s(item?.source || "manual") === "generated" ? "generated" : "manual",
        applied: Boolean(item?.applied),
        appliedBy: trimTo(item?.appliedBy || "", 80),
        appliedAt: Number(item?.appliedAt || 0) || null,
        updatedAt: now()
      }))
      .filter((item) => item.text.length >= 8)
      .filter((item) => {
        const key = item.text.toLowerCase();
        if (dedup.has(key)) return false;
        dedup.add(key);
        return true;
      })
      .slice(0, 12);

    const payload = {
      solutions,
      note: trimTo(Array.isArray(currentPayload) ? "" : currentPayload?.note || "", 1500),
      updatedBy: req.user.uid,
      updatedAt: now()
    };

    await db.run(
      "UPDATE issues SET possible_solutions_json = ?, updated_at = ? WHERE id = ?",
      JSON.stringify(payload),
      now(),
      issue.id
    );

    return res.json({
      possibleSolutions: solutions,
      possibleSolutionsNote: payload.note,
      aiProvider: aiResult.provider,
      aiModel: aiResult.model
    });
  } catch (error) {
    const message = String(error?.message || "Failed to generate AI solutions.");
    const statusCode = Number(error?.statusCode || 0) || (message.includes("NIM API key missing") ? 503 : 502);
    return res.status(statusCode).json({ error: message });
  }
});

app.get("/api/issues/:id/status-history", auth, async (req, res) => {
  const db = await initDb();
  const row = await db.get("SELECT status_history_json FROM issues WHERE id = ?", req.params.id);
  if (!row) return res.status(404).json({ error: "Issue not found" });
  const history = j(row.status_history_json, []).sort((a, b) => (b.changedAt || 0) - (a.changedAt || 0));
  res.json({ history: history.map((h, idx) => ({ id: `${idx}`, ...h, createdAt: h.changedAt })) });
});

app.post("/api/issues/:id/assign", auth, role("Head", "SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const issue = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  const ids = Array.isArray(req.body.authorityIds) ? [...new Set(req.body.authorityIds)] : [];
  await db.run("UPDATE issues SET assigned_authorities_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(ids), now(), issue.id);
  for (const aid of ids) {
    await notify(db, { userId: aid, issueId: issue.id, title: "New Issue Assigned", body: `New assigned issue: ${issue.title}`, type: "authority_assigned_issue" });
  }
  res.json({ assignedAuthorities: ids });
});

app.get("/api/authority/dashboard", auth, async (req, res) => {
  const db = await initDb();
  const authorityId = s(req.query.authorityId || req.user.uid);
  const channelId = s(req.query.channelId || req.user.channelId);
  const authority = await db.get("SELECT authority_tags_json FROM users WHERE id = ?", authorityId);
  const authorityTags = normalizeAuthorityTags(j(authority?.authority_tags_json, []));
  const rows = await db.all("SELECT * FROM issues WHERE channel_id = ? ORDER BY created_at DESC", channelId);
  const grouped = { open: [], in_progress: [], resolved: [], closed: [] };
  rows.forEach((row) => {
    const category = normalizeIssueCategory(row.category);
    if (req.user.role === "Authority" && !authorityMatchesIssue(row, authorityId, authorityTags, category)) return;
    const key = ["open", "in_progress", "resolved", "closed"].includes(row.status) ? row.status : "open";
    grouped[key].push(toIssue(row));
  });
  res.json(grouped);
});

app.get("/api/authority/personalized-feed", auth, role("Authority"), async (req, res) => {
  const db = await initDb();
  const authorityId = req.user.uid;
  const channelId = s(req.query.channelId || req.user.channelId);
  const status = s(req.query.status || "all");
  const authority = await db.get("SELECT authority_tags_json FROM users WHERE id = ?", authorityId);
  const authorityTags = normalizeAuthorityTags(j(authority?.authority_tags_json, []));

  const rows = await db.all("SELECT * FROM issues WHERE channel_id = ? ORDER BY created_at DESC", channelId);
  const filtered = rows.filter((row) => {
    const category = normalizeIssueCategory(row.category);
    if (status !== "all" && row.status !== status) return false;
    return authorityMatchesIssue(row, authorityId, authorityTags, category);
  });

  res.json({
    items: filtered.map(toIssue),
    authorityTags
  });
});
app.get("/api/head/pending-requests", auth, role("Head"), async (req, res) => {
  const db = await initDb();
  const rows = await db.all(
    `SELECT cr.*, u.name, u.email FROM channel_requests cr JOIN users u ON u.id = cr.user_id
     WHERE cr.channel_id = ? AND cr.request_type = 'authority_join' AND cr.status = 'pending' ORDER BY cr.created_at ASC`,
    req.user.channelId
  );
  res.json(rows.map((r) => ({ requestId: r.id, userId: r.user_id, channelId: r.channel_id, status: r.status, createdAt: r.created_at, name: r.name, email: r.email })));
});

app.post("/api/head/requests/:id/approve", auth, role("Head"), async (req, res) => {
  const db = await initDb();
  const request = await resolveAuthorityRequest(db, req.params.id, req.user.uid, "approve", req.user.channelId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  await notify(db, { userId: request.user_id, title: "Authority Approved", body: "Your authority account has been approved.", type: "authority_approval", screen: "Home" });
  res.json({ ok: true });
});

app.post("/api/head/requests/:id/reject", auth, role("Head"), async (req, res) => {
  const db = await initDb();
  const request = await resolveAuthorityRequest(db, req.params.id, req.user.uid, "reject", req.user.channelId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  res.json({ ok: true });
});

app.get("/api/head/authorities", auth, role("Head"), async (req, res) => {
  const db = await initDb();
  const auths = await db.all("SELECT * FROM users WHERE channel_id = ? AND role = 'Authority' AND status = 'active'", req.user.channelId);
  const issues = await db.all("SELECT * FROM issues WHERE channel_id = ?", req.user.channelId);
  const list = auths.map((a) => {
    const assigned = issues.filter((i) => j(i.assigned_authorities_json, []).includes(a.id));
    return { ...toUser(a), issuesAssigned: assigned.length, resolvedCount: assigned.filter((i) => ["resolved", "closed"].includes(i.status)).length };
  });
  res.json(list);
});

app.post("/api/head/authorities/:id/remove", auth, role("Head"), async (req, res) => {
  const db = await initDb();
  await db.run("UPDATE users SET status = 'removed', channel_id = NULL, updated_at = ? WHERE id = ?", now(), req.params.id);
  res.json({ ok: true });
});

app.get("/api/notifications", auth, async (req, res) => {
  const db = await initDb();
  const rows = await db.all("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100", req.user.uid);
  res.json({ items: rows.map((r) => ({ id: r.id, userId: r.user_id, issueId: r.issue_id, title: r.title, body: r.body, type: r.type, screen: r.screen, read: Boolean(r.read), createdAt: r.created_at, ...j(r.meta_json, {}) })) });
});

app.patch("/api/notifications/:id/read", auth, async (req, res) => {
  const db = await initDb();
  await db.run("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?", req.params.id, req.user.uid);
  res.json({ ok: true });
});

app.patch("/api/notifications/read-by-issue/:issueId", auth, async (req, res) => {
  const db = await initDb();
  await db.run(
    "UPDATE notifications SET read = 1 WHERE user_id = ? AND issue_id = ?",
    req.user.uid,
    req.params.issueId
  );
  res.json({ ok: true });
});

app.get("/api/superadmin/channels", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const channels = await db.all("SELECT * FROM channels ORDER BY created_at DESC");
  const users = await db.all("SELECT * FROM users");
  const issues = await db.all("SELECT * FROM issues");
  const list = channels.map((c) => {
    const channelUsers = users.filter((u) => u.channel_id === c.id);
    const channelIssues = issues.filter((i) => i.channel_id === c.id);
    const resolved = channelIssues.filter((i) => ["resolved", "closed"].includes(i.status)).length;
    return { id: c.id, name: c.name, description: c.description, status: c.status, createdAt: c.created_at, headName: channelUsers.find((u) => u.role === "Head")?.name || "-", userCount: channelUsers.length, issueCount: channelIssues.length, resolutionRate: channelIssues.length ? (resolved / channelIssues.length) * 100 : 0 };
  });
  res.json(list);
});

app.get("/api/superadmin/channels/:id", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const channel = await db.get("SELECT * FROM channels WHERE id = ?", req.params.id);
  if (!channel) return res.status(404).json({ error: "Channel not found" });
  const users = await db.all("SELECT * FROM users WHERE channel_id = ?", channel.id);
  const issues = await db.all("SELECT * FROM issues WHERE channel_id = ?", channel.id);
  res.json({ channel: { id: channel.id, name: channel.name, description: channel.description, status: channel.status, createdAt: channel.created_at }, users: users.map((u) => ({ id: u.id, ...toUser(u) })), issues: issues.map(toIssue) });
});

app.patch("/api/superadmin/channels/:id", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  await db.run("UPDATE channels SET name = ?, description = ?, updated_at = ? WHERE id = ?", s(req.body.name || ""), s(req.body.description || ""), now(), req.params.id);
  res.json({ ok: true });
});

app.post("/api/superadmin/channels/:id/suspend", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  await db.run("UPDATE channels SET status = ?, updated_at = ? WHERE id = ?", req.body.suspend ? "suspended" : "active", now(), req.params.id);
  res.json({ ok: true });
});

app.delete("/api/superadmin/channels/:id", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  await db.run("DELETE FROM issues WHERE channel_id = ?", req.params.id);
  await db.run("DELETE FROM users WHERE channel_id = ?", req.params.id);
  await db.run("DELETE FROM channel_requests WHERE channel_id = ?", req.params.id);
  await db.run("DELETE FROM channels WHERE id = ?", req.params.id);
  res.json({ ok: true });
});
app.get("/api/superadmin/users", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  let rows = await db.all("SELECT * FROM users ORDER BY created_at DESC");
  if (req.query.status && req.query.status !== "all") rows = rows.filter((r) => (r.status || "active") === req.query.status);
  if (req.query.search) {
    const q = String(req.query.search).toLowerCase();
    rows = rows.filter((r) => `${r.name} ${r.email} ${r.role} ${r.channel_id || ""}`.toLowerCase().includes(q));
  }
  res.json(rows.map((r) => ({ id: r.id, ...toUser(r) })));
});

app.post("/api/superadmin/users/:id/suspend", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  await db.run("UPDATE users SET status = 'suspended', updated_at = ? WHERE id = ?", now(), req.params.id);
  await db.run("INSERT OR REPLACE INTO suspended_users (user_id, reason, suspended_by, suspended_at, unsuspend_at) VALUES (?, ?, ?, ?, ?)", req.params.id, s(req.body.reason || "Suspended by SuperAdmin"), req.user.uid, now(), req.body.unsuspendAt || null);
  res.json({ ok: true });
});

app.post("/api/superadmin/users/:id/unsuspend", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  await db.run("UPDATE users SET status = 'active', updated_at = ? WHERE id = ?", now(), req.params.id);
  await db.run("DELETE FROM suspended_users WHERE user_id = ?", req.params.id);
  res.json({ ok: true });
});

app.patch("/api/superadmin/users/:id/role", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  await db.run("UPDATE users SET role = ?, updated_at = ? WHERE id = ?", s(req.body.role), now(), req.params.id);
  res.json({ ok: true });
});

app.delete("/api/superadmin/users/:id", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  await db.run("DELETE FROM comments WHERE user_id = ?", req.params.id);
  await db.run("DELETE FROM notifications WHERE user_id = ?", req.params.id);
  await db.run("DELETE FROM channel_requests WHERE user_id = ?", req.params.id);
  await db.run("DELETE FROM users WHERE id = ?", req.params.id);
  res.json({ ok: true });
});

app.get("/api/superadmin/issues", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  let rows = await db.all("SELECT * FROM issues ORDER BY created_at DESC");
  const status = s(req.query.status || "all");
  const category = s(req.query.category || "all");
  const channelId = s(req.query.channelId || "all");
  const search = s(req.query.search || "").toLowerCase();
  if (status !== "all") rows = rows.filter((r) => r.status === status);
  if (category !== "all") rows = rows.filter((r) => (r.category || "Other") === category);
  if (channelId !== "all") rows = rows.filter((r) => r.channel_id === channelId);
  if (search) rows = rows.filter((r) => `${r.title} ${r.description} ${r.author_name}`.toLowerCase().includes(search));
  res.json({ items: rows.map(toIssue), hasMore: false, page: 1 });
});

app.post("/api/superadmin/issues/:id/status", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const issue = await db.get("SELECT * FROM issues WHERE id = ?", req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  const status = s(req.body.status);
  const reason = s(req.body.reason || "Admin override");
  const history = j(issue.status_history_json, []);
  history.push({ status, changedBy: "SuperAdmin", changedById: req.user.uid, changedAt: now(), note: reason });
  await db.run("UPDATE issues SET status = ?, status_history_json = ?, updated_at = ? WHERE id = ?", status, JSON.stringify(history), now(), issue.id);
  await notify(db, { userId: issue.author_id, issueId: issue.id, title: "Issue Status Updated", body: `SuperAdmin changed status to ${status.replace("_", " ")}.`, type: "issue_status_changed" });
  res.json({ ok: true });
});

app.delete("/api/superadmin/issues/:id", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  await deleteIssueCascade(db, req.params.id);
  res.json({ ok: true });
});

app.get("/api/superadmin/authorities", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  let rows = await db.all("SELECT * FROM users WHERE role = 'Authority'");
  if (req.query.status && req.query.status !== "all") rows = rows.filter((r) => r.status === req.query.status);
  const issues = await db.all("SELECT * FROM issues");
  res.json(rows.map((r) => {
    const assigned = issues.filter((i) => j(i.assigned_authorities_json, []).includes(r.id));
    return { id: r.id, ...toUser(r), issuesAssigned: assigned.length, resolvedCount: assigned.filter((i) => ["resolved", "closed"].includes(i.status)).length, avgResolutionTimeDays: 0 };
  }));
});

app.post("/api/superadmin/authorities/:id/remove", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  await db.run("UPDATE users SET role = 'User', status = 'inactive', updated_at = ? WHERE id = ?", now(), req.params.id);
  res.json({ ok: true });
});

app.get("/api/superadmin/authority-requests", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const rows = await db.all("SELECT * FROM channel_requests WHERE request_type = 'authority_join' AND status = 'pending' ORDER BY created_at ASC");
  res.json(rows.map((r) => ({ id: r.id, userId: r.user_id, channelId: r.channel_id, status: r.status, createdAt: r.created_at })));
});

app.post("/api/superadmin/authority-requests/:id/approve", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const request = await resolveAuthorityRequest(db, req.params.id, req.user.uid, "approve");
  if (!request) return res.status(404).json({ error: "Request not found" });
  res.json({ ok: true });
});

app.post("/api/superadmin/authority-requests/:id/reject", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const request = await resolveAuthorityRequest(db, req.params.id, req.user.uid, "reject");
  if (!request) return res.status(404).json({ error: "Request not found" });
  res.json({ ok: true });
});

app.get("/api/superadmin/analytics", auth, role("SuperAdmin"), async (req, res) => {
  const db = await initDb();
  const channels = await db.all("SELECT * FROM channels");
  const users = await db.all("SELECT * FROM users");
  const issues = await db.all("SELECT * FROM issues");
  const totalIssues = issues.length;
  const resolved = issues.filter((i) => ["resolved", "closed"].includes(i.status)).length;
  const byCategory = {}, byStatus = {}, byChannel = {}, overTime = {};
  issues.forEach((i) => {
    byCategory[i.category || "Other"] = (byCategory[i.category || "Other"] || 0) + 1;
    byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    byChannel[i.channel_id] = (byChannel[i.channel_id] || 0) + 1;
    const k = new Date(i.created_at).toISOString().slice(0, 10);
    overTime[k] = (overTime[k] || 0) + 1;
  });
  const authorityPerformance = users.filter((u) => u.role === "Authority").map((u) => ({ authorityId: u.id, name: u.name, channelId: u.channel_id, resolvedCount: 0, avgResolutionTimeDays: 0 }));
  res.json({
    overview: { totalChannels: channels.length, totalUsers: users.length, totalIssues, totalResolvedIssues: resolved, resolutionRate: totalIssues ? (resolved / totalIssues) * 100 : 0, totalAuthorities: users.filter((u) => u.role === "Authority").length, avgResolutionTimeDays: 0 },
    issuesOverTime: Object.keys(overTime).sort().map((k) => ({ date: k, count: overTime[k] })),
    issuesByCategory: Object.entries(byCategory).map(([name, value]) => ({ name, value })),
    issuesByStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
    issuesByChannel: Object.entries(byChannel).map(([channelId, value]) => ({ channelId, value })),
    authorityPerformance
  });
});

app.post("/api/logs/error", async (req, res) => {
  const db = await initDb();
  await db.run(
    "INSERT INTO logs (id, action, performed_by, target_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id("log"), s(req.body.context || "app_error"), req.body.userId || null, null, JSON.stringify({ message: req.body.message || "", stack: req.body.stack || "" }), now()
  );
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

initDb().then(ensureSuperAdmin).then(() => {
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}).catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
