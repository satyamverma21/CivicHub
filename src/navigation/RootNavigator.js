import React from "react";
import { useAuth } from "../context/AuthContext";
import AppStack from "./AppStack";
import AuthStack from "./AuthStack";
import SplashScreen from "../screens/SplashScreen";

export default function RootNavigator() {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return currentUser ? <AppStack /> : <AuthStack />;
}
