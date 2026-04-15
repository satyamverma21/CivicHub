import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";
import {
  createUserWithEmailAndPassword,
  deleteUser as deleteAuthUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { syncOfflineActions } from "../services/issues";
import { registerForPushNotifications } from "../services/notifications";
import { logError } from "../services/crashlog";

const AuthContext = createContext(null);

const SUPER_ADMIN_EMAIL = "superadmin@communityapp.com";
const CHANNEL_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);
const isValidPassword = (password) => /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);

const randomChannelId = () =>
  Array.from({ length: 6 })
    .map(() => CHANNEL_ID_CHARS[Math.floor(Math.random() * CHANNEL_ID_CHARS.length)])
    .join("");

async function generateUniqueChannelId() {
  let nextId = randomChannelId();
  let exists = true;

  while (exists) {
    const channelDoc = await getDoc(doc(db, "channels", nextId));
    if (!channelDoc.exists()) {
      exists = false;
    } else {
      nextId = randomChannelId();
    }
  }

  return nextId;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [channelId, setChannelId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function syncUser(user) {
    if (!user) {
      setCurrentUser(null);
      setChannelId(null);
      setUserRole(null);
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
        const superAdminData = {
          email: user.email,
          name: "Super Admin",
          role: "SuperAdmin",
          channelId: null,
          status: "active",
          createdAt: serverTimestamp()
        };
        await setDoc(userRef, superAdminData);
        setCurrentUser({ uid: user.uid, ...superAdminData });
        setChannelId(null);
        setUserRole("SuperAdmin");
        return;
      }

      setCurrentUser(null);
      setChannelId(null);
      setUserRole(null);
      return;
    }

    const userData = userSnap.data();
    setCurrentUser({ uid: user.uid, ...userData });
    setChannelId(userData.channelId || null);
    setUserRole(userData.role || null);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        await syncUser(user);
      } catch (error) {
        console.log("Auth sync error:", error);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) {
      return;
    }

    registerForPushNotifications(currentUser.uid).catch((error) => {
      logError(error, "push_register");
    });
    syncOfflineActions().catch((error) => logError(error, "offline_sync_init"));
  }, [currentUser?.uid]);

  async function signupHead({ email, password, organizationName }) {
    if (!isValidEmail(email)) {
      throw new Error("Please enter a valid email.");
    }
    if (!isValidPassword(password)) {
      throw new Error("Password must be 8+ chars, 1 uppercase, 1 number.");
    }
    if (!organizationName || organizationName.trim().length < 3) {
      throw new Error("Organization name must be at least 3 characters.");
    }

    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const newChannelId = await generateUniqueChannelId();

    await setDoc(doc(db, "channels", newChannelId), {
      name: organizationName.trim(),
      headEmail: email.trim().toLowerCase(),
      createdAt: serverTimestamp(),
      description: ""
    });

    await setDoc(doc(db, "users", cred.user.uid), {
      email: email.trim().toLowerCase(),
      name: organizationName.trim(),
      role: "Head",
      channelId: newChannelId,
      status: "active",
      avatar: "",
      bio: "",
      privacy: { showFullName: true, anonymousPosts: false },
      notificationSettings: {
        all: true,
        newIssue: true,
        comment: true,
        assignment: true,
        status: true,
        progress: true,
        approval: true
      },
      createdAt: serverTimestamp()
    });
  }

  async function signupUser({ email, password, fullName, role, channelIdInput }) {
    if (!isValidEmail(email)) {
      throw new Error("Please enter a valid email.");
    }
    if (!isValidPassword(password)) {
      throw new Error("Password must be 8+ chars, 1 uppercase, 1 number.");
    }
    if (!fullName || fullName.trim().length < 2) {
      throw new Error("Full name is required.");
    }
    if (![
      "User",
      "Authority"
    ].includes(role)) {
      throw new Error("Please select User or Authority.");
    }

    const normalizedChannelId = channelIdInput.trim().toUpperCase();
    const channelSnap = await getDoc(doc(db, "channels", normalizedChannelId));
    if (!channelSnap.exists()) {
      throw new Error("Invalid Channel ID");
    }

    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

    const status = role === "Authority" ? "pending_approval" : "active";
    await setDoc(doc(db, "users", cred.user.uid), {
      email: email.trim().toLowerCase(),
      name: fullName.trim(),
      role,
      channelId: normalizedChannelId,
      status,
      avatar: "",
      bio: "",
      privacy: { showFullName: true, anonymousPosts: false },
      notificationSettings: {
        all: true,
        newIssue: true,
        comment: true,
        assignment: true,
        status: true,
        progress: true,
        approval: true
      },
      createdAt: serverTimestamp()
    });

    if (role === "Authority") {
      await addDoc(collection(db, "channelRequests"), {
        userId: cred.user.uid,
        channelId: normalizedChannelId,
        requestType: "authority_join",
        status: "pending",
        createdAt: serverTimestamp()
      });
      await signOut(auth);
      return { pendingApproval: true };
    }

    return { pendingApproval: false };
  }

  async function login(email, password) {
    if (!email || !password) {
      throw new Error("Please fill in email and password.");
    }
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    const userRef = doc(db, "users", result.user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      if (email.trim().toLowerCase() === SUPER_ADMIN_EMAIL) {
        await setDoc(userRef, {
          email: SUPER_ADMIN_EMAIL,
          name: "Super Admin",
          role: "SuperAdmin",
          channelId: null,
          status: "active",
          avatar: "",
          createdAt: serverTimestamp()
        });
        return;
      }
      await signOut(auth);
      throw new Error("User profile missing. Contact support.");
    }

    const userData = userSnap.data();
    const suspendedSnap = await getDoc(doc(db, "suspendedUsers", result.user.uid));
    if (userData.status === "suspended" || suspendedSnap.exists()) {
      await signOut(auth);
      throw new Error("Your account is suspended by SuperAdmin.");
    }
    if (userData.role === "Authority" && userData.status === "pending_approval") {
      await signOut(auth);
      throw new Error("Awaiting admin approval");
    }
    if (userData.status === "rejected") {
      await signOut(auth);
      throw new Error("Your request was rejected by Head.");
    }
  }

  async function logout() {
    await signOut(auth);
  }

  async function getChannelID() {
    return channelId;
  }

  async function getSuperAdminOverview() {
    if (userRole !== "SuperAdmin") {
      return { channels: [], users: [] };
    }

    const [channelsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, "channels")),
      getDocs(collection(db, "users"))
    ]);

    return {
      channels: channelsSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
      users: usersSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
    };
  }

  async function superAdminUpdateUserRole(userId, nextRole) {
    if (userRole !== "SuperAdmin") {
      throw new Error("Only SuperAdmin can update roles.");
    }
    if (!["Head", "User", "Authority", "SuperAdmin"].includes(nextRole)) {
      throw new Error("Invalid role selection.");
    }
    await updateDoc(doc(db, "users", userId), { role: nextRole });
  }

  async function getPendingAuthorityRequests() {
    if (!currentUser || userRole !== "Head" || !channelId) {
      return [];
    }

    const pendingUsersQuery = query(
      collection(db, "users"),
      where("channelId", "==", channelId),
      where("role", "==", "Authority"),
      where("status", "==", "pending_approval")
    );

    const requestsQuery = query(
      collection(db, "channelRequests"),
      where("channelId", "==", channelId),
      where("requestType", "==", "authority_join"),
      where("status", "==", "pending")
    );

    const [pendingUsersSnap, requestsSnap] = await Promise.all([
      getDocs(pendingUsersQuery),
      getDocs(requestsQuery)
    ]);

    const usersMap = pendingUsersSnap.docs.reduce((acc, item) => {
      acc[item.id] = { id: item.id, ...item.data() };
      return acc;
    }, {});

    return requestsSnap.docs
      .map((item) => {
        const requestData = item.data();
        const user = usersMap[requestData.userId] || {};
        return {
          requestId: item.id,
          userId: requestData.userId,
          channelId: requestData.channelId,
          status: requestData.status,
          createdAt: requestData.createdAt,
          name: user.name || "Unknown",
          email: user.email || ""
        };
      })
      .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  }

  async function approveAuthorityRequest(requestId, headId) {
    if (userRole !== "Head") {
      throw new Error("Only Head can approve authority requests.");
    }

    const requestRef = doc(db, "channelRequests", requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) {
      throw new Error("Request not found.");
    }

    const requestData = requestSnap.data();
    if (requestData.channelId !== channelId) {
      throw new Error("You can only approve requests for your channel.");
    }

    await updateDoc(requestRef, {
      status: "approved",
      approvedBy: headId,
      approvedAt: serverTimestamp()
    });

    await updateDoc(doc(db, "users", requestData.userId), {
      status: "active",
      channelId
    });

    await addDoc(collection(db, "notifications"), {
      userId: requestData.userId,
      title: "Authority Approved",
      body: "Your authority account has been approved.",
      type: "authority_approval",
      read: false,
      createdAt: serverTimestamp(),
      screen: "Home"
    });
  }

  async function rejectAuthorityRequest(requestId) {
    if (userRole !== "Head") {
      throw new Error("Only Head can reject authority requests.");
    }

    const requestRef = doc(db, "channelRequests", requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) {
      throw new Error("Request not found.");
    }

    const requestData = requestSnap.data();
    if (requestData.channelId !== channelId) {
      throw new Error("You can only reject requests for your channel.");
    }

    await deleteDoc(requestRef);
    await updateDoc(doc(db, "users", requestData.userId), {
      status: "rejected",
      channelId: null
    });
  }

  async function getActiveAuthoritiesWithStats() {
    if (!channelId || userRole !== "Head") {
      return [];
    }

    const [authoritiesSnap, issuesSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "users"),
          where("channelId", "==", channelId),
          where("role", "==", "Authority"),
          where("status", "==", "active")
        )
      ),
      getDocs(query(collection(db, "issues"), where("channelId", "==", channelId)))
    ]);

    const issues = issuesSnap.docs.map((item) => ({ id: item.id, ...item.data() }));

    return authoritiesSnap.docs.map((item) => {
      const authority = { id: item.id, ...item.data() };
      const assignedIssues = issues.filter((issue) =>
        Array.isArray(issue.assignedAuthorities) ? issue.assignedAuthorities.includes(authority.id) : false
      );

      return {
        ...authority,
        issuesAssigned: assignedIssues.length,
        resolvedCount: assignedIssues.filter((issue) => issue.status === "resolved" || issue.status === "closed").length
      };
    });
  }

  async function removeAuthority(authorityId) {
    if (!channelId || userRole !== "Head") {
      throw new Error("Only Head can remove authorities.");
    }

    await updateDoc(doc(db, "users", authorityId), {
      status: "removed",
      channelId: null
    });
  }

  async function approveAuthority(userId) {
    const pending = await getPendingAuthorityRequests();
    const request = pending.find((item) => item.userId === userId);
    if (!request) {
      throw new Error("Pending request not found.");
    }
    await approveAuthorityRequest(request.requestId, currentUser?.uid);
  }

  async function rejectAuthority(userId) {
    const pending = await getPendingAuthorityRequests();
    const request = pending.find((item) => item.userId === userId);
    if (!request) {
      throw new Error("Pending request not found.");
    }
    await rejectAuthorityRequest(request.requestId);
  }

  async function updateMyProfile({ name, avatar, bio, privacy }) {
    if (!currentUser?.uid) {
      throw new Error("Not authenticated.");
    }
    await updateDoc(doc(db, "users", currentUser.uid), {
      name: (name || "").trim(),
      avatar: avatar || "",
      bio: (bio || "").trim(),
      privacy: {
        showFullName: Boolean(privacy?.showFullName ?? true),
        anonymousPosts: Boolean(privacy?.anonymousPosts ?? false)
      }
    });
    await syncUser(auth.currentUser);
  }

  async function updateNotificationSettings(settings) {
    if (!currentUser?.uid) {
      throw new Error("Not authenticated.");
    }
    await updateDoc(doc(db, "users", currentUser.uid), {
      notificationSettings: settings || {}
    });
    await syncUser(auth.currentUser);
  }

  async function deleteMyAccount() {
    if (!currentUser?.uid || !auth.currentUser) {
      throw new Error("Not authenticated.");
    }
    await deleteDoc(doc(db, "users", currentUser.uid));
    await deleteAuthUser(auth.currentUser);
  }

  async function getMyProfileStats() {
    if (!currentUser?.uid) {
      return { issuesCreated: 0, commentsMade: 0, issuesResolved: 0, myIssues: [], myComments: [] };
    }

    const [issuesSnap, commentsSnap, resolvedSnap] = await Promise.all([
      getDocs(query(collection(db, "issues"), where("authorId", "==", currentUser.uid))),
      getDocs(query(collection(db, "comments"), where("userId", "==", currentUser.uid))),
      getDocs(query(collection(db, "issues"), where("assignedAuthorities", "array-contains", currentUser.uid)))
    ]);

    const myIssues = issuesSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const myComments = commentsSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const issuesResolved = resolvedSnap.docs.filter((item) => {
      const status = item.data()?.status;
      return status === "resolved" || status === "closed";
    }).length;

    return {
      issuesCreated: myIssues.length,
      commentsMade: myComments.length,
      issuesResolved,
      myIssues,
      myComments
    };
  }

  function showErrorToast(error) {
    const code = error?.code || "";
    if (code === "auth/invalid-credential") {
      notify("Login Failed", "Invalid credentials");
      return;
    }
    if (code === "auth/email-already-in-use") {
      notify("Signup Failed", "Email already registered");
      return;
    }
    if (code === "auth/invalid-email") {
      notify("Error", "Please enter a valid email.");
      return;
    }
    if (code === "permission-denied") {
      notify("Permission Denied", "You do not have permission to perform this action.");
      return;
    }
    if (code === "unavailable") {
      notify("Network Error", "Service is unavailable right now. Please retry.");
      return;
    }
    if ((error?.message || "").toLowerCase().includes("timed out")) {
      notify("Timeout", "Connection timed out. Please retry.");
      return;
    }
    notify("Error", error?.message || "Something went wrong.");
  }

  const value = useMemo(
    () => ({
      currentUser,
      channelId,
      userRole,
      isLoading,
      signupHead,
      signupUser,
      login,
      logout,
      getChannelID,
      getSuperAdminOverview,
      superAdminUpdateUserRole,
      getPendingAuthorityRequests,
      approveAuthority,
      rejectAuthority,
      approveAuthorityRequest,
      rejectAuthorityRequest,
      getActiveAuthoritiesWithStats,
      removeAuthority,
      updateMyProfile,
      updateNotificationSettings,
      deleteMyAccount,
      getMyProfileStats,
      showErrorToast
    }),
    [currentUser, channelId, userRole, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

function notify(title, message) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(title, message);
}

