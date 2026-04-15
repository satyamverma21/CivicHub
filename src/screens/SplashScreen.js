import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function SplashScreen() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        backgroundColor: colors.background
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ marginTop: 12, color: colors.text }}>Checking authentication...</Text>
    </View>
  );
}
