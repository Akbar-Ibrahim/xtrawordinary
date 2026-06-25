import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Sword, Crown } from "lucide-react";

interface Props {
  wordWarsStats: { tournamentsEntered: number; matchWins: number; matchLosses: number } | null | undefined;
  championships: Array<{ id: number; tournamentId: number; createdAt: string; tournamentName: string }>;
}

export function WordWarsCard({ wordWarsStats, championships }: Props) {
  if (!wordWarsStats || (wordWarsStats.tournamentsEntered === 0 && championships.length === 0)) return null;

  const totalDecided = wordWarsStats.matchWins + wordWarsStats.matchLosses;
  const winRate = totalDecided > 0 ? Math.round((wordWarsStats.matchWins / totalDecided) * 100) : null;

  return (
    <Card className="border-amber-300 dark:border-amber-700" data-testid="card-word-wars-stats">
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Sword className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Word Wars</p>
              <p className="text-xs text-muted-foreground">
                {wordWarsStats.tournamentsEntered} {wordWarsStats.tournamentsEntered === 1 ? "tournament" : "tournaments"} entered
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3 justify-end mb-1">
              <div className="text-center">
                <p className="text-xl font-black text-amber-600 dark:text-amber-400" data-testid="text-word-wars-match-wins">{wordWarsStats.matchWins}</p>
                <p className="text-[10px] text-muted-foreground">Wins</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-muted-foreground" data-testid="text-word-wars-match-losses">{wordWarsStats.matchLosses}</p>
                <p className="text-[10px] text-muted-foreground">Losses</p>
              </div>
              {winRate !== null && (
                <div className="text-center">
                  <p className="text-xl font-black text-foreground" data-testid="text-word-wars-win-rate">{winRate}%</p>
                  <p className="text-[10px] text-muted-foreground">Win Rate</p>
                </div>
              )}
            </div>
            <Link href="/word-wars">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer" data-testid="link-word-wars-profile">
                View tournaments
              </span>
            </Link>
          </div>
        </div>
        {championships.length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/50">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
              <Crown className="h-3.5 w-3.5 fill-current" />
              {championships.length === 1 ? "Champion" : `Champion ×${championships.length}`}
            </p>
            <div className="space-y-1">
              {championships.map((c) => (
                <Link key={c.id} href={`/word-wars/${c.tournamentId}`}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid={`row-championship-${c.id}`}>
                    <span className="font-medium truncate">{c.tournamentName}</span>
                    <span className="shrink-0 ml-2">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
