import { Platform } from "react-native";

/**
 * Shared style creators – call with current `colors` from useTheme().
 * Every function returns a plain style object you can spread or assign.
 */

export function cardStyle(colors, shadows) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: colors.mode === "dark" ? 1 : 0,
    borderColor: colors.cardBorder,
    ...(shadows?.md || {})
  };
}

export function cardAltStyle(colors, shadows) {
  return {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    borderWidth: colors.mode === "dark" ? 1 : 0,
    borderColor: colors.border,
    ...(shadows?.sm || {})
  };
}

export function inputStyle(colors) {
  return {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    fontSize: 16,
    color: colors.text
  };
}

export function inputFocusStyle(colors) {
  return {
    borderColor: colors.borderFocus,
    ...(Platform.OS === "ios"
      ? { shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8 }
      : { elevation: 2 })
  };
}

export function buttonPrimary(colors) {
  return {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  };
}

export function buttonPrimaryText() {
  return {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700"
  };
}

export function buttonAccent(colors) {
  return {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  };
}

export function buttonOutline(colors) {
  return {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  };
}

export function buttonOutlineText(colors) {
  return {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700"
  };
}

export function buttonDanger(colors) {
  return {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  };
}

// Shared touch feedback for Pressable controls.
export function pressFeedbackStyle(pressed, disabled = false) {
  return {
    opacity: disabled ? 0.6 : pressed ? 0.88 : 1,
    transform: [{ scale: pressed && !disabled ? 0.985 : 1 }]
  };
}

export function buttonDangerText(colors) {
  return {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "700"
  };
}

export function sectionTitle(colors) {
  return {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 12
  };
}

export function screenTitle(colors) {
  return {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5
  };
}

export function subtitle(colors) {
  return {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4
  };
}

export function badgeStyle(bg, textColor) {
  return {
    container: {
      alignSelf: "flex-start",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: bg
    },
    text: {
      color: textColor,
      fontSize: 12,
      fontWeight: "700"
    }
  };
}

export function avatarStyle(size = 40, bgColor = "#EDE9FE") {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: bgColor,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  };
}

export function divider(colors) {
  return {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16
  };
}

export function chipStyle(selected, colors) {
  return {
    container: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: selected ? colors.primary : colors.surfaceAlt,
      borderWidth: selected ? 0 : 1,
      borderColor: colors.border
    },
    text: {
      color: selected ? "#FFFFFF" : colors.text,
      fontWeight: "600",
      fontSize: 14
    }
  };
}
