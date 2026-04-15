import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function registerForPushNotifications(userId) {
  if (!userId || !Device.isDevice) {
    return null;
  }

  const permission = await Notifications.getPermissionsAsync();
  let finalStatus = permission.status;
  if (finalStatus !== "granted") {
    const ask = await Notifications.requestPermissionsAsync();
    finalStatus = ask.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync();
  const token = tokenResult?.data;
  if (token) {
    await updateDoc(doc(db, "users", userId), {
      expoPushToken: token,
      pushEnabled: true
    });
  }

  return token;
}

export function subscribeNotificationNavigation(navigation) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data || {};
    if (data?.issueId) {
      navigation.navigate("IssueDetail", { issueId: data.issueId });
      return;
    }
    if (data?.screen) {
      navigation.navigate(data.screen);
    }
  });

  return () => sub.remove();
}