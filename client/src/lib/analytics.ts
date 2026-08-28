import type { AnalyticsEventName } from "@shared/schema";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  details: { route?: string; gameSlug?: string; gameMode?: string } = {},
): void {
  if (typeof window === "undefined") return;
  const payload = {
    eventName,
    dedupeKey: createId(),
    route: details.route ?? window.location.pathname,
    gameSlug: details.gameSlug,
    gameMode: details.gameMode,
  };

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify(payload),
  }).catch(() => {});
}