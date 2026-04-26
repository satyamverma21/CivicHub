import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import AuthInput from "../components/AuthInput";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { pressFeedbackStyle } from "../styles";

export default function HeadSignupScreen() {
  const { signupHead, showErrorToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    setIsSubmitting(true);
    try {
      await signupHead({ email, password, organizationName });
      console.log("Head signup successful", email);
    } catch (error) {
      console.log("Head signup failed", error);
      showErrorToast(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: 36 }}>
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: colors.accentLight,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14
          }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: colors.accent }}>🏛</Text>
          </View>
          <Text style={{
            fontSize: 26,
            fontWeight: "800",
            color: colors.text,
            letterSpacing: -0.5
          }}>
            Create Organization
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 15 }}>
            Set up your community channel
          </Text>
        </View>

        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 24,
          borderWidth: colors.mode === "dark" ? 1 : 0,
          borderColor: colors.cardBorder,
          ...(shadows?.lg || {})
        }}>
          <AuthInput value={email} onChangeText={setEmail} placeholder="Enter your email" label="Email" />
          <AuthInput
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            label="Password"
            secureTextEntry
          />
          <AuthInput
            value={organizationName}
            onChangeText={setOrganizationName}
            placeholder="e.g. City Council Ward 5"
            label="Organization Name"
            autoCapitalize="words"
          />

          <Pressable
            onPress={handleSignup}
            disabled={isSubmitting}
            style={({ pressed }) => [
              {
                backgroundColor: colors.accent,
                borderRadius: 10,
                paddingVertical: 15,
                marginTop: 8
              },
              pressFeedbackStyle(pressed, isSubmitting)
            ]}
          >
            <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
              {isSubmitting ? "Creating..." : "Create Organization"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
