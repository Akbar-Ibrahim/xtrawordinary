import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2 } from "lucide-react";
import type { LeaderboardEntry } from "@shared/schema/stats";

interface Props {
  gameFilter: string;
  setGameFilter: (v: string) => void;
}

export function LeaderboardTab({ gameFilter, setGameFilter }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useQuery<LeaderboardEntry[]>({ queryKey: ["/api/admin/leaderboard"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/leaderboard/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/leaderboard"] }); toast({ title: "Entry deleted" }); },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  const filtered = entries?.filter(e => gameFilter === "all" || e.gameSlug === gameFilter) ?? [];
  const gameSlugs = [...new Set(entries?.map(e => e.gameSlug) ?? [])].sort();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Leaderboard Entries ({filtered.length})</CardTitle>
          <Select value={gameFilter} onValueChange={setGameFilter}>
            <SelectTrigger className="w-48" data-testid="select-admin-game-filter">
              <SelectValue placeholder="Filter by game" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Games</SelectItem>
              {gameSlugs.map(slug => (
                <SelectItem key={slug} value={slug}>{slug}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!filtered.length ? (
          <p className="text-muted-foreground text-center py-8" data-testid="text-no-entries">No leaderboard entries.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Player</th>
                  <th className="text-left py-3 px-2">Game</th>
                  <th className="text-left py-3 px-2">Score</th>
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-right py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-b hover:bg-muted/50" data-testid={`lb-row-${entry.id}`}>
                    <td className="py-3 px-2 font-medium">{entry.playerName}</td>
                    <td className="py-3 px-2 text-muted-foreground">{entry.gameSlug}</td>
                    <td className="py-3 px-2 font-bold">{entry.score}</td>
                    <td className="py-3 px-2 text-muted-foreground">{new Date(entry.playedAt).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-right">
                      <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(entry.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-lb-${entry.id}`}>
                        <Trash2 className="h-3 w-3 mr-1" />Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
