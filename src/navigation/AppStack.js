import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import FeedScreen from "../screens/FeedScreen";
import CreateIssueScreen from "../screens/CreateIssueScreen";
import IssueDetailScreen from "../screens/IssueDetailScreen";
import AuthorityDashboardScreen from "../screens/AuthorityDashboardScreen";
import HeadDashboardScreen from "../screens/HeadDashboardScreen";
import SuperAdminDashboardScreen from "../screens/SuperAdminDashboardScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { useTheme } from "../context/ThemeContext";

const Stack = createNativeStackNavigator();

export default function AppStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Feed" component={FeedScreen} options={{ title: "Issues Feed" }} />
      <Stack.Screen name="CreateIssue" component={CreateIssueScreen} options={{ title: "Report Issue" }} />
      <Stack.Screen name="IssueDetail" component={IssueDetailScreen} options={{ title: "Issue Detail" }} />
      <Stack.Screen
        name="AuthorityDashboard"
        component={AuthorityDashboardScreen}
        options={{ title: "Authority Dashboard" }}
      />
      <Stack.Screen name="HeadDashboard" component={HeadDashboardScreen} options={{ title: "Head Dashboard" }} />
      <Stack.Screen
        name="SuperAdminDashboard"
        component={SuperAdminDashboardScreen}
        options={{ title: "SuperAdmin Dashboard" }}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </Stack.Navigator>
  );
}

