import React, { useEffect } from "react";
import { DefaultTheme, NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { subscribeNotificationNavigation } from "./src/services/notifications";

const navigationRef = createNavigationContainerRef();

function AppInner() {
  const { colors, isDark } = useTheme();

  const navTheme = {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeNotificationNavigation({
      navigate: (name, params) => {
        if (navigationRef.isReady()) {
          navigationRef.navigate(name, params);
        }
      }
    });

    return unsubscribe;
  }, []);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  );
}
