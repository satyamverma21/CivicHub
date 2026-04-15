import { apiPost } from "./api";

export async function logError(error, context = "app") {
  try {
    await apiPost("/api/logs/error", {
      context,
      message: error?.message || "Unknown error",
      stack: error?.stack || ""
    });
  } catch (logErrorInternal) {
    console.log("Failed to log error", logErrorInternal?.message);
  }
}
