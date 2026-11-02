import { Link } from "wouter";
import * as LucideIcons from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Game } from "@shared/schema";
import { getRelatedGames } from "./similar-games";

interface RelatedGamesSectionProps {
  game: Game;
  allGames: Game[];
}

export function RelatedGamesSection({ game, allGames }: RelatedGamesSectionProps) {
  if (allGames.length <= 1) return null;

  const { heading, games } = getRelatedGames(game, allGames);
  if (games.length === 0) return null;

  const headingId = heading === "Similar Games" ? "similar-games-heading" : "more-games-heading";

  return (
    <section className="min-w-0" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-semibold mb-3">{heading}</h2>
      <div
        className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory scrollbar-none"
        data-testid="related-games-carousel"
      >
        {games.map((relatedGame) => {
          const GameIcon = ((LucideIcons as any)[relatedGame.icon] ?? LucideIcons.Gamepad2) as React.ElementType;
          return (
            <Link key={relatedGame.slug} href={`/game/${relatedGame.slug}`} className="snap-start shrink-0 w-56">
              <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-related-game-${relatedGame.slug}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: relatedGame.color }}
                  >
                    <GameIcon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate mb-0.5">{relatedGame.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{relatedGame.description}</p>
                  </div>
                  <LucideIcons.ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
