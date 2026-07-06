import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trophy, CalendarRange, Timer, Play } from "lucide-react";
import type { GroupSeason, GroupRound } from "@shared/schema";
import type { SeasonLeaderboardEntry } from "./types";
import { useCountdown } from "./utils";
import { GAME_NAMES } from "./constants";

function SeasonLeaderboard({ groupId, seasonId, isAdmin, onEnd }: { groupId: number; seasonId: number; isAdmin: boolean; onEnd: () => void }) {
  const { data: lb = [], isLoading } = useQuery<SeasonLeaderboardEntry[]>({
    queryKey: ["/api/groups", groupId, "seasons", seasonId, "leaderboard"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/seasons/${seasonId}/leaderboard`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;
  if (!lb.length) return <p className="text-sm text-muted-foreground text-center py-6">No scores yet this season. Play a round!</p>;

  return (
    <div className="space-y-2">
      {lb.map((entry, i) => (
        <Card key={entry.userId} data-testid={`card-season-lb-${entry.userId}`}>
          <CardContent className="p-4 flex items-center gap-4">
            <span className={`text-xl font-bold w-8 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            <Link href={`/profile/${entry.userId}`}>
              <UserAvatar name={entry.name} avatarUrl={entry.avatarUrl} className="h-9 w-9 cursor-pointer" />
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${entry.userId}`}>
                <p className="font-semibold truncate hover:underline cursor-pointer">{entry.name}</p>
              </Link>
              <p className="text-xs text-muted-foreground">{entry.roundsPlayed} round{entry.roundsPlayed !== 1 ? "s" : ""}</p>
            </div>
            <p className="font-bold text-lg">{entry.totalScore.toLocaleString()}</p>
          </CardContent>
        </Card>
      ))}
      {isAdmin && (
        <div className="pt-2">
          <Button variant="destructive" size="sm" onClick={onEnd} data-testid="button-end-season">
            End Season Early
          </Button>
        </div>
      )}
    </div>
  );
}

export function SeasonTab({ groupId, isAdmin }: { groupId: number; isAdmin: boolean }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [durationWeeks, setDurationWeeks] = useState("2");

  const { data: seasons = [], isLoading } = useQuery<GroupSeason[]>({
    queryKey: ["/api/groups", groupId, "seasons"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/seasons`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const activeSeason = seasons.find(s => s.status === "active");
  const pastSeasons = seasons.filter(s => s.status === "ended");

  const createMutation = useMutation({
    mutationFn: async () => {
      const startsAt = new Date().toISOString();
      const endsAt = new Date(Date.now() + parseInt(durationWeeks) * 7 * 24 * 60 * 60 * 1000).toISOString();
      return apiRequest("POST", `/api/groups/${groupId}/seasons`, { name: seasonName.trim(), startsAt, endsAt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "seasons"] });
      setCreateOpen(false);
      setSeasonName("");
      toast({ title: "Season started!" });
    },
    onError: (e: any) => toast({ title: "Failed to start season", description: e.message, variant: "destructive" }),
  });

  const endMutation = useMutation({
    mutationFn: async (seasonId: number) => apiRequest("PATCH", `/api/groups/${groupId}/seasons/${seasonId}/end`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "seasons"] });
      toast({ title: "Season ended" });
    },
    onError: () => toast({ title: "Failed to end season", variant: "destructive" }),
  });

  const countdown = useCountdown(activeSeason?.endsAt ?? new Date(0).toISOString());

  const { data: rounds = [] } = useQuery<GroupRound[]>({
    queryKey: ["/api/groups", groupId, "rounds"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/rounds`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!activeSeason,
    refetchInterval: 30_000,
  });

  const todaysRound = activeSeason
    ? rounds.find(r => r.seasonId === activeSeason.id && (r as any).status !== "closed")
    : undefined;

  if (isLoading) return <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Active season */}
      {activeSeason ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 border text-xs">Active</Badge>
                <h3 className="font-semibold text-lg" data-testid="text-active-season-name">{activeSeason.name}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <CalendarRange className="h-3.5 w-3.5" />
                  Started {new Date(activeSeason.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  <span data-testid="text-season-countdown">{countdown}</span>
                </span>
                <span>Ends {new Date(activeSeason.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            </div>
          </div>
          {todaysRound && (
            <Card className="border-primary/30 bg-primary/5" data-testid="card-todays-round">
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Today's Round</p>
                  <p className="font-semibold">{GAME_NAMES[todaysRound.gameSlug] ?? todaysRound.gameSlug}</p>
                </div>
                <Link href={`/groups/${groupId}/rounds/${todaysRound.id}/play`}>
                  <Button size="sm" data-testid="button-play-todays-round">
                    <Play className="h-4 w-4 mr-1.5" />
                    Play
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
          <SeasonLeaderboard
            groupId={groupId}
            seasonId={activeSeason.id}
            isAdmin={isAdmin}
            onEnd={() => endMutation.mutate(activeSeason.id)}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarRange className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No active season</p>
            <p className="text-sm text-muted-foreground mb-4">
              {isAdmin ? "Start a season to run a timed points competition among members." : "No season is currently running."}
            </p>
            {isAdmin && (
              <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-start-season">
                <Plus className="h-4 w-4 mr-1" />
                Start Season
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Past seasons */}
      {pastSeasons.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Past Seasons</h3>
          <div className="space-y-2">
            {pastSeasons.map((s) => (
              <Link key={s.id} href={`/groups/${groupId}/seasons/${s.id}`}>
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors" data-testid={`card-past-season-${s.id}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <CalendarRange className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" — "}
                        {new Date(s.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    {s.winnerName && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium">{s.winnerName}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Start Season dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Season</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="season-name">Season Name</Label>
              <Input
                id="season-name"
                placeholder="e.g. Summer 2026"
                value={seasonName}
                onChange={e => setSeasonName(e.target.value)}
                data-testid="input-season-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="season-duration">Duration</Label>
              <Select value={durationWeeks} onValueChange={setDurationWeeks}>
                <SelectTrigger id="season-duration" data-testid="select-season-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 week</SelectItem>
                  <SelectItem value="2">2 weeks</SelectItem>
                  <SelectItem value="4">4 weeks</SelectItem>
                  <SelectItem value="8">8 weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!seasonName.trim() || createMutation.isPending}
              data-testid="button-confirm-start-season"
            >
              {createMutation.isPending ? "Starting…" : "Start Season"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
