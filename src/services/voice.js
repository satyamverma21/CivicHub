import { Alert, Platform } from "react-native";
import { Audio } from "expo-av";
import { apiGet, apiPostForm } from "./api";

const MAX_AUDIO_DURATION_MS = 5 * 60 * 1000;

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
  const formData = new FormData();
  formData.append("audio", {
    uri: audioBlob.uri,
    name: `${issueId || Date.now()}.m4a`,
    type: "audio/m4a"
  });
  formData.append("fallbackText", "");

  const result = await apiPostForm("/api/voice/process", formData);
  return { url: result.audioUrl || "", path: result.audioUrl || "" };
}

export async function refineText(text) {
  return sanitize(text);
}

export async function generateSummary(text) {
  const body = sanitize(text);
  return body.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
}

export function extractKeywords(text) {
  const normalized = sanitize(text).toLowerCase();
  if (!normalized) {
    return [];
  }

  const words = ["pothole", "water", "electricity", "road", "waste", "health", "drain", "garbage"];
  return unique(words.filter((word) => normalized.includes(word)));
}

export async function suggestAuthorities(keywords, channelId) {
  if (!channelId) return [];
  const response = await apiGet(`/api/authorities/active?channelId=${encodeURIComponent(channelId)}`).catch(() => []);
  const terms = (keywords || []).map((item) => item.toLowerCase());
  return response.filter((item) => {
    const haystack = `${item.name || ""} ${item.email || ""}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
}

export async function processVoiceIssue(audioBlob, channelId) {
  const formData = new FormData();
  formData.append("audio", {
    uri: audioBlob.uri,
    name: `${Date.now()}.m4a`,
    type: "audio/m4a"
  });
  formData.append("channelId", channelId || "");
  formData.append("durationMillis", String(Number(audioBlob?.durationMillis || 0)));

  const data = await apiPostForm("/api/voice/process", formData);
  return {
    audioUrl: sanitize(data.audioUrl),
    audioPath: sanitize(data.audioUrl),
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
