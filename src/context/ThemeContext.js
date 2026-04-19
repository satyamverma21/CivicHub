import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, Platform } from "react-native";
import { loadThemePreference, saveThemePreference } from "../services/themeStorage";

const ThemeContext = createContext(null);

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
};

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999
};

const makeShadow = (elevation, color = "#000") => {
  if (Platform.OS === "android") {
    return { elevation };
  }
  const offsets = {
    1: { width: 0, height: 1, opacity: 0.06, radius: 3 },
    2: { width: 0, height: 2, opacity: 0.08, radius: 6 },
    3: { width: 0, height: 4, opacity: 0.1, radius: 10 },
    4: { width: 0, height: 8, opacity: 0.12, radius: 16 },
    5: { width: 0, height: 12, opacity: 0.15, radius: 24 }
  };
  const s = offsets[elevation] || offsets[2];
  return {
    shadowColor: color,
    shadowOffset: { width: s.width, height: s.height },
    shadowOpacity: s.opacity,
    shadowRadius: s.radius
  };
};

const shadows = {
  sm: makeShadow(1),
  md: makeShadow(2),
  lg: makeShadow(3),
  xl: makeShadow(4),
  xxl: makeShadow(5)
};

const palettes = {
  light: {
    mode: "light",
    // Backgrounds
    background: "#FFF5F5",
    surface: "#FFFFFF",
    surfaceAlt: "#FFE9E9",
    surfaceElevated: "#FFFFFF",

    // Text
    text: "#3A0606",
    textSecondary: "#7A1D1D",
    textTertiary: "#A96A6A",
    textInverse: "#FFFFFF",

    // Borders
    border: "#F3C6C6",
    borderLight: "#FBE5E5",
    borderFocus: "#8B0000",

    // Primary (Dark Red)
    primary: "#8B0000",
    primaryDark: "#6A0000",
    primaryLight: "#FFD9D9",
    primaryMuted: "#C46C6C",

    // Accent / CTA
    accent: "#A11212",
    accentDark: "#8B0000",
    accentLight: "#FFE4E4",

    // Semantic
    danger: "#EF4444",
    dangerDark: "#DC2626",
    dangerLight: "#FEE2E2",
    success: "#15803D",
    successLight: "#DCFCE7",
    warning: "#F59E0B",
    warningLight: "#FEF3C7",
    warningText: "#92400E",
    info: "#3B82F6",
    infoLight: "#DBEAFE",

    // Role specific
    roleUser: { bg: "#FFE4E4", text: "#8B0000" },
    roleAuthority: { bg: "#FEE2E2", text: "#991B1B" },
    roleHead: { bg: "#DCFCE7", text: "#166534" },
    roleSuperAdmin: { bg: "#FFE4E4", text: "#7F1D1D" },

    // Status
    statusOpen: { bg: "#FFE4E4", text: "#8B0000" },
    statusInProgress: { bg: "#FEE2E2", text: "#991B1B" },
    statusResolved: { bg: "#DCFCE7", text: "#166534" },
    statusClosed: { bg: "#3A0606", text: "#FFFFFF" },

    // Misc
    skeleton: "#F3C6C6",
    overlay: "rgba(58, 6, 6, 0.5)",
    cardBorder: "transparent"
  },

  dark: {
    mode: "dark",
    // Backgrounds
    background: "#210000",
    surface: "#2E0606",
    surfaceAlt: "#3A0B0B",
    surfaceElevated: "#4A1111",

    // Text
    text: "#FFF5F5",
    textSecondary: "#F7CFCF",
    textTertiary: "#D9A9A9",
    textInverse: "#3A0606",

    // Borders
    border: "#5C1C1C",
    borderLight: "#461212",
    borderFocus: "#FFB4B4",

    // Primary (Dark Red)
    primary: "#FF6B6B",
    primaryDark: "#D94848",
    primaryLight: "#5C1C1C",
    primaryMuted: "#A84B4B",

    // Accent / CTA
    accent: "#C62828",
    accentDark: "#A11212",
    accentLight: "#5C1C1C",

    // Semantic
    danger: "#FF7A7A",
    dangerDark: "#EF4444",
    dangerLight: "#5C1C1C",
    success: "#4ADE80",
    successLight: "#14532D",
    warning: "#FBBF24",
    warningLight: "#451A00",
    warningText: "#FBBF24",
    info: "#60A5FA",
    infoLight: "#1E3A5F",

    // Role specific
    roleUser: { bg: "#5C1C1C", text: "#FFD6D6" },
    roleAuthority: { bg: "#451A1A", text: "#FFB4B4" },
    roleHead: { bg: "#14532D", text: "#4ADE80" },
    roleSuperAdmin: { bg: "#5C1C1C", text: "#FFDCDC" },

    // Status
    statusOpen: { bg: "#5C1C1C", text: "#FFD6D6" },
    statusInProgress: { bg: "#6E2222", text: "#FFE3E3" },
    statusResolved: { bg: "#14532D", text: "#4ADE80" },
    statusClosed: { bg: "#120000", text: "#F7CFCF" },

    // Misc
    skeleton: "#5C1C1C",
    overlay: "rgba(0, 0, 0, 0.65)",
    cardBorder: "#5C1C1C"
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
      isDark: resolvedMode === "dark",
      spacing,
      radius,
      shadows
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
