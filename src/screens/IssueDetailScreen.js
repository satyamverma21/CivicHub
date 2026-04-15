import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  formatTimestamp,
  getActiveAuthorities,
  getComments,
  getIssueById,
  getProgressUpdates,
  getStatusHistory,
  likeIssue,
  manuallyAssignIssue,
  updateIssue,
  updateIssueStatus
} from "../services/issues";
import { useAuth } from "../context/AuthContext";

const STATUS_TRANSITIONS = {
  open: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["closed"],
  closed: []
};

export default function IssueDetailScreen({ route, navigation }) {
  const { issueId } = route.params;
  const { currentUser, userRole, channelId, showErrorToast } = useAuth();
  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const [savingStatus, setSavingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("open");
  const [statusNote, setStatusNote] = useState("");

  const [addingProgress, setAddingProgress] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressImages, setProgressImages] = useState([]);
  const [savingProgress, setSavingProgress] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const [authorities, setAuthorities] = useState([]);
  const [selectedAuthorities, setSelectedAuthorities] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

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

      const nextStatuses = STATUS_TRANSITIONS[issueData?.status] || [];
      setSelectedStatus(nextStatuses[0] || issueData?.status || "open");
      setSelectedAuthorities(Array.isArray(issueData?.assignedAuthorities) ? issueData.assignedAuthorities : []);

      if (userRole === "Head" && channelId) {
        const active = await getActiveAuthorities(channelId);
        setAuthorities(active);
      }
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [issueId, userRole, channelId, showErrorToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isAssignedAuthority = useMemo(
    () => Array.isArray(issue?.assignedAuthorities) && issue.assignedAuthorities.includes(currentUser?.uid),
    [issue, currentUser?.uid]
  );

  const isAuthor = issue?.authorId === currentUser?.uid;
  const canManageIssue = userRole === "Head" || userRole === "SuperAdmin" || isAssignedAuthority;
  const canUpdateStatus = canManageIssue;
  const canAddProgress = userRole === "Authority" && isAssignedAuthority;
  const liked = Array.isArray(issue?.likes) && issue?.likes.includes(currentUser?.uid);
  const nextAllowedStatuses = STATUS_TRANSITIONS[issue?.status] || [];

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
    if (sendingComment) {
      return;
    }

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

      if (result.canceled) {
        return;
      }

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

  const onSaveProgress = async () => {
    if (savingProgress) {
      return;
    }

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

  const onDelete = () => {
    Alert.alert("Delete Issue", "Are you sure you want to delete this issue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteIssue(issueId, currentUser.uid);
            navigation.goBack();
          } catch (error) {
            showErrorToast(error);
          }
        }
      }
    ]);
  };

  const onSaveStatus = async () => {
    if (savingStatus) {
      return;
    }
    if (nextAllowedStatuses.length === 0) {
      showErrorToast(new Error("No further status changes allowed."));
      return;
    }

    setSavingStatus(true);
    try {
      await updateIssueStatus(issueId, selectedStatus, currentUser.uid, statusNote);
      setStatusNote("");
      await loadData();
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSavingStatus(false);
    }
  };

  const onSaveEdit = async () => {
    try {
      await updateIssue(issueId, currentUser.uid, {
        title: editTitle,
        description: editDescription,
        category: editCategory || null
      });
      setEditMode(false);
      await loadData();
    } catch (error) {
      showErrorToast(error);
    }
  };

  const onSaveAssignments = async () => {
    if (savingAssignments) {
      return;
    }

    setSavingAssignments(true);
    try {
      await manuallyAssignIssue(issueId, selectedAuthorities, currentUser.uid);
      await loadData();
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSavingAssignments(false);
    }
  };

  const toggleAuthority = (authorityId) => {
    setSelectedAuthorities((prev) =>
      prev.includes(authorityId) ? prev.filter((id) => id !== authorityId) : [...prev, authorityId]
    );
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!issue) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Issue not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      {!editMode ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "800", flex: 1, paddingRight: 10 }}>{issue.title}</Text>
            <StatusBadge status={issue.status} />
          </View>

          <Text style={{ color: "#59636E", marginTop: 4 }}>
            By {issue.authorName} • {formatTimestamp(issue.createdAt)}
          </Text>

          <View style={{ marginTop: 10 }}>
            <CategoryBadge category={issue.category} />
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            {issue.isVoiceReport ? (
              <View style={{ backgroundColor: "#EDE9FE", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#4C1D95", fontSize: 11, fontWeight: "700" }}>Voice Report</Text>
              </View>
            ) : null}
            {issue.isAIRefined ? (
              <View style={{ backgroundColor: "#E6FFEC", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#1A7F37", fontSize: 11, fontWeight: "700" }}>AI-enhanced</Text>
              </View>
            ) : null}
          </View>

          {issue.aiSummary ? (
            <View style={{ marginTop: 10, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10 }}>
              <Text style={{ fontWeight: "700", marginBottom: 4 }}>AI Summary</Text>
              <Text style={{ color: "#1F2328" }}>{issue.aiSummary}</Text>
            </View>
          ) : null}

          {Array.isArray(issue.keywords) && issue.keywords.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: "#59636E" }}>Keywords: {issue.keywords.join(", ")}</Text>
            </View>
          ) : null}

          <Text style={{ marginTop: 12, color: "#1F2328", lineHeight: 20 }}>{issue.description}</Text>
          <ImageCarousel images={issue.images || []} />
        </>
      ) : (
        <View>
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Edit Title</Text>
          <TextInput
            value={editTitle}
            onChangeText={setEditTitle}
            maxLength={100}
            style={{
              borderWidth: 1,
              borderColor: "#D0D7DE",
              borderRadius: 8,
              padding: 12,
              backgroundColor: "#FFFFFF"
            }}
          />
          <Text style={{ fontWeight: "700", marginBottom: 6, marginTop: 12 }}>Edit Description</Text>
          <TextInput
            value={editDescription}
            onChangeText={setEditDescription}
            multiline
            maxLength={5000}
            style={{
              borderWidth: 1,
              borderColor: "#D0D7DE",
              borderRadius: 8,
              padding: 12,
              minHeight: 120,
              textAlignVertical: "top",
              backgroundColor: "#FFFFFF"
            }}
          />
          <Text style={{ fontWeight: "700", marginBottom: 6, marginTop: 12 }}>Category</Text>
          <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, backgroundColor: "#FFFFFF" }}>
            <Picker selectedValue={editCategory} onValueChange={(value) => setEditCategory(value)}>
              <Picker.Item label="Select Category" value="" />
              {ISSUE_CATEGORIES.map((item) => (
                <Picker.Item key={item} label={item} value={item} />
              ))}
            </Picker>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pressable
              onPress={onSaveEdit}
              style={{ backgroundColor: "#0969DA", padding: 10, borderRadius: 8, flex: 1 }}
            >
              <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700" }}>Save</Text>
            </Pressable>
            <Pressable
              onPress={() => setEditMode(false)}
              style={{ borderWidth: 1, borderColor: "#D0D7DE", padding: 10, borderRadius: 8, flex: 1 }}
            >
              <Text style={{ textAlign: "center", fontWeight: "700" }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
        <Pressable onPress={onLike}>
          <Text style={{ color: liked ? "#D1242F" : "#2F353D", fontWeight: "700" }}>
            {liked ? "?" : "?"} {issue.likesCount || 0}
          </Text>
        </Pressable>
        <Text style={{ color: "#2F353D", fontWeight: "700" }}>Comments {issue.commentsCount || 0}</Text>
        <Pressable onPress={onShare}>
          <Text style={{ color: "#0969DA", fontWeight: "700" }}>Share</Text>
        </Pressable>
      </View>

      {isAuthor && !editMode ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <Pressable
            onPress={() => setEditMode(true)}
            style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, flex: 1 }}
          >
            <Text style={{ textAlign: "center", fontWeight: "700" }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={{ borderWidth: 1, borderColor: "#CF222E", borderRadius: 8, padding: 10, flex: 1 }}
          >
            <Text style={{ textAlign: "center", color: "#CF222E", fontWeight: "700" }}>Delete</Text>
          </Pressable>
        </View>
      ) : null}

      {canUpdateStatus ? (
        <View style={{ marginTop: 16, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10 }}>
          <Text style={{ fontWeight: "800", marginBottom: 6 }}>Change Status</Text>
          <View style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, backgroundColor: "#FFFFFF" }}>
            <Picker
              enabled={nextAllowedStatuses.length > 0}
              selectedValue={selectedStatus}
              onValueChange={(value) => setSelectedStatus(value)}
            >
              {nextAllowedStatuses.length === 0 ? (
                <Picker.Item label="No more transitions" value={issue.status} />
              ) : (
                nextAllowedStatuses.map((status) => (
                  <Picker.Item key={status} label={status.replace("_", " ")} value={status} />
                ))
              )}
            </Picker>
          </View>

          <TextInput
            value={statusNote}
            onChangeText={setStatusNote}
            placeholder="Optional note (e.g., Fixed the pothole today)"
            multiline
            style={{
              marginTop: 8,
              borderWidth: 1,
              borderColor: "#D0D7DE",
              borderRadius: 8,
              padding: 10,
              minHeight: 80,
              textAlignVertical: "top",
              backgroundColor: "#FFFFFF"
            }}
          />

          <Pressable
            onPress={onSaveStatus}
            style={{
              marginTop: 10,
              backgroundColor: "#1A7F37",
              borderRadius: 8,
              padding: 10,
              opacity: savingStatus || nextAllowedStatuses.length === 0 ? 0.6 : 1
            }}
            disabled={savingStatus || nextAllowedStatuses.length === 0}
          >
            <Text style={{ textAlign: "center", color: "#FFFFFF", fontWeight: "700" }}>
              {savingStatus ? "Saving..." : "Update Status"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {userRole === "Head" ? (
        <View style={{ marginTop: 16, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10 }}>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>Assign Authorities</Text>
          {authorities.length === 0 ? <Text style={{ color: "#59636E" }}>No active authorities.</Text> : null}

          {authorities.map((authority) => {
            const selected = selectedAuthorities.includes(authority.id);
            return (
              <Pressable
                key={authority.id}
                onPress={() => toggleAuthority(authority.id)}
                style={{
                  borderWidth: 1,
                  borderColor: selected ? "#0969DA" : "#D0D7DE",
                  backgroundColor: selected ? "#E7F3FF" : "#FFFFFF",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 8
                }}
              >
                <Text style={{ fontWeight: "700" }}>{authority.name}</Text>
                <Text style={{ color: "#59636E" }}>{authority.email}</Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={onSaveAssignments}
            style={{
              marginTop: 4,
              backgroundColor: "#0969DA",
              borderRadius: 8,
              padding: 10,
              opacity: savingAssignments ? 0.6 : 1
            }}
          >
            <Text style={{ textAlign: "center", color: "#FFFFFF", fontWeight: "700" }}>
              {savingAssignments ? "Saving..." : "Save Assignment"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 10 }}>Status History</Text>
        {statusHistory.length === 0 ? <Text style={{ color: "#59636E" }}>No status updates yet.</Text> : null}
        {statusHistory.map((entry) => (
          <View key={entry.id} style={{ marginBottom: 10 }}>
            <Text style={{ color: "#1F2328", fontWeight: "600" }}>
              {entry.status.replace("_", " ")} by {entry.changedByName}
            </Text>
            {entry.note ? <Text style={{ color: "#2F353D" }}>{entry.note}</Text> : null}
            <Text style={{ color: "#59636E", fontSize: 12 }}>{formatTimestamp(entry.createdAt)}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 10 }}>Comments</Text>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment"
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#D0D7DE",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 8,
              backgroundColor: "#FFFFFF"
            }}
          />
          <Pressable
            onPress={onSendComment}
            style={{
              borderRadius: 8,
              paddingHorizontal: 14,
              justifyContent: "center",
              backgroundColor: "#0969DA",
              opacity: sendingComment ? 0.6 : 1
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Send</Text>
          </Pressable>
        </View>

        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </View>

      <View style={{ marginTop: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "800" }}>Progress Updates</Text>
          {canAddProgress ? (
            <Pressable onPress={() => setAddingProgress((prev) => !prev)}>
              <Text style={{ color: "#0969DA", fontWeight: "700" }}>
                {addingProgress ? "Cancel" : "Add Update"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {addingProgress ? (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10 }}>
            <TextInput
              value={progressText}
              onChangeText={setProgressText}
              placeholder="Describe progress (min 10 chars)"
              maxLength={2000}
              multiline
              style={{
                borderWidth: 1,
                borderColor: "#D0D7DE",
                borderRadius: 8,
                padding: 10,
                minHeight: 90,
                textAlignVertical: "top",
                backgroundColor: "#FFFFFF"
              }}
            />

            <Pressable
              onPress={pickProgressImages}
              style={{ borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 8, padding: 10, marginTop: 8 }}
            >
              <Text style={{ textAlign: "center", fontWeight: "600" }}>Attach Images (max 2)</Text>
            </Pressable>

            {progressImages.length > 0 ? (
              <ScrollView horizontal style={{ marginTop: 8 }} showsHorizontalScrollIndicator={false}>
                {progressImages.map((asset, index) => (
                  <View key={`${asset.uri}-${index}`} style={{ marginRight: 8 }}>
                    <Image
                      source={{ uri: asset.uri }}
                      style={{ width: 90, height: 90, borderRadius: 8, backgroundColor: "#EEF2F6" }}
                    />
                    <Pressable onPress={() => setProgressImages((prev) => prev.filter((_, i) => i !== index))}>
                      <Text style={{ color: "#CF222E", textAlign: "center", marginTop: 4 }}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <Pressable
              onPress={onSaveProgress}
              style={{
                marginTop: 10,
                backgroundColor: "#1A7F37",
                borderRadius: 8,
                padding: 10,
                opacity: savingProgress ? 0.6 : 1
              }}
            >
              <Text style={{ textAlign: "center", color: "#FFFFFF", fontWeight: "700" }}>
                {savingProgress ? "Saving..." : "Submit Progress Update"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {progressUpdates.length === 0 ? (
          <Text style={{ color: "#59636E", marginTop: 10 }}>No progress updates yet.</Text>
        ) : null}

        {progressUpdates.map((entry, index) => (
          <View key={entry.id} style={{ marginTop: 12, flexDirection: "row" }}>
            <View style={{ alignItems: "center", marginRight: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#0969DA", marginTop: 6 }} />
              {index < progressUpdates.length - 1 ? (
                <View style={{ width: 2, flex: 1, backgroundColor: "#D0D7DE", marginTop: 2 }} />
              ) : null}
            </View>

            <View style={{ flex: 1, borderWidth: 1, borderColor: "#D0D7DE", borderRadius: 10, padding: 10 }}>
              <Text style={{ fontWeight: "700", color: "#1F2328" }}>
                {entry.authorityName} • {entry.status?.replace("_", " ")}
              </Text>
              <Text style={{ color: "#59636E", fontSize: 12, marginTop: 2 }}>{formatTimestamp(entry.createdAt)}</Text>
              <Text style={{ color: "#1F2328", marginTop: 8 }}>{entry.text}</Text>
              <ImageCarousel images={entry.images || []} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

