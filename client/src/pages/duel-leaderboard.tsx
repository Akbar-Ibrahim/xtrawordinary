import { PageSEO } from "@/components/page-seo";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Swords, Trophy, TrendingUp, Minus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { PlayerChallengeDialog } from "@/components/player-challenge-dialog";

type FormatFilter = "overall" | "turn" | "race";

interface LeaderboardEntry {
  rank: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl" aria-label="1st">🥇</span>;
  if (rank === 2) return <span className="text-xl" aria-label="2nd">🥈</span>;
  if (rank === 3) return <span className="text-xl" aria-label="3rd">🥉</span>;
  return (
    <span className="text-sm font-bold text-muted-foreground w-7 text-center tabular-nums">
      {rank}
    </span>
  );
}

const FORMAT_OPTIONS: { value: FormatFilter; label: string }[] = [
  { value: "overall", label: "Overall" },
  { value: "turn", label: "Turn-Based" },
  { value: "race", label: "Race" },
];

export default function DuelLeaderboard() {
  const { user, isAuthenticated } = useAuth();
  const [format, setFormat] = useState<FormatFilter>("overall");
  const [challengeTarget, setChallengeTarget] = useState<{ id: number; name: string; avatarUrl: string | null } | null>(null);

  const queryParam = format !== "overall" ? `?format=${format}` : "";

  const { data: entries = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/duels/leaderboard", format],
    queryFn: async () => {
      const res = await fetch(`/api/duels/leaderboard${queryParam}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const myEntry = isAuthenticated && user ? entries.find(e => e.userId === user.id) : undefined;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
      <PageSEO title="Duel Rankings" description="See the top-ranked players in xtraWordinary 1-on-1 word game duels." path="/duels/leaderboard" />
      <div className="flex items-center gap-3">
        <Link href="/duels">
          <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back-duels">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Trophy className="h-6 w-6 text-yellow-500 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold">Duel Rankings</h1>
          <p className="text-sm text-muted-foreground">Top 100 players by ELO rating</p>
        </div>
      </div>

      {/* Format filter toggle */}
      <div className="space-y-1.5">
        <div className="flex gap-2" data-testid="filter-format">
          {FORMAT_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant={format === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFormat(opt.value)}
              data-testid={`button-filter-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        {format !== "overall" && (
          <p className="text-xs text-muted-foreground" data-testid="text-filter-note">
            Showing players who have competed in {format === "turn" ? "Turn-Based" : "Race"} duels, ranked by their overall ELO rating.
          </p>
        )}
      </div>

      {/* Current user's standing (if signed in and ranked) */}
      {isAuthenticated && myEntry && (
        <Card className="border-violet-300 dark:border-violet-700 bg-violet-50/60 dark:bg-violet-950/20" data-testid="card-my-ranking">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <RankMedal rank={myEntry.rank} />
            <UserAvatar name={myEntry.displayName} avatarUrl={myEntry.avatarUrl} className="h-8 w-8 shrink-0 text-xs" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate text-violet-900 dark:text-violet-100">
                Your ranking: #{myEntry.rank}
              </p>
              <p className="text-xs text-violet-700 dark:text-violet-300">
                {myEntry.wins}W · {myEntry.losses}L · {myEntry.draws}D · {myEntry.winRate}% win rate
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Swords className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-lg font-bold text-violet-700 dark:text-violet-300" data-testid="text-my-elo">
                {myEntry.elo}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">
            <Swords className="h-10 w-10 mx-auto mb-3 opacity-25" />
            <p className="font-medium">No rankings yet.</p>
            <p className="text-sm mt-1">
              {format === "overall"
                ? "Complete a duel to appear on the leaderboard."
                : `No players have completed a ${format === "turn" ? "Turn-Based" : "Race"} duel yet.`}
            </p>
            <Link href="/duels">
              <Button className="mt-4 gap-2" data-testid="button-go-duel">
                <Swords className="h-4 w-4" />
                Go to Duels
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {entries.map((entry) => {
              const isMe = isAuthenticated && user?.id === entry.userId;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isMe
                      ? "bg-violet-50 dark:bg-violet-950/30"
                      : "hover:bg-muted/40"
                  }`}
                  data-testid={`row-leaderboard-${entry.userId}`}
                >
                  <div className="w-7 flex items-center justify-center shrink-0">
                    <RankMedal rank={entry.rank} />
                  </div>

                  <Link href={`/profile/${entry.userId}`}>
                    <UserAvatar
                      name={entry.displayName}
                      avatarUrl={entry.avatarUrl}
                      className="h-9 w-9 shrink-0 text-xs cursor-pointer"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${entry.userId}`}>
                        <span
                          className={`font-medium text-sm hover:underline cursor-pointer truncate ${isMe ? "text-violet-700 dark:text-violet-300 font-semibold" : ""}`}
                          data-testid={`text-name-${entry.userId}`}
                        >
                          {entry.displayName}
                          {isMe && <span className="text-xs text-muted-foreground font-normal ml-1">(you)</span>}
                        </span>
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {entry.wins}W · {entry.losses}L · {entry.draws}D
                      </span>
                      {entry.winRate >= 60 ? (
                        <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0">
                          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                          {entry.winRate}%
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-0">
                          <Minus className="h-2.5 w-2.5 mr-0.5" />
                          {entry.winRate}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`text-xl font-black tabular-nums ${
                        entry.rank === 1
                          ? "text-yellow-500"
                          : entry.rank === 2
                          ? "text-slate-400"
                          : entry.rank === 3
                          ? "text-amber-600"
                          : isMe
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-foreground"
                      }`}
                      data-testid={`text-elo-${entry.userId}`}
                    >
                      {entry.elo}
                    </div>
                    {isAuthenticated && !isMe && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-violet-500 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                        onClick={() => setChallengeTarget({ id: entry.userId, name: entry.displayName, avatarUrl: entry.avatarUrl })}
                        data-testid={`button-challenge-${entry.userId}`}
                        title={`Challenge ${entry.displayName}`}
                      >
                        <Swords className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {challengeTarget && (
        <PlayerChallengeDialog
          targetUser={challengeTarget}
          open={!!challengeTarget}
          onOpenChange={(open) => { if (!open) setChallengeTarget(null); }}
        />
      )}
    </div>
  );
}
