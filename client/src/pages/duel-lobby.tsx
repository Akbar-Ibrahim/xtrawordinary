import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Swords, Loader2, RefreshCw, Users, Clock, ArrowRight, Zap } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import { DUEL_GAME_SLUGS, DUEL_TURN_SLUGS, DUEL_RACE_SLUGS } from "@shared/schema";
import type { Game } from "@shared/schema";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface OpenChallenge {
  id: number;
  challengerId: number;
  challengerName: string | null;
  challengerAvatarUrl: string | null;
  gameSlug: string;
  message: string | null;
  roomCode: string | null;
  createdAt: string;
}

const ALL_GAME_LABELS: Record<string, string> = {
  "word-chain": "Word Chain",
  "letter-hunt": "Letter Hunt",
  "word-length": "Word Length",
  "letter-frequency": "Letter Frequency",
  "letter-position": "Letter Position",
  "letter-balance": "Letter Balance",
  "word-scramble": "Word Scramble",
  "no-repeats": "No Repeats",
  "anagram-solver": "Anagram Solver",
  "word-stack": "Word Stack",
  "letter-pool": "Letter Pool",
  "word-maker": "Word Maker",
  "word-split": "Word Split",
  "definition-match": "Definition Match",
};

function GameIcon({ game }: { game: Game }) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] ?? LucideIcons.Gamepad2;
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: game.color }}
    >
      <Icon className="h-4 w-4 text-white" />
    </div>
  );
}

function FormatBadge({ slug }: { slug: string }) {
  const isTurn = DUEL_TURN_SLUGS.has(slug);
  const isRace = DUEL_RACE_SLUGS.has(slug);
  if (isTurn && isRace) {
    return <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">Both</Badge>;
  }
  if (isTurn) {
    return <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0">⚔️ Turn-Based</Badge>;
  }
  return <Badge className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-0">⚡ Race</Badge>;
}

function DuelGameCard({ game }: { game: Game }) {
  return (
    <Card className="h-full" data-testid={`card-duel-game-${game.slug}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <GameIcon game={game} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="font-semibold text-sm truncate">{game.name}</p>
            <FormatBadge slug={game.slug} />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{game.description}</p>
        </div>
        <Link href={`/game/${game.slug}`}>
          <Button size="sm" variant="secondary" className="shrink-0 gap-1.5" data-testid={`button-play-duel-${game.slug}`}>
            <Swords className="h-3.5 w-3.5" />
            Play
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function DuelLobby() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [joiningId, setJoiningId] = useState<number | null>(null);

  const { data: allGames = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const duelGames = allGames.filter((g) => DUEL_GAME_SLUGS.has(g.slug));
  const turnGames = duelGames.filter((g) => DUEL_TURN_SLUGS.has(g.slug));
  const raceGames = duelGames.filter((g) => DUEL_RACE_SLUGS.has(g.slug));

  const { data: openChallenges = [], isLoading, refetch, isFetching } = useQuery<OpenChallenge[]>({
    queryKey: ["/api/duels/open", gameFilter],
    queryFn: async () => {
      const params = gameFilter !== "all" ? `?gameSlug=${gameFilter}` : "";
      const res = await fetch(`/api/duels/open${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  const joinMutation = useMutation({
    mutationFn: async (challengeId: number) => {
      const res = await apiRequest("PATCH", `/api/duels/challenges/${challengeId}/accept`, {});
      return res.json() as Promise<{ roomCode: string | null }>;
    },
    onSuccess: (data) => {
      if (data.roomCode) {
        navigate(`/duel/${data.roomCode}`);
      } else {
        toast({ title: "Error", description: "Could not join room.", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Could not join", description: err?.message ?? "The challenge may have been taken.", variant: "destructive" });
      refetch();
    },
    onSettled: () => setJoiningId(null),
  });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-10">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Swords className="h-7 w-7 text-violet-500" />
        <div>
          <h1 className="text-2xl font-bold">Duels</h1>
          <p className="text-sm text-muted-foreground">Challenge a friend or join an open duel — turn-based or simultaneous race.</p>
        </div>
      </div>

      {/* ── Game Directory ── */}
      <section>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          Pick a Game
        </h2>

        {/* Turn-Based */}
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">⚔️ Turn-Based</span>
            <span className="text-xs text-muted-foreground">— alternate turns, 8-second timer, lives system</span>
          </div>
          {turnGames.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {turnGames.map((g) => <DuelGameCard key={g.slug} game={g} />)}
            </div>
          )}
        </div>

        {/* Race */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
              <Zap className="h-3.5 w-3.5 inline mr-0.5 -mt-0.5" />
              Race
            </span>
            <span className="text-xs text-muted-foreground">— simultaneous play, first to target wins</span>
          </div>
          {raceGames.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {raceGames.map((g) => <DuelGameCard key={g.slug} game={g} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── Open Challenges ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Open Challenges
          </h2>
          {isAuthenticated && (
            <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-lobby">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>

        {!isAuthenticated ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <Swords className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-sm">Sign in to join open duels or post your own challenge.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-3">
              <Select value={gameFilter} onValueChange={setGameFilter}>
                <SelectTrigger className="w-48" data-testid="select-lobby-filter">
                  <SelectValue placeholder="All games" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All games</SelectItem>
                  {Array.from(DUEL_GAME_SLUGS).map((slug) => (
                    <SelectItem key={slug} value={slug}>{ALL_GAME_LABELS[slug] ?? slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : openChallenges.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-sm">No open challenges right now.</p>
                  <p className="text-xs mt-1">Go to a game above and post an open challenge to start one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {openChallenges.map((c) => {
                  const isJoining = joiningId === c.id && joinMutation.isPending;
                  return (
                    <Card key={c.id} data-testid={`card-open-challenge-${c.id}`} className="border border-violet-200 dark:border-violet-900">
                      <CardContent className="flex items-center gap-4 py-4">
                        <UserAvatar name={c.challengerName ?? "?"} avatarUrl={c.challengerAvatarUrl} className="h-10 w-10 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{c.challengerName ?? "Unknown player"}</p>
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5 shrink-0">
                              <Clock className="h-3 w-3" />
                              {timeAgo(c.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {ALL_GAME_LABELS[c.gameSlug] ?? c.gameSlug}
                            </Badge>
                            {c.message && (
                              <span className="text-xs text-muted-foreground truncate">"{c.message}"</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0 gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                          disabled={isJoining || c.challengerId === user?.id}
                          onClick={() => {
                            setJoiningId(c.id);
                            joinMutation.mutate(c.id);
                          }}
                          data-testid={`button-join-duel-${c.id}`}
                        >
                          {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                          {c.challengerId === user?.id ? "Your challenge" : "Join"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
