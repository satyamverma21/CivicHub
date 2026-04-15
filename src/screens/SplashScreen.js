import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function SplashScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16
      }}
    >
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Checking authentication...</Text>
    </View>
  );
}
