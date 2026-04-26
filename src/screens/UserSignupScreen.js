import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import AuthInput from "../components/AuthInput";
import ChannelIDInput from "../components/ChannelIDInput";
import RoleSelector from "../components/RoleSelector";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { pressFeedbackStyle } from "../styles";

export default function UserSignupScreen() {
  const { signupUser, showErrorToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("User");
  const [channelId, setChannelId] = useState("");
  const [channelError, setChannelError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    setIsSubmitting(true);
    setChannelError("");
    try {
      const result = await signupUser({ email, password, fullName, role, channelIdInput: channelId });
      console.log("User/Authority signup successful", email, role);
      if (result?.pendingApproval) {
        Alert.alert("Signup Complete", "Authority request sent. Awaiting admin approval.");
      }
    } catch (error) {
      console.log("User/Authority signup failed", error);
      if (error?.message === "Invalid Channel ID") {
        setChannelError("Invalid Channel ID");
      } else {
        showErrorToast(error);
      }
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
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14
          }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: colors.primary }}>👤</Text>
          </View>
          <Text style={{
            fontSize: 26,
            fontWeight: "800",
            color: colors.text,
            letterSpacing: -0.5
          }}>
            Join College Portal
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 15 }}>
            Create your student or authority account
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
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            label="Full Name"
            autoCapitalize="words"
          />

          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6, marginLeft: 2 }}>
            Role
          </Text>
          <RoleSelector
            selectedRole={role}
            onSelectRole={setRole}
            options={["User", "Authority"]}
          />

          <ChannelIDInput value={channelId} onChangeText={setChannelId} error={channelError} />

          <Pressable
            onPress={handleSignup}
            disabled={isSubmitting}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                borderRadius: 10,
                paddingVertical: 15,
                marginTop: 4
              },
              pressFeedbackStyle(pressed, isSubmitting)
            ]}
          >
            <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
              {isSubmitting ? "Creating..." : "Create Account"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
