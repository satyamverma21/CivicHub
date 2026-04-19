import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  generatePossibleSolutions,
  generatePossibleSolutionsWithAI,
  getIssueById,
  updatePossibleSolutions
} from "../services/issues";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function IssueSolutionsScreen({ route }) {
  const { issueId } = route.params || {};
  const { currentUser, showErrorToast, showSuccessToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState(null);
  const [solutionDraft, setSolutionDraft] = useState("");
  const [solutionNote, setSolutionNote] = useState("");
  const [savingSolutions, setSavingSolutions] = useState(false);
  const [generatingSolutions, setGeneratingSolutions] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const issueData = await getIssueById(issueId);
      setIssue(issueData);
      setSolutionNote(issueData?.possibleSolutionsNote || "");
      setSolutionDraft("");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [issueId, showErrorToast]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load])
  );

  const solutions = useMemo(() => {
    if (!issue) return [];
    return Array.isArray(issue.possibleSolutions) && issue.possibleSolutions.length > 0
      ? issue.possibleSolutions
      : generatePossibleSolutions(issue);
  }, [issue]);

  const persistSolutions = async (nextSolutions, noteValue) => {
    setSavingSolutions(true);
    try {
      const result = await updatePossibleSolutions(issueId, nextSolutions, noteValue);
      setIssue((prev) => ({
        ...(prev || {}),
        possibleSolutions: result?.possibleSolutions || nextSolutions,
        possibleSolutionsNote: result?.possibleSolutionsNote ?? noteValue
      }));
      setSolutionNote(result?.possibleSolutionsNote ?? noteValue);
      showSuccessToast("Solutions updated.");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSavingSolutions(false);
    }
  };

  const onGenerateAiSolutions = async () => {
    setGeneratingSolutions(true);
    try {
      const result = await generatePossibleSolutionsWithAI(issueId);
      setIssue((prev) => ({
        ...(prev || {}),
        possibleSolutions: result?.possibleSolutions || prev?.possibleSolutions || [],
        possibleSolutionsNote: result?.possibleSolutionsNote ?? prev?.possibleSolutionsNote ?? ""
      }));
      setSolutionNote(result?.possibleSolutionsNote ?? issue?.possibleSolutionsNote ?? "");
      showSuccessToast("AI solutions generated.");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setGeneratingSolutions(false);
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
        <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "600" }}>Complaint not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.sm || {})
      }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Possible Solutions</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>{issue.title}</Text>

        <Pressable
          onPress={onGenerateAiSolutions}
          disabled={savingSolutions || generatingSolutions}
          style={{
            marginTop: 12,
            borderRadius: 10,
            paddingVertical: 11,
            borderWidth: 1.2,
            borderColor: colors.accent,
            backgroundColor: colors.accentLight,
            alignItems: "center",
            opacity: savingSolutions || generatingSolutions ? 0.6 : 1
          }}
        >
          <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>
            {generatingSolutions ? "Generating with AI..." : "Generate with AI"}
          </Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 12, gap: 10 }}>
        {solutions.map((solution) => {
          const applied = Boolean(solution.applied);
          return (
            <View
              key={solution.id}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{solution.text}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                  {solution.source === "generated" ? "AI suggested" : "Manual"}
                </Text>
                <Pressable
                  onPress={async () => {
                    const next = solutions.map((sol) => (
                      sol.id === solution.id
                        ? {
                          ...sol,
                          applied: !applied,
                          appliedBy: !applied ? (currentUser?.name || "") : "",
                          appliedAt: !applied ? Date.now() : null
                        }
                        : sol
                    ));
                    await persistSolutions(next, solutionNote ?? issue?.possibleSolutionsNote ?? "");
                  }}
                  disabled={savingSolutions}
                  style={{
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: applied ? colors.accentLight : colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: applied ? colors.accent : colors.border
                  }}
                >
                  <Text style={{ color: applied ? colors.accent : colors.textSecondary, fontWeight: "700", fontSize: 12 }}>
                    {applied ? "Applied" : "Mark Applied"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{
        marginTop: 12,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: colors.mode === "dark" ? 1 : 0,
        borderColor: colors.cardBorder,
        ...(shadows?.sm || {})
      }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>Add Manual Step</Text>
        <TextInput
          value={solutionDraft}
          onChangeText={setSolutionDraft}
          placeholder="Add manual solution step"
          placeholderTextColor={colors.textTertiary}
          style={{
            marginTop: 10,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 10,
            color: colors.text,
            backgroundColor: colors.surface
          }}
        />
        <Pressable
          onPress={async () => {
            const draft = solutionDraft.trim();
            if (draft.length < 8) {
              showErrorToast(new Error("Manual solution should be at least 8 characters."));
              return;
            }
            const next = [
              ...solutions,
              {
                id: `manual-${Date.now()}`,
                text: draft,
                source: "manual",
                applied: false,
                appliedBy: "",
                appliedAt: null
              }
            ];
            await persistSolutions(next, solutionNote ?? issue?.possibleSolutionsNote ?? "");
            setSolutionDraft("");
          }}
          disabled={savingSolutions}
          style={{
            marginTop: 8,
            borderRadius: 10,
            paddingVertical: 10,
            backgroundColor: colors.primary,
            alignItems: "center",
            opacity: savingSolutions ? 0.6 : 1
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Add Manual Solution</Text>
        </Pressable>

        <TextInput
          value={solutionNote}
          onChangeText={setSolutionNote}
          placeholder="Internal resolution note (optional)"
          placeholderTextColor={colors.textTertiary}
          multiline
          style={{
            marginTop: 10,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 10,
            minHeight: 72,
            textAlignVertical: "top",
            color: colors.text,
            backgroundColor: colors.surface
          }}
        />
        <Pressable
          onPress={() => persistSolutions(solutions, solutionNote ?? issue?.possibleSolutionsNote ?? "")}
          disabled={savingSolutions}
          style={{
            marginTop: 8,
            borderRadius: 10,
            paddingVertical: 10,
            borderWidth: 1.2,
            borderColor: colors.primary,
            alignItems: "center",
            opacity: savingSolutions ? 0.6 : 1
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
            {savingSolutions ? "Saving..." : "Save Note"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
