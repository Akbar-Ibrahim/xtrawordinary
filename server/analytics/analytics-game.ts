import type { Game } from "@shared/schema";

export function findAnalyticsGame(
  games: Game[],
  requestedSlug: string,
): Game | undefined {
  return games.find(
    (game) =>
      game.slug === requestedSlug ||
      game.modes?.some((mode) => mode.slug === requestedSlug),
  );
}
