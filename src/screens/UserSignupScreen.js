import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import AuthInput from "../components/AuthInput";
import ChannelIDInput from "../components/ChannelIDInput";
import RoleSelector from "../components/RoleSelector";
import { useAuth } from "../context/AuthContext";

export default function UserSignupScreen() {
  const { signupUser, showErrorToast } = useAuth();
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
    <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, marginBottom: 16 }}>User / Authority Signup</Text>

      <AuthInput value={email} onChangeText={setEmail} placeholder="Email" />
      <AuthInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
      />
      <AuthInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full Name"
        autoCapitalize="words"
      />

      <RoleSelector
        selectedRole={role}
        onSelectRole={setRole}
        options={["User", "Authority"]}
      />

      <ChannelIDInput value={channelId} onChangeText={setChannelId} error={channelError} />

      <Pressable
        onPress={handleSignup}
        disabled={isSubmitting}
        style={{ borderWidth: 1, padding: 10, borderRadius: 6 }}
      >
        <Text>{isSubmitting ? "Creating..." : "Create Account"}</Text>
      </Pressable>
    </View>
  );
}
