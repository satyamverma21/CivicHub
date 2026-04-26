import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "./ThemeContext";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const { colors, shadows } = useTheme();
  const timerRef = useRef(null);
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" });

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const showToast = useCallback((message, type = "info", duration = 2500) => {
    const safeMessage = String(message || "").trim();
    if (!safeMessage) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const typeSafe = ["info", "success", "error"].includes(type) ? type : "info";
    setToast({ visible: true, message: safeMessage, type: typeSafe });
    timerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
      timerRef.current = null;
    }, Math.max(1200, Number(duration) || 2500));
  }, []);

  const showErrorToast = useCallback((error) => {
    const message = error?.message || "Something went wrong.";
    showToast(message, "error");
  }, [showToast]);

  const showSuccessToast = useCallback((message) => {
    showToast(message, "success");
  }, [showToast]);

  const value = useMemo(() => ({
    showToast,
    showErrorToast,
    showSuccessToast,
    hideToast
  }), [showToast, showErrorToast, showSuccessToast, hideToast]);

  const palette = useMemo(() => {
    if (toast.type === "success") {
      return { bg: colors.successLight, text: colors.success, border: colors.success };
    }
    if (toast.type === "error") {
      return { bg: colors.dangerLight, text: colors.danger, border: colors.danger };
    }
    return { bg: colors.surfaceElevated, text: colors.text, border: colors.border };
  }, [colors, toast.type]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast.visible ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 56, left: 16, right: 16, zIndex: 9999 }}>
          <View
            style={{
              backgroundColor: palette.bg,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: palette.border,
              paddingHorizontal: 14,
              paddingVertical: 12,
              ...(shadows?.lg || {})
            }}
          >
            <Text style={{ color: palette.text, fontSize: 13, fontWeight: "600" }}>{toast.message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
