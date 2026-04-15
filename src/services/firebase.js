import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// const firebaseConfig = {
//   apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
//   authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
//   storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
// };


const firebaseConfig = {
  apiKey: "AIzaSyC2XBr_EEtzMez7RJ2WVNMYk9HOM8AhpDQ",
  authDomain: "socialconnect-7fe82.firebaseapp.com",
  projectId: "socialconnect-7fe82",
  storageBucket: "socialconnect-7fe82.firebasestorage.app",
  messagingSenderId: "416994787094",
  appId: "1:416994787094:web:d3b7feac1f1f3ee4411a37"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION || "us-central1");
