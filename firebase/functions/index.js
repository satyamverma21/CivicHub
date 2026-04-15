const { v2: speechV2 } = require("@google-cloud/speech");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();

const db = getFirestore();
const storage = getStorage();
const messaging = getMessaging();
const speechClient = new speechV2.SpeechClient();

const AUTHORITY_KEYWORDS = {
  pothole: ["pothole", "crater", "road damage", "road broken"],
  water: ["water", "leak", "pipe", "drain", "sewage", "flood"],
  electricity: ["electricity", "power", "outage", "wire", "transformer"],
  roads: ["road", "roads", "street", "traffic", "bridge", "pavement"],
  waste: ["waste", "garbage", "trash", "dump", "sanitation"],
  health: ["health", "hospital", "clinic", "medical", "ambulance"],
  other: []
};

function sanitize(value) {
  return (value || "").trim();
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function isAuthed(request) {
  return Boolean(request.auth && request.auth.uid);
}

async function callClaude(systemPrompt, userText, maxTokens = 300) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-3-5-haiku-latest",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const content = payload?.content || [];
  const text = content.map((item) => item?.text || "").join("\n").trim();
  return text;
}

function extractKeywords(text) {
  const normalized = sanitize(text).toLowerCase();
  if (!normalized) {
    return [];
  }

  const words = [];
  Object.values(AUTHORITY_KEYWORDS).forEach((terms) => {
    terms.forEach((term) => {
      if (normalized.includes(term)) {
        words.push(term);
      }
    });
  });

  return unique(words).slice(0, 15);
}

function sentenceBoundedSummary(text) {
  const cleaned = sanitize(text);
  const chunks = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((item) => sanitize(item))
    .filter(Boolean)
    .slice(0, 2);

  if (chunks.length === 0) {
    return cleaned;
  }
  return chunks.join(" ");
}

function mapKeywordsToCategories(keywords) {
  const set = new Set((keywords || []).map((item) => item.toLowerCase()));
  const categories = [];
  Object.entries(AUTHORITY_KEYWORDS).forEach(([category, terms]) => {
    if (terms.some((term) => set.has(term))) {
      categories.push(category);
    }
  });
  return categories.length > 0 ? categories : ["other"];
}

async function getTranscriptionFromStoragePath(audioPath) {
  const bucket = storage.bucket();
  const [audioBuffer] = await bucket.file(audioPath).download();

  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const recognizer = `projects/${projectId}/locations/global/recognizers/_`;

  const [response] = await speechClient.recognize({
    recognizer,
    config: {
      autoDecodingConfig: {},
      languageCodes: ["en-US"],
      model: "long"
    },
    content: audioBuffer.toString("base64")
  });

  const results = response?.results || [];
  return results
    .map((result) => result?.alternatives?.[0]?.transcript || "")
    .join(" ")
    .trim();
}

async function suggestAuthoritiesInternal(channelId, keywords = [], categories = []) {
  if (!channelId) {
    return [];
  }

  const authoritiesSnap = await db
    .collection("users")
    .where("channelId", "==", channelId)
    .where("role", "==", "Authority")
    .where("status", "==", "active")
    .get();

  const allAuthorities = authoritiesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  if (allAuthorities.length === 0) {
    return [];
  }

  const lowerKeywords = (keywords || []).map((item) => item.toLowerCase());
  const inferred = categories.length > 0 ? categories : mapKeywordsToCategories(keywords);

  const matches = allAuthorities.filter((authority) => {
    const haystack = [
      authority.name,
      authority.email,
      authority.department,
      authority.expertise,
      Array.isArray(authority.categories) ? authority.categories.join(" ") : ""
    ]
      .join(" ")
      .toLowerCase();

    const keywordMatched = lowerKeywords.some((keyword) => haystack.includes(keyword));
    const categoryMatched = inferred.some((category) => haystack.includes(category));
    return keywordMatched || categoryMatched;
  });

  const selected = matches.length > 0 ? matches : allAuthorities;
  return selected.slice(0, 6).map((item) => ({ id: item.id, name: item.name || item.email || "Authority" }));
}

async function updateSpeechUsage(durationMillis) {
  if (!durationMillis || durationMillis <= 0) {
    return "";
  }

  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const usageRef = db.collection("logs").doc(`speech_usage_${monthKey}`);

  const seconds = Math.round(durationMillis / 1000);
  await usageRef.set(
    {
      monthKey,
      totalSeconds: FieldValue.increment(seconds),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const snap = await usageRef.get();
  const totalSeconds = Number(snap.data()?.totalSeconds || 0);
  const freeTierSeconds = 60 * 60;

  if (totalSeconds >= freeTierSeconds) {
    return "Google Speech free-tier limit (60 min/month) may be exceeded.";
  }
  if (totalSeconds >= 55 * 60) {
    return "Google Speech free-tier is near limit (about 60 min/month).";
  }
  return "";
}

exports.processVoiceIssue = onCall({ timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  if (!isAuthed(request)) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const audioPath = sanitize(request.data?.audioPath);
  const channelId = sanitize(request.data?.channelId);
  const durationMillis = Number(request.data?.durationMillis || 0);

  if (!audioPath) {
    throw new HttpsError("invalid-argument", "audioPath is required.");
  }

  try {
    const transcription = await getTranscriptionFromStoragePath(audioPath);
    if (!transcription) {
      throw new HttpsError("failed-precondition", "Transcription is empty.");
    }

    let refined = transcription;
    let summaryRaw = "";
    let usageWarning = await updateSpeechUsage(durationMillis);

    try {
      refined = await callClaude(
        "You are a text refinement assistant. Take messy transcribed text and clean it up while preserving meaning. Fix grammar, punctuation, capitalization. Remove filler words. Break into coherent sentences. Return only refined text, no explanations.",
        transcription,
        500
      );
    } catch (error) {
      usageWarning = unique([
        usageWarning,
        "AI refinement unavailable right now. You can manually edit the transcription."
      ]).join(" ");
    }

    try {
      summaryRaw = await callClaude(
        "Summarize this community issue report in 1-2 sentences, focusing on the problem and location.",
        refined,
        160
      );
    } catch (error) {
      usageWarning = unique([
        usageWarning,
        "Summary generation unavailable. You can write summary manually."
      ]).join(" ");
    }

    const summary = sentenceBoundedSummary(summaryRaw);
    const keywords = extractKeywords(refined);
    const suggestedAuthorities = await suggestAuthoritiesInternal(channelId, keywords, []);

    return {
      transcription,
      refined,
      summary,
      keywords,
      suggestedAuthorities,
      usageWarning
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error?.message || "Failed to process voice issue.");
  }
});

exports.refineIssueText = onCall(async (request) => {
  if (!isAuthed(request)) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const text = sanitize(request.data?.text);
  if (!text) {
    throw new HttpsError("invalid-argument", "Text is required.");
  }

  const refined = await callClaude(
    "You are a text refinement assistant. Take messy transcribed text and clean it up while preserving meaning. Fix grammar, punctuation, capitalization. Remove filler words. Break into coherent sentences. Return only refined text, no explanations.",
    text,
    500
  );

  return { refined };
});

exports.generateIssueSummary = onCall(async (request) => {
  if (!isAuthed(request)) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const text = sanitize(request.data?.text);
  if (!text) {
    throw new HttpsError("invalid-argument", "Text is required.");
  }

  const summaryRaw = await callClaude(
    "Summarize this community issue report in 1-2 sentences, focusing on the problem and location.",
    text,
    160
  );
  return { summary: sentenceBoundedSummary(summaryRaw) };
});

exports.suggestAuthoritiesByKeywords = onCall(async (request) => {
  if (!isAuthed(request)) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const channelId = sanitize(request.data?.channelId);
  const keywords = unique(request.data?.keywords || []);
  const categories = unique(request.data?.categories || []);

  if (!channelId) {
    throw new HttpsError("invalid-argument", "channelId is required.");
  }

  const authorities = await suggestAuthoritiesInternal(channelId, keywords, categories);
  return { authorities };
});

exports.sendNotificationPush = onDocumentCreated("notifications/{notificationId}", async (event) => {
  const data = event.data?.data();
  if (!data?.userId) {
    return;
  }

  const userSnap = await db.collection("users").doc(data.userId).get();
  if (!userSnap.exists) {
    return;
  }
  const user = userSnap.data();
  const settings = user.notificationSettings || {};
  if (settings.all === false) {
    return;
  }
  const typeMap = {
    new_issue_channel: "newIssue",
    reporter_comment: "comment",
    authority_assigned_issue: "assignment",
    issue_status_changed: "status",
    progress_update: "progress",
    authority_approval: "approval"
  };
  const settingKey = typeMap[data.type];
  if (settingKey && settings[settingKey] === false) {
    return;
  }

  if (user.fcmToken) {
    await messaging.send({
      token: user.fcmToken,
      notification: {
        title: data.title || "Community App",
        body: data.body || "You have a new update."
      },
      data: {
        issueId: data.issueId || "",
        screen: data.screen || ""
      }
    });
  }

  if (user.expoPushToken) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        to: user.expoPushToken,
        title: data.title || "Community App",
        body: data.body || "You have a new update.",
        data: {
          issueId: data.issueId || "",
          screen: data.screen || ""
        }
      })
    });
  }
});
