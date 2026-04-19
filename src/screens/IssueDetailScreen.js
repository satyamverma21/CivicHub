import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Picker } from "@react-native-picker/picker";
import CategoryBadge from "../components/CategoryBadge";
import CommentItem from "../components/CommentItem";
import ImageCarousel from "../components/ImageCarousel";
import StatusBadge from "../components/StatusBadge";
import {
  ISSUE_CATEGORIES,
  addComment,
  addProgressUpdate,
  deleteIssue,
  absoluteUploadUrl,
  formatTimestamp,
  getComments,
  getIssueById,
  markIssueNotificationsRead,
  getProgressUpdates,
  getStatusHistory,
  likeIssue,
  updateIssue,
} from "../services/issues";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { inputStyle, inputFocusStyle } from "../styles";

export default function IssueDetailScreen({ route, navigation }) {
  const { issueId } = route.params;
  const { currentUser, userRole, showErrorToast, showSuccessToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const [addingProgress, setAddingProgress] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressImages, setProgressImages] = useState([]);
  const [savingProgress, setSavingProgress] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editExistingImages, setEditExistingImages] = useState([]);
  const [editNewImages, setEditNewImages] = useState([]);

  const [deletingIssue, setDeletingIssue] = useState(false);
  const roleKey = String(userRole || currentUser?.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  const editPreviewImages = useMemo(() => ([
    ...editExistingImages.map((uri, index) => ({ kind: "existing", uri, listIndex: index })),
    ...editNewImages.map((asset, index) => ({ kind: "new", asset, listIndex: index }))
  ]), [editExistingImages, editNewImages]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [issueData, commentData, historyData, progressData] = await Promise.all([
        getIssueById(issueId),
        getComments(issueId),
        getStatusHistory(issueId),
        getProgressUpdates(issueId)
      ]);

      setIssue(issueData);
      setComments(commentData);
      setStatusHistory(historyData);
      setProgressUpdates(progressData);

      setEditTitle(issueData?.title || "");
      setEditDescription(issueData?.description || "");
      setEditCategory(issueData?.category || "");
      setEditLocation(issueData?.location || "");
      setEditExistingImages(Array.isArray(issueData?.images) ? issueData.images : []);
      setEditNewImages([]);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [issueId, showErrorToast]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return undefined;
    }, [loadData])
  );

  useEffect(() => {
    markIssueNotificationsRead(issueId).catch(showErrorToast);
  }, [issueId, showErrorToast]);

  const isAssignedAuthority = useMemo(
    () => Array.isArray(issue?.assignedAuthorities) && issue.assignedAuthorities.includes(currentUser?.uid),
    [issue, currentUser?.uid]
  );

  const isAuthor = issue?.authorId === currentUser?.uid;
  const canDeleteIssue = isAuthor || ["head", "superadmin", "admin"].includes(roleKey);
  const canManageIssue = ["head", "superadmin"].includes(roleKey) || isAssignedAuthority;
  const canUpdateStatus = canManageIssue;
  const canAddProgress = roleKey === "authority" && isAssignedAuthority;
  const canViewSolutionsPanel = ["authority", "head", "superadmin", "admin"].includes(roleKey);
  const canViewManagementPanel = canUpdateStatus || ["head", "superadmin"].includes(roleKey);
  const liked = Array.isArray(issue?.likes) && issue?.likes.includes(currentUser?.uid);

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

  const onLike = async () => {
    try {
      await likeIssue(issueId, currentUser.uid);
      await loadData();
    } catch (error) {
      showErrorToast(error);
    }
  };

  const onSendComment = async () => {
    if (sendingComment) return;
    setSendingComment(true);
    try {
      await addComment(issueId, currentUser.uid, commentText);
      setCommentText("");
      await loadData();
    } catch (error) {
      showErrorToast(new Error("Failed to add comment. Please try again."));
      console.log(error);
    } finally {
      setSendingComment(false);
    }
  };

  const pickProgressImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Photo permission is required.");
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 2,
        quality: 0.85
      });
      if (result.canceled) return;
      const picked = result.assets || [];
      if (picked.length + progressImages.length > 2) {
        throw new Error("Only up to 2 images are allowed.");
      }
      for (const asset of picked) {
        // eslint-disable-next-line no-await-in-loop
        await ensureSize(asset);
      }
      setProgressImages((prev) => [...prev, ...picked]);
    } catch (error) {
      showErrorToast(error);
    }
  };

  const pickEditImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Photo permission is required.");
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.85
      });
      if (result.canceled) return;
      const picked = result.assets || [];
      if (picked.length + editNewImages.length + editExistingImages.length > 5) {
        throw new Error("Only up to 5 images are allowed.");
      }
      for (const asset of picked) {
        // eslint-disable-next-line no-await-in-loop
        await ensureSize(asset);
      }
      setEditNewImages((prev) => [...prev, ...picked]);
    } catch (error) {
      showErrorToast(error);
    }
  };

  const onSaveProgress = async () => {
    if (savingProgress) return;
    setSavingProgress(true);
    try {
      await addProgressUpdate(issueId, currentUser.uid, progressText, progressImages);
      setProgressText("");
      setProgressImages([]);
      setAddingProgress(false);
      await loadData();
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSavingProgress(false);
    }
  };

  const performDelete = async () => {
    if (deletingIssue) return;
    setDeletingIssue(true);
    try {
      await deleteIssue(issueId);
      showSuccessToast("Complaint deleted.");
      navigation.goBack();
    } catch (error) {
      showErrorToast(error);
    } finally {
      setDeletingIssue(false);
    }
  };

  const onDelete = () => {
    if (Platform.OS === "web") {
      const ok = typeof globalThis?.confirm === "function"
        ? globalThis.confirm("Are you sure you want to delete this issue?")
        : true;
      if (!ok) return;
      performDelete();
      return;
    }
    Alert.alert("Delete Issue", "Are you sure you want to delete this issue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: performDelete
      }
    ]);
  };

  const onSaveEdit = async () => {
    try {
      await updateIssue(issueId, currentUser.uid, {
        title: editTitle,
        description: editDescription,
        category: editCategory || null,
        location: editLocation,
        existingImages: editExistingImages,
        newImages: editNewImages
      });
      setEditMode(false);
      await loadData();
    } catch (error) {
      showErrorToast(error);
    }
  };

  const onShare = async () => {
    const link = `https://communityapp.local/issues/${issueId}`;
    try {
      await Clipboard.setStringAsync(link);
      await Share.share({ message: `${issue?.title || "Issue"}\n${link}` });
    } catch (error) {
      console.log(error);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!issue) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <Text style={{ fontSize: 36, marginBottom: 10 }}>🔍</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "600" }}>Issue not found</Text>
      </View>
    );
  }

  const base = inputStyle(colors);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {!editMode ? (
        <>
          {/* Hero Header */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 20,
            borderWidth: colors.mode === "dark" ? 1 : 0,
            borderColor: colors.cardBorder,
            ...(shadows?.lg || {})
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ fontSize: 24, fontWeight: "800", flex: 1, paddingRight: 12, color: colors.text, lineHeight: 30 }}>
                {issue.title}
              </Text>
              <StatusBadge status={issue.status} />
            </View>

            <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 14 }}>
              By {issue.authorName} · {formatTimestamp(issue.createdAt)}
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <CategoryBadge category={issue.category} />
              </View>

            <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: 14 }} />

            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{issue.description}</Text>
            {issue.location ? (
              <Text style={{ color: colors.textSecondary, marginTop: 10, fontSize: 14 }}>
                📍 {issue.location}
              </Text>
            ) : null}
            <ImageCarousel images={issue.images || []} />

            {/* Action bar */}
            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: colors.borderLight
            }}>
              <Pressable onPress={onLike} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 16 }}>{liked ? "❤️" : "🤍"}</Text>
                <Text style={{ color: liked ? colors.danger : colors.textSecondary, fontWeight: "600", fontSize: 14 }}>
                  {issue.likesCount || 0}
                </Text>
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 14 }}>💬</Text>
                <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 14 }}>
                  {issue.commentsCount || 0}
                </Text>
              </View>
              <Pressable onPress={onShare}>
                <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>Share</Text>
              </Pressable>
            </View>
          </View>

          {/* Author actions */}
          {isAuthor || canDeleteIssue ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              {isAuthor ? (
                <Pressable
                  onPress={() => setEditMode(true)}
                  style={{
                    flex: 1,
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: "center"
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>Edit Issue</Text>
                </Pressable>
              ) : null}
              {canDeleteIssue ? (
                <Pressable
                  onPress={onDelete}
                  disabled={deletingIssue}
                  style={{
                    flex: 1,
                    borderWidth: 1.5,
                    borderColor: colors.danger,
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: deletingIssue ? 0.6 : 1
                  }}
                >
                  <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 14 }}>
                    {deletingIssue ? "Deleting..." : "Delete"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        /* Edit mode */
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 20,
          borderWidth: colors.mode === "dark" ? 1 : 0,
          borderColor: colors.cardBorder,
          ...(shadows?.lg || {})
        }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 16 }}>Edit Issue</Text>

          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 }}>Title</Text>
          <TextInput
            value={editTitle}
            onChangeText={setEditTitle}
            maxLength={100}
            style={[base, { marginBottom: 14 }]}
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 }}>Description</Text>
          <TextInput
            value={editDescription}
            onChangeText={setEditDescription}
            multiline
            maxLength={5000}
            style={[base, { minHeight: 120, textAlignVertical: "top", marginBottom: 14 }]}
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 }}>Category</Text>
          <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, marginBottom: 14 }}>
            <Picker selectedValue={editCategory} onValueChange={(value) => setEditCategory(value)} style={{ color: colors.text }}>
              <Picker.Item label="Select Category" value="" />
              {ISSUE_CATEGORIES.map((item) => <Picker.Item key={item} label={item} value={item} />)}
            </Picker>
          </View>

          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 }}>Location</Text>
          <TextInput
            value={editLocation}
            onChangeText={setEditLocation}
            maxLength={220}
            style={[base, { marginBottom: 14 }]}
            placeholder="e.g., Block A, 2nd floor near lab"
            placeholderTextColor={colors.textTertiary}
          />

          <Pressable
            onPress={pickEditImages}
            style={{
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 12,
              paddingVertical: 12,
              marginBottom: 10,
              backgroundColor: colors.surfaceAlt
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "600", color: colors.primary, fontSize: 14 }}>
              Manage Images (max 5)
            </Text>
          </Pressable>

          {editPreviewImages.length > 0 ? (
            <View style={{ marginBottom: 14 }}>
              <ImageCarousel
                images={editPreviewImages}
                resolveImageUri={(entry) => (entry.kind === "existing" ? absoluteUploadUrl(entry.uri) : entry.asset?.uri || "")}
                onRemoveImage={(_, entry) => {
                  if (entry.kind === "existing") {
                    setEditExistingImages((prev) => prev.filter((_, i) => i !== entry.listIndex));
                    return;
                  }
                  setEditNewImages((prev) => prev.filter((_, i) => i !== entry.listIndex));
                }}
                height={180}
              />
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={onSaveEdit}
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, flex: 1, alignItems: "center" }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Save</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setEditMode(false);
                setEditTitle(issue?.title || "");
                setEditDescription(issue?.description || "");
                setEditCategory(issue?.category || "");
                setEditLocation(issue?.location || "");
                setEditExistingImages(Array.isArray(issue?.images) ? issue.images : []);
                setEditNewImages([]);
              }}
              style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, flex: 1, alignItems: "center" }}
            >
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {(canViewManagementPanel || canViewSolutionsPanel) ? (
        <View style={{
          marginTop: 16,
          backgroundColor: colors.surface,
          borderRadius: 18,
          padding: 16,
          borderWidth: colors.mode === "dark" ? 1 : 0,
          borderColor: colors.cardBorder,
          ...(shadows?.md || {})
        }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>Resolution Workspace</Text>
          <Text style={{ color: colors.textTertiary, marginTop: 4, fontSize: 13 }}>
            Use focused screens for workflow actions and solution planning.
          </Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {canViewManagementPanel ? (
              <Pressable
                onPress={() => navigation.navigate("IssueManagement", { issueId })}
                style={{
                  borderWidth: 1.2,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: colors.surfaceAlt
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>Manage Status & Assignments</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 3, fontSize: 12 }}>
                  Update complaint status and authority assignment.
                </Text>
              </Pressable>
            ) : null}
            {canViewSolutionsPanel ? (
              <Pressable
                onPress={() => navigation.navigate("IssueSolutions", { issueId })}
                style={{
                  borderWidth: 1.2,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: colors.surfaceAlt
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>Possible Solutions</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 3, fontSize: 12 }}>
                  Generate, edit, and track resolution steps.
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Status History */}
      <View style={{
        marginTop: 24,
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.md || {})
      }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 12 }}>Status History</Text>
        {statusHistory.length === 0 ? (
          <Text style={{ color: colors.textTertiary }}>No status updates yet.</Text>
        ) : null}
        {statusHistory.map((entry, index) => (
          <View key={entry.id} style={{ flexDirection: "row", marginBottom: 4 }}>
            <View style={{ alignItems: "center", marginRight: 12, width: 16 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 5 }} />
              {index < statusHistory.length - 1 ? (
                <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 }} />
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 14 }}>
                {entry.status.replace("_", " ")} by {entry.changedByName}
              </Text>
              {entry.note ? <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}>{entry.note}</Text> : null}
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{formatTimestamp(entry.createdAt)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Comments */}
      <View style={{
        marginTop: 16,
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.md || {})
      }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 12 }}>Comments</Text>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textTertiary}
            style={[base, { flex: 1 }]}
          />
          <Pressable
            onPress={onSendComment}
            style={{
              borderRadius: 12,
              paddingHorizontal: 18,
              justifyContent: "center",
              backgroundColor: colors.primary,
              opacity: sendingComment ? 0.6 : 1
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>Send</Text>
          </Pressable>
        </View>

        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </View>

      {/* Progress Updates */}
      <View style={{
        marginTop: 16,
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.md || {})
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Progress Updates</Text>
          {canAddProgress ? (
            <Pressable onPress={() => setAddingProgress((prev) => !prev)}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>
                {addingProgress ? "Cancel" : "+ Add Update"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {addingProgress ? (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 14,
            borderWidth: colors.mode === "dark" ? 1 : 0,
            borderColor: colors.cardBorder,
            ...(shadows?.md || {})
          }}>
            <TextInput
              value={progressText}
              onChangeText={setProgressText}
              placeholder="Describe progress (min 10 chars)"
              placeholderTextColor={colors.textTertiary}
              maxLength={2000}
              multiline
              style={[base, { minHeight: 90, textAlignVertical: "top" }]}
            />

            <Pressable
              onPress={pickProgressImages}
              style={{
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 10,
                paddingVertical: 11,
                marginTop: 10,
                backgroundColor: colors.surfaceAlt
              }}
            >
              <Text style={{ textAlign: "center", fontWeight: "600", color: colors.primary, fontSize: 14 }}>
                📷 Attach Images (max 2)
              </Text>
            </Pressable>

            {progressImages.length > 0 ? (
              <ImageCarousel
                images={progressImages}
                resolveImageUri={(asset) => asset?.uri || ""}
                onRemoveImage={(index) => setProgressImages((prev) => prev.filter((_, i) => i !== index))}
                height={180}
              />
            ) : null}

            <Pressable
              onPress={onSaveProgress}
              style={{
                marginTop: 12,
                backgroundColor: colors.accent,
                borderRadius: 10,
                paddingVertical: 13,
                alignItems: "center",
                opacity: savingProgress ? 0.6 : 1
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
                {savingProgress ? "Saving..." : "Submit Progress"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {progressUpdates.length === 0 ? (
          <Text style={{ color: colors.textTertiary }}>No progress updates yet.</Text>
        ) : null}

        {progressUpdates.map((entry, index) => (
          <View key={entry.id} style={{ flexDirection: "row", marginBottom: 4 }}>
            <View style={{ alignItems: "center", marginRight: 12, width: 16 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 5 }} />
              {index < progressUpdates.length - 1 ? (
                <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 }} />
              ) : null}
            </View>
            <View style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 14,
              marginBottom: 8,
              borderWidth: colors.mode === "dark" ? 1 : 0,
              borderColor: colors.cardBorder,
              ...(shadows?.sm || {})
            }}>
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 14 }}>
                {entry.authorityName} · {entry.status?.replace("_", " ")}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{formatTimestamp(entry.createdAt)}</Text>
              <Text style={{ color: colors.text, marginTop: 8, fontSize: 14, lineHeight: 20 }}>{entry.text}</Text>
              <ImageCarousel images={entry.images || []} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

