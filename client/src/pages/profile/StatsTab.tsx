import { Flame, Calendar, Gamepad2, Trophy } from "lucide-react";
import type { UserGameStats } from "@shared/schema";

interface Props {
  profileName: string;
  stats: UserGameStats[];
  isOwnProfile: boolean;
  isAuthenticated: boolean;
  ownStreak: { currentStreak: number; longestStreak: number; lastPlayedDate: string | null } | null | undefined;
  ownDailyStreak: { streak: number; longest: number } | null | undefined;
  viewedStreak: { currentStreak: number; longestStreak: number; lastPlayedDate: string | null } | null | undefined;
  formatGameName: (slug: string) => string;
}

export function StatsTab({
  profileName,
  stats,
  isOwnProfile,
  isAuthenticated,
  ownStreak,
  ownDailyStreak,
  viewedStreak,
  formatGameName,
}: Props) {
  return (
    <>
      {!isOwnProfile && viewedStreak && (viewedStreak.currentStreak > 0 || viewedStreak.longestStreak > 0) && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50 mb-4" data-testid="card-streak-comparison">
          <Flame className="h-5 w-5 text-orange-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Daily Streak</p>
            <p className="font-bold text-orange-600 dark:text-orange-400" data-testid="text-viewed-streak">
              {profileName.split(" ")[0]} · {viewedStreak.currentStreak} {viewedStreak.currentStreak === 1 ? "day" : "days"}
            </p>
            {isAuthenticated && ownStreak && (
              <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-own-streak-comparison">
                {ownStreak.currentStreak > 0
                  ? `You · ${ownStreak.currentStreak} ${ownStreak.currentStreak === 1 ? "day" : "days"}`
                  : "You don't have an active streak yet"}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Best</p>
            <p className="font-semibold text-sm" data-testid="text-viewed-longest-streak">{viewedStreak.longestStreak}d</p>
          </div>
        </div>
      )}

      {isOwnProfile && ownStreak && (ownStreak.currentStreak > 0 || ownStreak.longestStreak > 0) && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50 mb-4" data-testid="card-streak">
          <div className="flex items-center gap-2 flex-1">
            <Flame className="h-5 w-5 text-orange-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Play Streak</p>
              <p className="font-bold text-orange-600 dark:text-orange-400" data-testid="text-current-streak">
                {ownStreak.currentStreak} {ownStreak.currentStreak === 1 ? "day" : "days"}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Best streak</p>
            <p className="font-semibold text-sm" data-testid="text-longest-streak">{ownStreak.longestStreak}d</p>
          </div>
        </div>
      )}

      {isOwnProfile && ownDailyStreak && (ownDailyStreak.streak > 0 || ownDailyStreak.longest > 0) && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 mb-4" data-testid="card-daily-streak">
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Daily Challenge Streak</p>
              <p className="font-bold text-blue-600 dark:text-blue-400" data-testid="text-daily-challenge-streak">
                {ownDailyStreak.streak} {ownDailyStreak.streak === 1 ? "day" : "days"}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Best streak</p>
            <p className="font-semibold text-sm" data-testid="text-longest-daily-streak">{ownDailyStreak.longest}d</p>
          </div>
        </div>
      )}

      {stats.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Gamepad2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No games played yet</p>
          <p className="text-sm">Play some games to see stats here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(() => {
            const fav = stats.reduce((best, s) => s.gamesPlayed > best.gamesPlayed ? s : best, stats[0]);
            return (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-3" data-testid="card-favourite-game">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Favourite Game</p>
                  <p className="font-semibold truncate" data-testid="text-favourite-game-name">{formatGameName(fav.gameSlug)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary" data-testid="text-favourite-game-plays">{fav.gamesPlayed}</p>
                  <p className="text-xs text-muted-foreground">plays</p>
                </div>
              </div>
            );
          })()}
          {stats.map((stat) => (
            <div key={stat.gameSlug} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-game-stat-${stat.gameSlug}`}>
              <div>
                <p className="font-medium">{formatGameName(stat.gameSlug)}</p>
                <p className="text-xs text-muted-foreground">{stat.gamesPlayed} played, {stat.gamesWon} won</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{stat.bestScore.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Best Score</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
