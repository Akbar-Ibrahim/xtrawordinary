import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { ArrowLeft, CalendarRange, Trophy } from "lucide-react";
import type { GroupSeason } from "@shared/schema";
import type { SeasonLeaderboardEntry } from "./group-detail/types";

export default function GroupSeasonSummary() {
  const params = useParams<{ id: string; seasonId: string }>();
  const groupId = parseInt(params.id);
  const seasonId = parseInt(params.seasonId);

  const { data: seasons, isLoading: seasonsLoading } = useQuery<GroupSeason[]>({
    queryKey: ["/api/groups", groupId, "seasons"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/seasons`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load seasons");
      return res.json();
    },
    enabled: !isNaN(groupId),
  });

  const season = seasons?.find((s) => s.id === seasonId);

  const { data: lb = [], isLoading: lbLoading } = useQuery<SeasonLeaderboardEntry[]>({
    queryKey: ["/api/groups", groupId, "seasons", seasonId, "leaderboard"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/seasons/${seasonId}/leaderboard`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load leaderboard");
      return res.json();
    },
    enabled: !isNaN(groupId) && !isNaN(seasonId),
  });

  const isLoading = seasonsLoading || lbLoading;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href={`/groups/${groupId}`}>
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-group">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Group
        </Button>
      </Link>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : !season ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Season not found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">Ended</Badge>
              <h1 className="text-2xl font-bold" data-testid="text-season-summary-name">{season.name}</h1>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              {new Date(season.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {" — "}
              {new Date(season.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>

          {season.winnerName && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-5 flex items-center gap-3">
                <Trophy className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Season Champion</p>
                  <p className="font-bold text-lg" data-testid="text-season-champion">{season.winnerName}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Final Standings</h2>
            {lb.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No scores were recorded this season.</p>
            ) : (
              <div className="space-y-2">
                {lb.map((entry, i) => (
                  <Card key={entry.userId} data-testid={`card-summary-lb-${entry.userId}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <span
                        className={`text-xl font-bold w-8 text-center ${
                          i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"
                        }`}
                      >
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </span>
                      <Link href={`/profile/${entry.userId}`}>
                        <UserAvatar name={entry.name} avatarUrl={entry.avatarUrl} className="h-9 w-9 cursor-pointer" />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${entry.userId}`}>
                          <p className="font-semibold truncate hover:underline cursor-pointer">{entry.name}</p>
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {entry.roundsPlayed} round{entry.roundsPlayed !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="font-bold text-lg">{entry.totalScore.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
