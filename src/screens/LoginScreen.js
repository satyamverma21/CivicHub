import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import AuthInput from "../components/AuthInput";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { pressFeedbackStyle } from "../styles";
import { ShieldCheckIcon } from "../components/Icons";

export default function LoginScreen({ navigation }) {
  const { login, showErrorToast } = useAuth();
  const { colors, shadows } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setIsSubmitting(true);
    try {
      await login(email, password);
      console.log("Login successful", email);
    } catch (error) {
      console.log("Login failed", error);
      if (error?.message === "Awaiting admin approval") {
        Alert.alert("Login Blocked", "Awaiting admin approval");
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
        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: 36 }}>
          <View style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16
          }}>
            <ShieldCheckIcon size={36} color="#FFFFFF" strokeWidth={1.5} />
          </View>
          <Text style={{
            fontSize: 28,
            fontWeight: "800",
            color: colors.text,
            letterSpacing: -0.5
          }}>
            Welcome Back
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 15 }}>
            Sign in to your college complaint portal
          </Text>
        </View>

        {/* Form Card */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 24,
          borderWidth: colors.mode === "dark" ? 1 : 0,
          borderColor: colors.cardBorder,
          ...(shadows?.lg || {})
        }}>
          <AuthInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            label="Email"
          />
          <AuthInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            label="Password"
            secureTextEntry
          />

          <Pressable
            onPress={handleLogin}
            disabled={isSubmitting}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                borderRadius: 10,
                paddingVertical: 15,
                marginTop: 8
              },
              pressFeedbackStyle(pressed, isSubmitting)
            ]}
          >
            <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Text>
          </Pressable>
        </View>

        {/* Footer links */}
        <View style={{ alignItems: "center", marginTop: 28, gap: 14 }}>
          <Pressable onPress={() => navigation.navigate("HeadSignup")} style={({ pressed }) => [pressFeedbackStyle(pressed)]}>
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 15 }}>
              Create College Admin Account
            </Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("UserSignup")} style={({ pressed }) => [pressFeedbackStyle(pressed)]}>
            <Text style={{ color: colors.textSecondary, fontWeight: "500", fontSize: 14 }}>
              Join as User or Authority
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
