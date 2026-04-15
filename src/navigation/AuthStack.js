import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SplashScreen from "../screens/SplashScreen";
import LoginScreen from "../screens/LoginScreen";
import HeadSignupScreen from "../screens/HeadSignupScreen";
import UserSignupScreen from "../screens/UserSignupScreen";

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Login" }} />
      <Stack.Screen name="HeadSignup" component={HeadSignupScreen} options={{ title: "Head Signup" }} />
      <Stack.Screen name="UserSignup" component={UserSignupScreen} options={{ title: "User Signup" }} />
    </Stack.Navigator>
  );
}
