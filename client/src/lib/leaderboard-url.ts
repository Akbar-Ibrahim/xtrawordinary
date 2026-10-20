export interface LeaderboardUrlSelection {
  gameSlug: string | null;
  modeSlug: string | null;
  isSurvival: boolean;
  hasSurvivalParam: boolean;
}

export function parseLeaderboardUrl(search: string): LeaderboardUrlSelection {
  const params = new URLSearchParams(search);
  const survival = params.get("survival")?.toLowerCase();

  return {
    gameSlug: params.get("game"),
    modeSlug: params.get("mode"),
    isSurvival: survival === "1" || survival === "true",
    hasSurvivalParam: params.has("survival"),
  };
}

export function resolveLeaderboardModeSlug(
  modes: readonly { slug: string }[] | undefined,
  requestedModeSlug: string | null | undefined,
): string {
  if (requestedModeSlug && modes?.some((mode) => mode.slug === requestedModeSlug)) {
    return requestedModeSlug;
  }
  return modes?.[0]?.slug ?? "";
}

export function resolveLeaderboardGameSlug(
  games: readonly { slug: string }[] | undefined,
  requestedGameSlug: string | null | undefined,
): string {
  if (
    requestedGameSlug === "overall" ||
    requestedGameSlug === "streaks" ||
    (requestedGameSlug && games?.some((game) => game.slug === requestedGameSlug))
  ) {
    return requestedGameSlug;
  }
  return "overall";
}

export function buildLeaderboardUrl(
  gameSlug: string,
  modeSlug?: string,
  isSurvival = false,
): string {
  const params = new URLSearchParams();
  if (gameSlug !== "overall") params.set("game", gameSlug);
  if (gameSlug !== "overall" && modeSlug) params.set("mode", modeSlug);
  if (gameSlug !== "overall" && isSurvival) params.set("survival", "1");

  const query = params.toString();
  return `/leaderboard${query ? `?${query}` : ""}`;
}
