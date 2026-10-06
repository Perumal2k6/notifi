const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "smart_reminder_access_token";

export function setAccessToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null
        ? payload.detail || payload.message
        : payload;
    const error = new Error(detail || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function mapUser(user) {
  return {
    id: user.id,
    name: user.full_name,
    username: user.username,
    email: user.email,
    role: user.role,
    active: user.is_active,
    createdAt: user.created_at
      ? new Date(user.created_at).toLocaleDateString()
      : "",
  };
}

export function mapSound(sound) {
  let url = sound.file_url || "";
  const isCustom = sound.sound_type === "CUSTOM";
  if (url && url.startsWith("/")) {
    if (isCustom) {
      if (API_BASE_URL.startsWith("http")) {
        try {
          const origin = new URL(API_BASE_URL).origin;
          url = origin + url;
        } catch (e) {}
      } else {
        url = window.location.origin + url;
      }
    }
  }

  return {
    id: sound.id,
    name: sound.name,
    url: url,
    soundType: sound.sound_type.toLowerCase(),
    isCustom: sound.sound_type === "CUSTOM",
  };
}

export function mapReminder(reminder, sounds = []) {
  const scheduledAt = new Date(reminder.scheduled_at);
  const sound = sounds.find((item) => item.id === reminder.sound_id);
  const enabledStatus = ["PENDING", "SNOOZED"].includes(reminder.status);
  return {
    id: reminder.id,
    userId: reminder.user_id,
    title: reminder.title,
    description: reminder.description || "",
    scheduledAt: reminder.scheduled_at,
    date: [
      scheduledAt.getFullYear(),
      String(scheduledAt.getMonth() + 1).padStart(2, "0"),
      String(scheduledAt.getDate()).padStart(2, "0"),
    ].join("-"),
    time: `${String(scheduledAt.getHours()).padStart(2, "0")}:${String(scheduledAt.getMinutes()).padStart(2, "0")}`,
    soundId: reminder.sound_id,
    soundName: reminder.sound_name || sound?.name || "No sound",
    soundUrl: sound?.url || "",
    isCustom: sound?.isCustom || reminder.sound_type === "CUSTOM",
    snoozeMinutes: reminder.snooze_minutes,
    active: reminder.is_active && enabledStatus,
    completed: reminder.status === "COMPLETED",
    status: reminder.status,
    nextTriggerAt: reminder.next_trigger_at,
  };
}
