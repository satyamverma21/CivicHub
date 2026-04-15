import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import AuthInput from "../components/AuthInput";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function LoginScreen({ navigation }) {
  const { login, showErrorToast } = useAuth();
  const { colors } = useTheme();
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
    <View style={{ flex: 1, padding: 16, justifyContent: "center", backgroundColor: colors.background }}>
      <Text style={{ fontSize: 22, marginBottom: 16, color: colors.text, fontWeight: "700" }}>Login</Text>
      <AuthInput value={email} onChangeText={setEmail} placeholder="Email" />
      <AuthInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
      />

      <Pressable
        onPress={handleLogin}
        disabled={isSubmitting}
        style={{
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: colors.primary,
          padding: 10,
          borderRadius: 6,
          marginBottom: 12,
          opacity: isSubmitting ? 0.7 : 1
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>{isSubmitting ? "Logging in..." : "Login"}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate("HeadSignup")} style={{ marginBottom: 10 }}>
        <Text style={{ color: colors.primary }}>Create Head Account</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("UserSignup")}>
        <Text style={{ color: colors.primary }}>Create User/Authority Account</Text>
      </Pressable>
    </View>
  );
}
