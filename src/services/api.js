import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "auth_token_v1";
const RAW_API_BASE_URL = String(process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000").trim();
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");

function isFormDataBody(body) {
  if (!body || typeof body !== "object") return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  return typeof body.append === "function" && (Array.isArray(body?._parts) || typeof body.getParts === "function");
}

export async function getAuthToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setAuthToken(token) {
  if (!token) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function request(path, options = {}) {
  const token = await getAuthToken();
  const formDataBody = options.isFormData === true || isFormDataBody(options.body);
  const headers = {
    ...(options.body && !formDataBody ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body && !formDataBody ? JSON.stringify(options.body) : options.body
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "Request failed");
    error.code = data?.code || response.status;
    throw error;
  }

  return data;
}

export function apiGet(path) {
  return request(path, { method: "GET" });
}

export function apiPost(path, body) {
  return request(path, { method: "POST", body });
}

export function apiPatch(path, body) {
  return request(path, { method: "PATCH", body });
}

export function apiDelete(path) {
  return request(path, { method: "DELETE" });
}

export function apiPostForm(path, formData) {
  return request(path, { method: "POST", body: formData, isFormData: true });
}
