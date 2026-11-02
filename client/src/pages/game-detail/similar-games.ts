import type { Game } from "@shared/schema";
import { DEFAULT_SIMILAR_GAME_SLUGS } from "@shared/similar-games";

export interface RelatedGames {
  heading: "Similar Games" | "More Games";
  games: Game[];
}

export function getRelatedGames(game: Game, allGames: Game[]): RelatedGames {
  const availableGames = new Map(allGames.map((candidate) => [candidate.slug, candidate]));
  const slugs = game.similarGameSlugs ?? DEFAULT_SIMILAR_GAME_SLUGS[game.slug] ?? [];
  const curatedMatches = slugs
    .map((slug) => availableGames.get(slug))
    .filter((candidate): candidate is Game => candidate !== undefined && candidate.slug !== game.slug);

  if (curatedMatches.length > 0) {
    return { heading: "Similar Games", games: curatedMatches };
  }

  return {
    heading: "More Games",
    games: allGames.filter((candidate) => candidate.slug !== game.slug),
  };
}
