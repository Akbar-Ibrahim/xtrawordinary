import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { Trophy, Swords, TrendingUp, TrendingDown } from "lucide-react";
import type { GuildWarsStats, LeaderboardEntry } from "./types";

export function LeaderboardTab({
  leaderboard,
  lbLoading,
  guildWarsStats,
}: {
  leaderboard: LeaderboardEntry[] | undefined;
  lbLoading: boolean;
  guildWarsStats: GuildWarsStats | undefined;
}) {
  return (
    <TabsContent value="leaderboard">
      {lbLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : !leaderboard || leaderboard.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No scores yet. Play a round to get on the board!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, i) => (
            <Card key={entry.userId} data-testid={`card-lb-${entry.userId}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className={`text-xl font-bold w-8 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <Link href={`/profile/${entry.userId}`}>
                  <UserAvatar name={entry.name} avatarUrl={entry.avatarUrl} className="h-9 w-9 cursor-pointer" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${entry.userId}`}>
                    <p className="font-semibold truncate hover:underline cursor-pointer">{entry.name}</p>
                  </Link>
                  <p className="text-xs text-muted-foreground">{entry.roundsPlayed} round{entry.roundsPlayed !== 1 ? "s" : ""} played</p>
                </div>
                <p className="font-bold text-lg">{entry.totalScore.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Guild Wars Stats ──────────────────────────────────────── */}
      {guildWarsStats && (guildWarsStats.tournamentsEntered > 0 || guildWarsStats.championshipsWon > 0) && (
        <Card className="mt-4 border-purple-300/40 dark:border-purple-700/40" data-testid="card-guild-wars-stats">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <Swords className="h-4 w-4" />
              Guild Wars Record
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-3">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="space-y-0.5">
                <p className="text-xl font-bold">{guildWarsStats.tournamentsEntered}</p>
                <p className="text-xs text-muted-foreground">Entered</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{guildWarsStats.matchWins}</p>
                <p className="text-xs text-muted-foreground">Wins</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xl font-bold text-red-500">{guildWarsStats.matchLosses}</p>
                <p className="text-xs text-muted-foreground">Losses</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xl font-bold text-amber-500">{guildWarsStats.championshipsWon}</p>
                <p className="text-xs text-muted-foreground">🏆 Titles</p>
              </div>
            </div>
            {guildWarsStats.activeTournament && (
              <div className="flex items-center gap-2 pt-1 border-t border-purple-200/40 dark:border-purple-700/30">
                <span className="text-xs text-muted-foreground">Active:</span>
                <Link href={`/guild-wars/${guildWarsStats.activeTournament.id}`}>
                  <Badge variant="outline" className="text-xs border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/30" data-testid="badge-active-guild-war">
                    {guildWarsStats.activeTournament.name}
                  </Badge>
                </Link>
              </div>
            )}
            {guildWarsStats.recentMatches && guildWarsStats.recentMatches.length > 0 && (
              <div className="pt-1 border-t border-purple-200/40 dark:border-purple-700/30">
                <p className="text-xs text-muted-foreground mb-1.5">Recent battles:</p>
                <div className="space-y-1">
                  {guildWarsStats.recentMatches.map((m) => (
                    <Link key={m.matchId} href={`/guild-wars/${m.tournamentId}`}>
                      <div className="flex items-center gap-2 py-0.5 cursor-pointer hover:opacity-80" data-testid={`row-recent-match-${m.matchId}`}>
                        {m.outcome === "win" ? (
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                        <span className={`text-[11px] font-medium ${m.outcome === "win" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                          {m.outcome === "win" ? "W" : "L"}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {m.tournamentName}
                          {m.opponentGroupName ? ` vs ${m.opponentGroupName}` : ""}
                          {" · "}Rd {m.round}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {guildWarsStats.recentChampionships.length > 0 && (
              <div className="pt-1 border-t border-purple-200/40 dark:border-purple-700/30">
                <p className="text-xs text-muted-foreground mb-1.5">Titles:</p>
                <div className="flex flex-wrap gap-1.5">
                  {guildWarsStats.recentChampionships.map((c) => (
                    <Link key={c.tournamentId} href={`/guild-wars/${c.tournamentId}`}>
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 cursor-pointer hover:opacity-80" data-testid={`badge-guild-war-title-${c.tournamentId}`}>
                        🏆 {c.tournamentName}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
}
