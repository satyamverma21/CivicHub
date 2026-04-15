import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import AuthInput from "../components/AuthInput";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function HeadSignupScreen() {
  const { signupHead, showErrorToast } = useAuth();
  const { colors } = useTheme();
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
    <View style={{ flex: 1, padding: 16, justifyContent: "center", backgroundColor: colors.background }}>
      <Text style={{ fontSize: 22, marginBottom: 16, color: colors.text, fontWeight: "700" }}>Head Signup</Text>
      <AuthInput value={email} onChangeText={setEmail} placeholder="Email" />
      <AuthInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
      />
      <AuthInput
        value={organizationName}
        onChangeText={setOrganizationName}
        placeholder="Organization Name"
        autoCapitalize="words"
      />

      <Pressable
        onPress={handleSignup}
        disabled={isSubmitting}
        style={{
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: colors.primary,
          padding: 10,
          borderRadius: 6,
          opacity: isSubmitting ? 0.7 : 1
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
          {isSubmitting ? "Creating..." : "Create Head Account"}
        </Text>
      </Pressable>
    </View>
  );
}
