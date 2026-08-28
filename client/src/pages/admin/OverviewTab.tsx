import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import type { Game } from "@shared/schema";
import { AnalyticsOverview } from "./AnalyticsOverview";

export function OverviewTab() {
  const { data: stats, isLoading } = useQuery<{ totalUsers: number; totalGamesPlayed: number; gamesPerSlug: Record<string, number> }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: games } = useQuery<Game[]>({ queryKey: ["/api/admin/games"] });
  const nameMap = Object.fromEntries((games ?? []).map(g => [g.slug, g.name]));

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const sortedGames = stats?.gamesPerSlug
    ? Object.entries(stats.gamesPerSlug).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div className="space-y-6">
      <AnalyticsOverview games={games ?? []} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      href={`/games/${slug}`}
                      className="text-sm w-44 truncate font-medium hover:text-primary hover:underline shrink-0"
                      title={displayName}
                    >
                      {displayName}
                    </Link>
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
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
