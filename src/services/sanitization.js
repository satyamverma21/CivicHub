function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeTextInput(value) {
  return escapeHtml((value || "").replace(/<script.*?>.*?<\/script>/gi, "").trim());
}

export function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test((email || "").trim());
}