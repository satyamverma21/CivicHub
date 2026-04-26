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

const buildShadows = (mode) => {
  // Premium dark mode uses softer but deeper depth to separate layered surfaces.
  const color = mode === "dark" ? "#020617" : "#000000";
  return {
    sm: makeShadow(1, color),
    md: makeShadow(2, color),
    lg: makeShadow(3, color),
    xl: makeShadow(4, color),
    xxl: makeShadow(5, color)
  };
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
    // Backgrounds (modern slate palette, no pure black)
    background: "#020617",
    surface: "#0B1220",
    surfaceAlt: "#111827",
    surfaceElevated: "#1A2333",

    // Text
    text: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textTertiary: "#94A3B8",
    textInverse: "#020617",

    // Borders
    border: "#273449",
    borderLight: "#1E293B",
    borderFocus: "#38BDF8",

    // Primary
    primary: "#38BDF8",
    primaryDark: "#0EA5E9",
    primaryLight: "#10263C",
    primaryMuted: "#7DD3FC",

    // Accent / CTA
    accent: "#06B6D4",
    accentDark: "#0891B2",
    accentLight: "#0F2F3D",

    // Semantic
    danger: "#F87171",
    dangerDark: "#EF4444",
    dangerLight: "#3B1620",
    success: "#4ADE80",
    successLight: "#123225",
    warning: "#FBBF24",
    warningLight: "#3A2A08",
    warningText: "#FDE68A",
    info: "#60A5FA",
    infoLight: "#102A44",

    // Role specific
    roleUser: { bg: "#10263C", text: "#7DD3FC" },
    roleAuthority: { bg: "#2A1C3D", text: "#C4B5FD" },
    roleHead: { bg: "#123225", text: "#86EFAC" },
    roleSuperAdmin: { bg: "#3A2A08", text: "#FCD34D" },

    // Status
    statusOpen: { bg: "#1F2937", text: "#E2E8F0" },
    statusInProgress: { bg: "#10263C", text: "#7DD3FC" },
    statusResolved: { bg: "#123225", text: "#86EFAC" },
    statusClosed: { bg: "#2C3342", text: "#CBD5E1" },

    // Misc
    skeleton: "#1F2937",
    overlay: "rgba(2, 6, 23, 0.78)",
    cardBorder: "#273449"
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
      shadows: buildShadows(resolvedMode)
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
