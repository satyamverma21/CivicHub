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
import MyIssuesScreen from "../screens/MyIssuesScreen";
import AuthorityTagManagerScreen from "../screens/AuthorityTagManagerScreen";
import AuthorityPersonalizedFeedScreen from "../screens/AuthorityPersonalizedFeedScreen";
import IssueManagementScreen from "../screens/IssueManagementScreen";
import IssueSolutionsScreen from "../screens/IssueSolutionsScreen";
import { useTheme } from "../context/ThemeContext";

const Stack = createNativeStackNavigator();

export default function AppStack() {
  const { colors, shadows } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          color: colors.text,
          fontWeight: "700",
          fontSize: 17
        },
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Feed" component={FeedScreen} options={{ title: "Complaints Feed" }} />
      <Stack.Screen name="CreateIssue" component={CreateIssueScreen} options={{ title: "File Complaint" }} />
      <Stack.Screen name="IssueDetail" component={IssueDetailScreen} options={{ title: "Complaint Detail" }} />
      <Stack.Screen name="IssueManagement" component={IssueManagementScreen} options={{ title: "Workflow Management" }} />
      <Stack.Screen name="IssueSolutions" component={IssueSolutionsScreen} options={{ title: "Possible Solutions" }} />
      <Stack.Screen
        name="AuthorityDashboard"
        component={AuthorityDashboardScreen}
        options={{ title: "Authority Dashboard" }}
      />
      <Stack.Screen name="AuthorityPersonalizedFeed" component={AuthorityPersonalizedFeedScreen} options={{ title: "Personalized Feed" }} />
      <Stack.Screen name="AuthorityTagManager" component={AuthorityTagManagerScreen} options={{ title: "Authority Department Tags" }} />
      <Stack.Screen name="HeadDashboard" component={HeadDashboardScreen} options={{ title: "Head Dashboard" }} />
      <Stack.Screen
        name="SuperAdminDashboard"
        component={SuperAdminDashboardScreen}
        options={{ title: "SuperAdmin", headerShown: false }}
      />
      <Stack.Screen name="MyIssues" component={MyIssuesScreen} options={{ title: "My Issues" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
