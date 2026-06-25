import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Swords } from "lucide-react";

interface DuelRatingData {
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

interface Props {
  duelRating: DuelRatingData | null | undefined;
  hasDuelActivity: boolean;
  duelRank: number | null;
  totalDuelPlayers: number;
}

export function DuelRatingCard({ duelRating, hasDuelActivity, duelRank, totalDuelPlayers }: Props) {
  if (!duelRating || !hasDuelActivity) return null;

  const totalMatches = duelRating.wins + duelRating.losses + duelRating.draws;
  const winRate = duelRating.wins + duelRating.losses > 0
    ? Math.round((duelRating.wins / (duelRating.wins + duelRating.losses)) * 100)
    : null;

  return (
    <Card className="border-violet-300 dark:border-violet-700" data-testid="card-duel-elo">
      <CardContent className="py-4 px-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-violet-500" />
            <div>
              <p className="font-semibold text-sm">Duel Rating</p>
              <p className="text-xs text-muted-foreground">Rated ELO · {totalMatches} matches</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-violet-600 dark:text-violet-400" data-testid="text-duel-elo">{duelRating.elo}</p>
            <p className="text-xs text-muted-foreground">
              {duelRating.wins}W · {duelRating.losses}L · {duelRating.draws}D
              {winRate !== null && <> · {winRate}% win rate</>}
            </p>
            {duelRank !== null && totalDuelPlayers > 0 && (
              <Link href="/duels/leaderboard">
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer" data-testid="link-duel-rank">
                  #{duelRank} of {totalDuelPlayers} players
                </span>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
