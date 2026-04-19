import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";

const ToastContext = createContext(null);

const TOAST_COLORS = {
  info: { bg: "#1F2937", text: "#FFFFFF" },
  success: { bg: "#065F46", text: "#ECFDF5" },
  error: { bg: "#7F1D1D", text: "#FEF2F2" }
};

export function ToastProvider({ children }) {
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
    setToast({ visible: true, message: safeMessage, type: TOAST_COLORS[type] ? type : "info" });
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

  const palette = TOAST_COLORS[toast.type] || TOAST_COLORS.info;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast.visible ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 56, left: 16, right: 16, zIndex: 9999 }}>
          <View style={{ backgroundColor: palette.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
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
