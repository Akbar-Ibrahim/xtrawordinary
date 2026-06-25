import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function OverviewTab() {
  const { data: stats, isLoading } = useQuery<{ totalUsers: number; totalGamesPlayed: number; gamesPerSlug: Record<string, number> }>({
    queryKey: ["/api/admin/stats"],
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const sortedGames = stats?.gamesPerSlug
    ? Object.entries(stats.gamesPerSlug).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div className="space-y-6">
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
          <CardHeader><CardTitle>Games by Popularity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedGames.map(([slug, count]) => {
                const maxCount = sortedGames[0][1];
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={slug} className="flex items-center gap-3" data-testid={`game-stat-${slug}`}>
                    <span className="text-sm w-40 truncate font-medium">{slug}</span>
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
