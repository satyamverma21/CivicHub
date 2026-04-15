import React, { useEffect } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { subscribeNotificationNavigation } from "./src/services/notifications";

const navigationRef = createNavigationContainerRef();

function AppInner() {
  const { isDark } = useTheme();

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
    <NavigationContainer ref={navigationRef} theme={isDark ? DarkTheme : DefaultTheme}>
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
