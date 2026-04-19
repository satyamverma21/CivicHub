import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Picker } from "@react-native-picker/picker";
import AuthInput from "../components/AuthInput";
import ImageCarousel from "../components/ImageCarousel";
import { ISSUE_rCATEGORIES, createIssue, reverseGeocodeCoordinates } from "../services/issues";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function CreateIssueScreen({ navigation }) {
  const { currentUser, channelId, showErrorToast, showSuccessToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState("");
  const [locationMode, setLocationMode] = useState("manual");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loading, setLoading] = useState(false);

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
        selectionLimit: 5,
        quality: 0.85
      });
      if (result.canceled) {
        return;
      }
      const picked = result.assets || [];
      if (picked.length + images.length > 5) {
        throw new Error("Only up to 5 images are allowed.");
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

  const onCreate = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      const issueId = await createIssue(
        title,
        description,
        images,
        category || null,
        currentUser,
        channelId,
        { location }
      );
      showSuccessToast("Complaint submitted successfully.");
      navigation.navigate("Feed", { createdIssueId: issueId });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  };

  const detectLocation = async () => {
    if (loadingLocation) return;
    setLoadingLocation(true);
    try {
      const geolocation = globalThis?.navigator?.geolocation;
      if (!geolocation) {
        throw new Error("Automatic location is not available on this device.");
      }

      const position = await new Promise((resolve, reject) => {
        geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        });
      });
      const address = await reverseGeocodeCoordinates(position.coords.latitude, position.coords.longitude);
      setLocation(address);
      setLocationMode("auto");
      showSuccessToast("Location captured.");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoadingLocation(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5, marginBottom: 20 }}>
        File College Complaint
      </Text>

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
          placeholder="Complaint title"
          label="Complaint Title"
          maxLength={100}
        />

        <AuthInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the complaint with location, impact, and timeline..."
          label="Complaint Details"
          multiline
          maxLength={5000}
        />

        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 8, marginLeft: 2 }}>
          Location
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <Pressable
            onPress={() => setLocationMode("manual")}
            style={{
              flex: 1,
              borderRadius: 10,
              paddingVertical: 11,
              borderWidth: 1.5,
              borderColor: locationMode === "manual" ? colors.primary : colors.border,
              backgroundColor: locationMode === "manual" ? colors.primaryLight : colors.surface
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "600", color: locationMode === "manual" ? colors.primary : colors.text }}>
              Enter Manually
            </Text>
          </Pressable>
          <Pressable
            onPress={detectLocation}
            style={{
              flex: 1,
              borderRadius: 10,
              paddingVertical: 11,
              borderWidth: 1.5,
              borderColor: locationMode === "auto" ? colors.primary : colors.border,
              backgroundColor: locationMode === "auto" ? colors.primaryLight : colors.surface,
              opacity: loadingLocation ? 0.7 : 1
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "600", color: locationMode === "auto" ? colors.primary : colors.text }}>
              {loadingLocation ? "Detecting..." : "Auto Detect"}
            </Text>
          </Pressable>
        </View>
        <AuthInput
          value={location}
          onChangeText={setLocation}
          placeholder="e.g., Block A, 2nd floor near lab"
          label={locationMode === "auto" ? "Detected Location (editable)" : "Manual Location (optional)"}
          maxLength={220}
          autoCapitalize="words"
        />
      </View>

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
          Department Category (optional)
        </Text>
        <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
          <Picker selectedValue={category} onValueChange={(value) => setCategory(value)} style={{ color: colors.text }}>
            <Picker.Item label="Select Department" value="" />
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
            Attach Images (max 5)
          </Text>
        </Pressable>

        {images.length > 0 ? (
          <ImageCarousel
            images={images}
            resolveImageUri={(asset) => asset?.uri || ""}
            onRemoveImage={(index) => removeImage(index)}
            height={180}
          />
        ) : null}
      </View>

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
            Submit Complaint
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
