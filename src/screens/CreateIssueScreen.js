import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Picker } from "@react-native-picker/picker";
import AudioRecorder from "../components/AudioRecorder";
import AuthInput from "../components/AuthInput";
import AuthorityTagList from "../components/AuthorityTagList";
import RefinementPreview from "../components/RefinementPreview";
import VoiceToTextButton from "../components/VoiceToTextButton";
import { ISSUE_CATEGORIES, createIssue, getActiveAuthorities } from "../services/issues";
import { maybeWarnUsage, processVoiceIssue } from "../services/voice";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function normalize(value) {
  return (value || "").trim();
}

export default function CreateIssueScreen({ navigation }) {
  const { currentUser, channelId, showErrorToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const [recorderVisible, setRecorderVisible] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceTranscription, setVoiceTranscription] = useState("");
  const [refinedText, setRefinedText] = useState("");
  const [summary, setSummary] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [audioUrl, setAudioUrl] = useState("");
  const [keepAiRefinedLabel, setKeepAiRefinedLabel] = useState(true);

  const [authorities, setAuthorities] = useState([]);
  const [suggestedAuthorityIds, setSuggestedAuthorityIds] = useState([]);
  const [selectedAuthorityIds, setSelectedAuthorityIds] = useState([]);

  useEffect(() => {
    let active = true;

    const loadAuthorities = async () => {
      if (!channelId) {
        return;
      }
      try {
        const data = await getActiveAuthorities(channelId);
        if (!active) {
          return;
        }
        setAuthorities(data);
      } catch (error) {
        console.log("Failed to load authorities", error?.message);
      }
    };

    loadAuthorities();
    return () => {
      active = false;
    };
  }, [channelId]);

  const requestPermission = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Photo permission is required.");
    }
  };

  const ensureSize = async (asset) => {
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      throw new Error(`${asset.fileName || "Image"} is larger than 5MB.`);
    }
    if (!asset.fileSize) {
      const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
      if (info.size && info.size > 5 * 1024 * 1024) {
        throw new Error(`${asset.fileName || "Image"} is larger than 5MB.`);
      }
    }
  };

  const pickImages = async () => {
    try {
      await requestPermission();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 3,
        quality: 0.85
      });
      if (result.canceled) {
        return;
      }
      const picked = result.assets || [];
      if (picked.length + images.length > 3) {
        throw new Error("Only up to 3 images are allowed.");
      }
      for (const asset of picked) {
        await ensureSize(asset);
      }
      setImages((prev) => [...prev, ...picked]);
    } catch (error) {
      showErrorToast(error);
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const onVoiceComplete = async (recordedAudio) => {
    setRecorderVisible(false);
    setTranscribing(true);
    try {
      const response = await processVoiceIssue(recordedAudio, channelId, currentUser?.uid);
      if (!normalize(response.transcription)) {
        throw new Error("Transcription returned empty text. Please type manually or record again.");
      }
      maybeWarnUsage(response.usageWarning);
      setVoiceTranscription(response.transcription);
      setRefinedText(response.refined || response.transcription);
      setDescription(response.refined || response.transcription);
      setSummary(response.summary || "");
      setKeywords(response.keywords || []);
      setAudioUrl(response.audioUrl || "");
      const nextSuggested = (response.suggestedAuthorities || []).map((item) => item.id);
      setSuggestedAuthorityIds(nextSuggested);
      setSelectedAuthorityIds(nextSuggested);
      setKeepAiRefinedLabel(true);
    } catch (error) {
      Alert.alert(
        "Transcription failed",
        "Could not process this audio. You can retry recording or type the issue manually."
      );
      console.log("Voice processing failed", error?.message);
    } finally {
      setTranscribing(false);
    }
  };

  const onCreate = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      const isVoiceReport = Boolean(normalize(audioUrl));
      const userEditedRefined = normalize(description) !== normalize(refinedText);
      const issueId = await createIssue(
        title,
        description,
        images,
        category || null,
        currentUser,
        channelId,
        {
          audioUrl: isVoiceReport ? audioUrl : null,
          isAIRefined: isVoiceReport ? keepAiRefinedLabel : false,
          aiSummary: isVoiceReport ? normalize(summary) : "",
          refinedBy: isVoiceReport ? (userEditedRefined ? "both" : "ai") : "user",
          keywords,
          manualAssignedAuthorities: isVoiceReport ? selectedAuthorityIds : null,
          isVoiceReport
        }
      );
      Alert.alert("Success", "Issue reported successfully.");
      navigation.navigate("Feed", { createdIssueId: issueId });
    } catch (error) {
      const uploadError = error?.message?.toLowerCase().includes("upload") ||
        error?.message?.toLowerCase().includes("network");
      if (uploadError) {
        Alert.alert("Upload failed", "Image upload failed. Retry?", [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: () => onCreate() }
        ]);
      } else {
        showErrorToast(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const isVoiceReport = useMemo(() => Boolean(normalize(audioUrl)), [audioUrl]);

  const toggleAuthority = (authorityId) => {
    setSelectedAuthorityIds((prev) =>
      prev.includes(authorityId) ? prev.filter((id) => id !== authorityId) : [...prev, authorityId]
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5, marginBottom: 20 }}>
        Report Issue
      </Text>

      {/* Form Card */}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 20,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.md || {})
      }}>
        <AuthInput
          value={title}
          onChangeText={setTitle}
          placeholder="What's the issue?"
          label="Title"
          maxLength={100}
        />

        <AuthInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the issue in detail..."
          label="Description"
          multiline
          maxLength={5000}
        />
      </View>

      {/* Voice Section */}
      <VoiceToTextButton onPress={() => setRecorderVisible(true)} disabled={transcribing || loading} />

      {transcribing ? (
        <View style={{
          marginTop: 14,
          backgroundColor: colors.surfaceAlt,
          borderRadius: 16,
          padding: 20,
          alignItems: "center"
        }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ textAlign: "center", marginTop: 10, fontWeight: "600", color: colors.text }}>
            Transcribing audio...
          </Text>
        </View>
      ) : null}

      <RefinementPreview
        transcription={voiceTranscription}
        refined={refinedText}
        summary={summary}
        onSummaryChange={setSummary}
      />

      {isVoiceReport ? (
        <Pressable
          onPress={() => setKeepAiRefinedLabel((prev) => !prev)}
          style={{
            marginTop: 12,
            borderRadius: 12,
            padding: 14,
            backgroundColor: keepAiRefinedLabel ? colors.accentLight : colors.surface,
            borderWidth: 1.5,
            borderColor: keepAiRefinedLabel ? colors.accent : colors.border
          }}
        >
          <Text style={{ fontWeight: "600", color: keepAiRefinedLabel ? colors.accent : colors.text, fontSize: 14 }}>
            {keepAiRefinedLabel ? "✓ AI-refined label enabled" : "AI-refined label disabled"}
          </Text>
        </Pressable>
      ) : null}

      {isVoiceReport ? (
        <AuthorityTagList
          selectedAuthorities={selectedAuthorityIds}
          suggestedAuthorityIds={suggestedAuthorityIds}
          allAuthorities={authorities}
          onToggle={toggleAuthority}
        />
      ) : null}

      {/* Category & Images Card */}
      <View style={{
        marginTop: 14,
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 20,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.md || {})
      }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6, marginLeft: 2 }}>
          Category (optional)
        </Text>
        <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
          <Picker selectedValue={category} onValueChange={(value) => setCategory(value)} style={{ color: colors.text }}>
            <Picker.Item label="Select Category" value="" />
            {ISSUE_CATEGORIES.map((item) => (
              <Picker.Item key={item} label={item} value={item} />
            ))}
          </Picker>
        </View>

        <Pressable
          onPress={pickImages}
          style={{
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 12,
            paddingVertical: 14,
            marginTop: 14,
            backgroundColor: colors.surfaceAlt
          }}
        >
          <Text style={{ textAlign: "center", fontWeight: "600", color: colors.primary, fontSize: 14 }}>
            📷 Attach Images (max 3)
          </Text>
        </Pressable>

        {images.length > 0 ? (
          <ScrollView horizontal style={{ marginTop: 14 }} showsHorizontalScrollIndicator={false}>
            {images.map((asset, index) => (
              <View key={`${asset.uri}-${index}`} style={{ marginRight: 10 }}>
                <Image
                  source={{ uri: asset.uri }}
                  style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: colors.surfaceAlt }}
                />
                <Pressable onPress={() => removeImage(index)} style={{ marginTop: 6 }}>
                  <Text style={{ color: colors.danger, fontWeight: "600", textAlign: "center", fontSize: 13 }}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {/* Submit */}
      <Pressable
        onPress={onCreate}
        style={{
          marginTop: 20,
          backgroundColor: colors.accent,
          borderRadius: 14,
          paddingVertical: 16,
          opacity: loading ? 0.6 : 1
        }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={{ color: "#FFFFFF", fontWeight: "700", textAlign: "center", fontSize: 17 }}>
            Submit Issue Report
          </Text>
        )}
      </Pressable>

      <AudioRecorder
        visible={recorderVisible}
        onCancel={() => setRecorderVisible(false)}
        onComplete={onVoiceComplete}
        onError={(error) => {
          setRecorderVisible(false);
          if ((error?.message || "").toLowerCase().includes("permission")) {
            Alert.alert("Permission needed", "Microphone permission is required to record an issue.");
            return;
          }
          showErrorToast(error);
        }}
      />
    </ScrollView>
  );
}
