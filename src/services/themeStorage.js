import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "theme_preference_v1";

export async function loadThemePreference() {
  const saved = await AsyncStorage.getItem(KEY);
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "light";
}

export async function saveThemePreference(mode) {
  await AsyncStorage.setItem(KEY, mode);
}
