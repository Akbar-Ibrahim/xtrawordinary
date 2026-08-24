export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

const USERNAME_PATTERN = /^[a-z0-9_]+$/;
const RESERVED_USERNAMES = new Set([
  "about",
  "account",
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "dashboard",
  "explore",
  "games",
  "help",
  "home",
  "leaderboard",
  "login",
  "logout",
  "me",
  "moderator",
  "new",
  "notifications",
  "profile",
  "register",
  "search",
  "settings",
  "signin",
  "signup",
  "support",
  "system",
  "terms",
  "user",
  "users",
]);

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string): string | null {
  const normalized = normalizeUsername(value);

  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return "Use only lowercase letters, numbers, and underscores.";
  }
  if (normalized.startsWith("_") || normalized.endsWith("_")) {
    return "Username cannot start or end with an underscore.";
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return "That username is reserved.";
  }

  return null;
}

export function suggestUsername(value: string): string {
  const suggested = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH);

  return suggested.length >= USERNAME_MIN_LENGTH ? suggested : "player";
}