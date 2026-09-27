import type { Game } from "@shared/schema";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type AdminOverviewStats = {
  totalUsers: number;
  totalGamesPlayed: number;
  gamesPerSlug: Record<string, number>;
};

export function AnalyticsSiteTotals({
  stats,
  games,
}: {
  stats?: AdminOverviewStats;
  games: Game[];
}) {
  const sortedGames = Object.entries(stats?.gamesPerSlug ?? {}).sort(([, a], [, b]) => b - a);
  const nameMap = Object.fromEntries(games.map(game => [game.slug, game.name]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card data-testid="card-total-users">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.totalUsers ?? 0}</div></CardContent>
        </Card>
        <Card data-testid="card-total-games">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Games Played</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.totalGamesPlayed ?? 0}</div></CardContent>
        </Card>
        <Card data-testid="card-unique-games">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Game Types</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{sortedGames.length}</div></CardContent>
        </Card>
      </div>

      {sortedGames.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Registered-player game totals</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedGames.map(([slug, count]) => {
                const maxCount = sortedGames[0][1];
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const displayName = nameMap[slug] ?? slug;
                return (
                  <div key={slug} className="flex items-center gap-3" data-testid={`game-stat-${slug}`}>
                    <Link
                      href={`/game/${slug}`}
                      className="w-44 shrink-0 truncate text-sm font-medium hover:text-primary hover:underline"
                      title={displayName}
                    >
                      {displayName}
                    </Link>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-sm text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}