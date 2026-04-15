import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function logError(error, context = "app") {
  try {
    await addDoc(collection(db, "logs"), {
      context,
      message: error?.message || "Unknown error",
      stack: error?.stack || "",
      createdAt: serverTimestamp()
    });
  } catch (logErrorInternal) {
    console.log("Failed to log error", logErrorInternal?.message);
  }
}