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
        padding: 24,
        backgroundColor: colors.background
      }}
    >
      <View style={{
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20
      }}>
        <Text style={{ fontSize: 32, fontWeight: "800", color: "#FFFFFF" }}>D</Text>
      </View>

      <Text style={{
        fontSize: 32,
        fontWeight: "800",
        color: colors.text,
        letterSpacing: -1
      }}>
        Dikki
      </Text>
      <Text style={{
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
        fontWeight: "500"
      }}>
        Community Issues
      </Text>

      <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 32 }} />
      <Text style={{ marginTop: 10, color: colors.textTertiary, fontSize: 13 }}>
        Checking authentication...
      </Text>
    </View>
  );
}
