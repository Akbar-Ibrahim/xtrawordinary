export const TRACKED_ANALYTICS_MODES = [
  { slug: "timed", label: "Timed" },
  { slug: "untimed", label: "Untimed" },
  { slug: "custom", label: "Custom" },
] as const;

export function buildAnalyticsQuery(
  startDate: string,
  endDate: string,
  gameSlug?: string,
  gameMode?: string,
): string {
  const params = new URLSearchParams({ startDate, endDate });
  if (gameSlug) params.set("gameSlug", gameSlug);
  if (gameMode) params.set("gameMode", gameMode);
  return params.toString();
}