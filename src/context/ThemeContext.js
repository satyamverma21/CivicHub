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
    background: "#F8F7FF",
    surface: "#FFFFFF",
    surfaceAlt: "#F3F0FF",
    surfaceElevated: "#FFFFFF",

    // Text
    text: "#1A1035",
    textSecondary: "#6B6080",
    textTertiary: "#9B93AD",
    textInverse: "#FFFFFF",

    // Borders
    border: "#E8E3F3",
    borderLight: "#F0ECF9",
    borderFocus: "#7C3AED",

    // Primary (Purple)
    primary: "#7C3AED",
    primaryDark: "#6D28D9",
    primaryLight: "#EDE9FE",
    primaryMuted: "#C4B5FD",

    // Accent / CTA (Green)
    accent: "#22C55E",
    accentDark: "#16A34A",
    accentLight: "#DCFCE7",

    // Semantic
    danger: "#EF4444",
    dangerDark: "#DC2626",
    dangerLight: "#FEE2E2",
    success: "#22C55E",
    successLight: "#DCFCE7",
    warning: "#F59E0B",
    warningLight: "#FEF3C7",
    warningText: "#92400E",
    info: "#3B82F6",
    infoLight: "#DBEAFE",

    // Role specific
    roleUser: { bg: "#EDE9FE", text: "#6D28D9" },
    roleAuthority: { bg: "#FEF3C7", text: "#92400E" },
    roleHead: { bg: "#DCFCE7", text: "#166534" },
    roleSuperAdmin: { bg: "#DBEAFE", text: "#1E40AF" },

    // Status
    statusOpen: { bg: "#F3F0FF", text: "#6D28D9" },
    statusInProgress: { bg: "#DBEAFE", text: "#1D4ED8" },
    statusResolved: { bg: "#DCFCE7", text: "#166534" },
    statusClosed: { bg: "#1E1B2E", text: "#F0ECF9" },

    // Misc
    skeleton: "#E8E3F3",
    overlay: "rgba(26, 16, 53, 0.5)",
    cardBorder: "transparent"
  },

  dark: {
    mode: "dark",
    // Backgrounds
    background: "#0F0A1A",
    surface: "#1A1229",
    surfaceAlt: "#231B35",
    surfaceElevated: "#2A2040",

    // Text
    text: "#F0ECF9",
    textSecondary: "#A89EC4",
    textTertiary: "#7A6F96",
    textInverse: "#1A1035",

    // Borders
    border: "#2D2541",
    borderLight: "#231B35",
    borderFocus: "#A78BFA",

    // Primary (Purple)
    primary: "#A78BFA",
    primaryDark: "#8B5CF6",
    primaryLight: "#2D2055",
    primaryMuted: "#5B4A82",

    // Accent / CTA (Green)
    accent: "#4ADE80",
    accentDark: "#22C55E",
    accentLight: "#14532D",

    // Semantic
    danger: "#F87171",
    dangerDark: "#EF4444",
    dangerLight: "#451A1A",
    success: "#4ADE80",
    successLight: "#14532D",
    warning: "#FBBF24",
    warningLight: "#451A00",
    warningText: "#FBBF24",
    info: "#60A5FA",
    infoLight: "#1E3A5F",

    // Role specific
    roleUser: { bg: "#2D2055", text: "#C4B5FD" },
    roleAuthority: { bg: "#451A00", text: "#FBBF24" },
    roleHead: { bg: "#14532D", text: "#4ADE80" },
    roleSuperAdmin: { bg: "#1E3A5F", text: "#60A5FA" },

    // Status
    statusOpen: { bg: "#2D2055", text: "#C4B5FD" },
    statusInProgress: { bg: "#1E3A5F", text: "#60A5FA" },
    statusResolved: { bg: "#14532D", text: "#4ADE80" },
    statusClosed: { bg: "#3D3555", text: "#A89EC4" },

    // Misc
    skeleton: "#2D2541",
    overlay: "rgba(0, 0, 0, 0.65)",
    cardBorder: "#2D2541"
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