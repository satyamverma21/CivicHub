import { Alert, Platform } from "react-native";
import { Audio } from "expo-av";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, functions, storage } from "./firebase";

const MAX_AUDIO_DURATION_MS = 5 * 60 * 1000;

const KEYWORD_MAP = {
  pothole: ["pothole", "potholes", "crater", "road damage"],
  water: ["water", "leak", "pipeline", "drain", "sewage", "flood"],
  electricity: ["electricity", "power", "outage", "wire", "transformer", "pole"],
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

export function getAudioDurationLimitMs() {
  return MAX_AUDIO_DURATION_MS;
}

export async function requestMicrophonePermission() {
  const permission = await Audio.requestPermissionsAsync();
  if (!permission?.granted) {
    throw new Error("Microphone permission denied. Enable it to record an issue.");
  }

  if (Platform.OS === "android") {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false
    });
  }

  return true;
}

export async function startAudioRecording() {
  await requestMicrophonePermission();

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync({
    android: {
      extension: ".m4a",
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000
    },
    ios: {
      extension: ".m4a",
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC
    },
    web: {
      mimeType: "audio/webm",
      bitsPerSecond: 128000
    },
    isMeteringEnabled: true
  });

  await recording.startAsync();
  return recording;
}

export async function stopAudioRecording(recording) {
  if (!recording) {
    throw new Error("No active recording found.");
  }

  await recording.stopAndUnloadAsync();
  const status = await recording.getStatusAsync();
  const uri = recording.getURI();
  if (!uri) {
    throw new Error("Recording failed. Please try again.");
  }

  const blobResponse = await fetch(uri);
  const blob = await blobResponse.blob();

  return {
    uri,
    blob,
    durationMillis: Number(status?.durationMillis || 0),
    metering: Number(status?.metering || -160)
  };
}

export async function uploadAudioToStorage(audioBlob, issueId) {
  if (!audioBlob || !issueId) {
    throw new Error("Audio and issue id are required.");
  }

  const ext = audioBlob?.uri?.endsWith(".webm") ? "webm" : "m4a";
  const path = `issues/${issueId}/voice/${Date.now()}.${ext}`;
  const objectRef = ref(storage, path);

  let blob = audioBlob;
  if (audioBlob?.uri) {
    const response = await fetch(audioBlob.uri);
    blob = await response.blob();
  }

  await uploadBytes(objectRef, blob, {
    contentType: ext === "webm" ? "audio/webm" : "audio/mp4"
  });

  const url = await getDownloadURL(objectRef);
  return { url, path };
}

export async function refineText(text) {
  const callable = httpsCallable(functions, "refineIssueText");
  const response = await callable({ text: sanitize(text) });
  return sanitize(response?.data?.refined);
}

export async function generateSummary(text) {
  const callable = httpsCallable(functions, "generateIssueSummary");
  const response = await callable({ text: sanitize(text) });
  return sanitize(response?.data?.summary);
}

export function extractKeywords(text) {
  const normalized = sanitize(text).toLowerCase();
  if (!normalized) {
    return [];
  }

  const keywords = [];
  Object.values(KEYWORD_MAP).forEach((terms) => {
    terms.forEach((term) => {
      if (normalized.includes(term)) {
        keywords.push(term);
      }
    });
  });

  return unique(keywords).slice(0, 12);
}

function inferCategories(keywords) {
  const categories = new Set();
  const keywordSet = new Set((keywords || []).map((item) => item.toLowerCase()));

  Object.entries(KEYWORD_MAP).forEach(([category, words]) => {
    if (words.some((word) => keywordSet.has(word))) {
      categories.add(category);
    }
  });

  if (categories.size === 0) {
    categories.add("other");
  }

  return Array.from(categories);
}

export async function suggestAuthorities(keywords, channelId) {
  if (!channelId) {
    return [];
  }

  const categories = inferCategories(keywords);
  const channelAuthoritiesRef = doc(db, "channels", channelId);
  await getDoc(channelAuthoritiesRef);

  const callable = httpsCallable(functions, "suggestAuthoritiesByKeywords");
  const response = await callable({ keywords, channelId, categories });
  return response?.data?.authorities || [];
}

export async function processVoiceIssue(audioBlob, channelId, actorId = "anonymous") {
  const callable = httpsCallable(functions, "processVoiceIssue");
  const draftId = `draft-${actorId}-${Date.now()}`;
  const uploaded = await uploadAudioToStorage(audioBlob, draftId);

  const response = await callable({
    audioPath: uploaded.path,
    channelId,
    durationMillis: Number(audioBlob?.durationMillis || 0)
  });

  const data = response?.data || {};
  return {
    audioUrl: uploaded.url,
    audioPath: uploaded.path,
    transcription: sanitize(data.transcription),
    refined: sanitize(data.refined),
    summary: sanitize(data.summary),
    keywords: unique(data.keywords || []),
    suggestedAuthorities: data.suggestedAuthorities || [],
    usageWarning: sanitize(data.usageWarning)
  };
}

export function validateVoiceDuration(durationMillis) {
  if (durationMillis > MAX_AUDIO_DURATION_MS) {
    throw new Error("Audio exceeds the 5 minute limit. Please record a shorter clip.");
  }
  if (durationMillis < 1500) {
    throw new Error("Audio is too short. Please record a clearer issue description.");
  }
}

export function maybeWarnUsage(usageWarning) {
  const warning = sanitize(usageWarning);
  if (warning) {
    Alert.alert("Speech quota warning", warning);
  }
}
