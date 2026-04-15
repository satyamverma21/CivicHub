import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import { loadThemePreference, saveThemePreference } from "../services/themeStorage";

const ThemeContext = createContext(null);

const palettes = {
  light: {
    mode: "light",
    background: "#F6F8FA",
    surface: "#FFFFFF",
    text: "#1F2328",
    muted: "#59636E",
    border: "#D0D7DE",
    primary: "#0969DA",
    danger: "#CF222E",
    success: "#1A7F37",
    warningBg: "#FFF1D6",
    warningText: "#8A4B00"
  },
  dark: {
    mode: "dark",
    background: "#0D1117",
    surface: "#161B22",
    text: "#E6EDF3",
    muted: "#9BA7B4",
    border: "#30363D",
    primary: "#2F81F7",
    danger: "#F85149",
    success: "#3FB950",
    warningBg: "#3B2F17",
    warningText: "#F2CC60"
  }
};

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState("system");
  const [systemColorScheme, setSystemColorScheme] = useState(Appearance.getColorScheme() || "light");

  useEffect(() => {
    let active = true;
    loadThemePreference().then((saved) => {
      if (active) {
        setPreference(saved);
      }
    });

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme || "light");
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const resolvedMode = preference === "system" ? systemColorScheme : preference;
  const colors = palettes[resolvedMode] || palettes.light;

  const setThemePreference = async (mode) => {
    setPreference(mode);
    await saveThemePreference(mode);
  };

  const value = useMemo(
    () => ({
      colors,
      preference,
      resolvedMode,
      setThemePreference,
      isDark: resolvedMode === "dark"
    }),
    [colors, preference, resolvedMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}