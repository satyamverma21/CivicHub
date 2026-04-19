import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "auth_token_v1";
export const API_BASE_URL = "http://localhost:4000";
console.log("base url ",API_BASE_URL)

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
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
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
  return request(path, { method: "POST", body: formData });
}
