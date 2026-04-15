import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Picker } from "@react-native-picker/picker";
import AudioRecorder from "../components/AudioRecorder";
import AuthorityTagList from "../components/AuthorityTagList";
import RefinementPreview from "../components/RefinementPreview";
import VoiceToTextButton from "../components/VoiceToTextButton";
import { ISSUE_CATEGORIES, createIssue, getActiveAuthorities } from "../services/issues";
import { maybeWarnUsage, processVoiceIssue } from "../services/voice";
import { useAuth } from "../context/AuthContext";

function normalize(value) {
  return (value || "").trim();
}

export default function CreateIssueScreen({ navigation }) {
  const { currentUser, channelId, showErrorToast } = useAuth();
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
        // eslint-disable-next-line no-await-in-loop
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
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 14 }}>Create Issue</Text>

      <Text style={{ fontWeight: "600", marginBottom: 6 }}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Enter issue title"
        maxLength={100}
        style={{
          borderWidth: 1,
          borderColor: "#D0D7DE",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          backgroundColor: "#FFFFFF"
        }}
      />

      <Text style={{ fontWeight: "600", marginBottom: 6 }}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the issue"
        multiline
        textAlignVertical="top"
        maxLength={5000}
        style={{
          minHeight: 140,
          borderWidth: 1,
          borderColor: "#D0D7DE",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          backgroundColor: "#FFFFFF"
        }}
      />

      <VoiceToTextButton onPress={() => setRecorderVisible(true)} disabled={transcribing || loading} />

      {transcribing ? (
        <View style={{ marginTop: 12, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 12 }}>
          <ActivityIndicator />
          <Text style={{ textAlign: "center", marginTop: 8, fontWeight: "600" }}>Transcribing...</Text>
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
            marginTop: 10,
            borderWidth: 1,
            borderColor: "#D0D7DE",
            borderRadius: 8,
            padding: 10,
            backgroundColor: "#FFFFFF"
          }}
        >
          <Text style={{ fontWeight: "600" }}>
            {keepAiRefinedLabel ? "AI-refined label enabled" : "AI-refined label disabled"}
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

      <Text style={{ fontWeight: "600", marginBottom: 6, marginTop: 12 }}>Category (optional)</Text>
      <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, backgroundColor: "#FFFFFF" }}>
        <Picker selectedValue={category} onValueChange={(value) => setCategory(value)}>
          <Picker.Item label="Select Category" value="" />
          {ISSUE_CATEGORIES.map((item) => (
            <Picker.Item key={item} label={item} value={item} />
          ))}
        </Picker>
      </View>

      <Pressable
        onPress={pickImages}
        style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 12, marginTop: 12 }}
      >
        <Text style={{ textAlign: "center", fontWeight: "600" }}>Pick Images (max 3)</Text>
      </Pressable>

      {images.length > 0 ? (
        <ScrollView horizontal style={{ marginTop: 12 }} showsHorizontalScrollIndicator={false}>
          {images.map((asset, index) => (
            <View key={`${asset.uri}-${index}`} style={{ marginRight: 10 }}>
              <Image
                source={{ uri: asset.uri }}
                style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: "#EEF2F6" }}
              />
              <Pressable onPress={() => removeImage(index)} style={{ marginTop: 4 }}>
                <Text style={{ color: "#CF222E", fontWeight: "600", textAlign: "center" }}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <Pressable
        onPress={onCreate}
        style={{
          marginTop: 18,
          backgroundColor: "#0969DA",
          borderRadius: 8,
          padding: 14,
          opacity: loading ? 0.6 : 1
        }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={{ color: "#FFFFFF", fontWeight: "700", textAlign: "center" }}>Create Issue</Text>
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
