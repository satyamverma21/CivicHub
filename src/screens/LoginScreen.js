import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import AuthInput from "../components/AuthInput";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }) {
  const { login, showErrorToast } = useAuth();
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
    <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, marginBottom: 16 }}>Login</Text>
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
        style={{ borderWidth: 1, padding: 10, borderRadius: 6, marginBottom: 12 }}
      >
        <Text>{isSubmitting ? "Logging in..." : "Login"}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate("HeadSignup")} style={{ marginBottom: 10 }}>
        <Text>Create Head Account</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("UserSignup")}>
        <Text>Create User/Authority Account</Text>
      </Pressable>
    </View>
  );
}