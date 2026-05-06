import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import { Trophy, Swords, Crown, Play, CheckCircle2, Clock, Users, ArrowLeft, Loader2, ChevronRight, ChevronDown, Shield, XCircle, Circle } from "lucide-react";
import { motion } from "framer-motion";
import type { WordWarsTournament, WordWarsMatch, WordWarsMatchGame } from "@shared/schema";

function useCountdown(isoDeadline: string) {
  const [remaining, setRemaining] = useState(() => new Date(isoDeadline).getTime() - Date.now());

  useEffect(() => {
    setRemaining(new Date(isoDeadline).getTime() - Date.now());
    const id = setInterval(() => {
      setRemaining(new Date(isoDeadline).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [isoDeadline]);

  return remaining;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Drawing bracket…";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

type MatchWithGames = WordWarsMatch & { games: WordWarsMatchGame[] };
type PlayerInfo = { id: number; name: string; avatarUrl: string | null };
type TournamentDetail = {
  tournament: WordWarsTournament;
  registrations: Array<{ id: number; tournamentId: number; userId: number; createdAt: string }>;
  matches: MatchWithGames[];
  players: Record<number, PlayerInfo>;
};

function slugToLabel(slug: string): string {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function MatchCard({
  match,
  players,
  currentUserId,
  tournamentId,
  isHighlighted,
}: {
  match: MatchWithGames;
  players: Record<number, PlayerInfo>;
  currentUserId: number | undefined;
  tournamentId: number;
  isHighlighted?: boolean;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const p1 = match.player1Id ? players[match.player1Id] : null;
  const p2 = match.player2Id ? players[match.player2Id] : null;

  const isBye = match.status === "bye";
  const isUserMatch = currentUserId != null && (match.player1Id === currentUserId || match.player2Id === currentUserId);
  const isActive = match.status === "pending" || match.status === "active";

  const p1Wins = match.games.filter(g => g.status === "completed" && g.winnerId === match.player1Id).length;
  const p2Wins = match.games.filter(g => g.status === "completed" && g.winnerId === match.player2Id).length;

  const startGameMutation = useMutation({
    mutationFn: async (gameNumber: number) => {
      const res = await apiRequest("POST", `/api/word-wars/matches/${match.id}/games/${gameNumber}/start`);
      return res.json() as Promise<{ roomCode: string }>;
    },
    onSuccess: ({ roomCode }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/word-wars", tournamentId] });
      navigate(`/duel/${roomCode}`);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isUserHighlighted = isUserMatch && isActive;

  return (
    <Card
      className={`w-52 shrink-0 transition-shadow ${isHighlighted ? "border-primary ring-2 ring-primary/30 shadow-md shadow-primary/20" : isUserHighlighted ? "border-primary shadow-md shadow-primary/10" : ""} ${isBye ? "opacity-60" : ""}`}
      data-testid={`card-match-${match.id}`}
    >
      <CardContent className="p-3 space-y-2">
        {isBye ? (
          <div className="space-y-2">
            <PlayerRow player={p1} isWinner={match.winnerId === match.player1Id} wins={0} isPending={false} />
            <div className="text-xs text-center text-muted-foreground font-medium">BYE</div>
          </div>
        ) : (
          <div className="space-y-1">
            <PlayerRow
              player={p1}
              isWinner={match.status === "completed" && match.winnerId === match.player1Id}
              wins={p1Wins}
              isPending={match.status === "pending" || match.status === "active"}
            />
            <div className="flex items-center justify-center gap-1 py-0.5">
              <span className="text-xs font-bold text-muted-foreground">vs</span>
            </div>
            <PlayerRow
              player={p2}
              isWinner={match.status === "completed" && match.winnerId === match.player2Id}
              wins={p2Wins}
              isPending={match.status === "pending" || match.status === "active"}
            />
          </div>
        )}

        {!isBye && (
          <div className="space-y-1 pt-1 border-t">
            {match.games.map((game) => {
              const isPlayable = isUserMatch && isActive && game.status !== "completed";
              const isCompleted = game.status === "completed";
              const gameWinner = game.winnerId ? players[game.winnerId] : null;

              return (
                <div key={game.gameNumber} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground w-4 shrink-0">G{game.gameNumber}</span>
                  <span className="text-[10px] truncate flex-1 text-muted-foreground">
                    {slugToLabel(game.gameSlug)}
                  </span>
                  {isCompleted ? (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                      {gameWinner ? (gameWinner.id === currentUserId ? "W" : "L") : "D"}
                    </Badge>
                  ) : isPlayable ? (
                    <Button
                      size="sm"
                      className="h-5 px-1.5 text-[10px] shrink-0"
                      onClick={() => startGameMutation.mutate(game.gameNumber)}
                      disabled={startGameMutation.isPending}
                      data-testid={`button-play-game-${match.id}-${game.gameNumber}`}
                    >
                      {startGameMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <><Play className="h-2.5 w-2.5 mr-0.5" />Play</>
                      )}
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground shrink-0">—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {match.status === "completed" && match.winnerId && (
          <div className="flex items-center justify-center gap-1 pt-1 border-t">
            <Trophy className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              {players[match.winnerId]?.name ?? "Winner"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlayerRow({
  player,
  isWinner,
  wins,
  isPending,
}: {
  player: PlayerInfo | null;
  isWinner: boolean;
  wins: number;
  isPending: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 rounded px-1 py-0.5 ${isWinner ? "bg-primary/10" : ""}`}>
      <UserAvatar
        name={player?.name ?? "?"}
        avatarUrl={player?.avatarUrl}
        className="h-5 w-5 text-[8px] shrink-0"
      />
      <span className={`text-xs truncate flex-1 ${isWinner ? "font-bold" : ""}`}>
        {player?.name ?? "TBD"}
      </span>
      {isPending && wins > 0 && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">{wins}</Badge>
      )}
      {isWinner && <Trophy className="h-3 w-3 text-amber-500 shrink-0" />}
    </div>
  );
}

function MyMatchesSection({
  matches,
  players,
  user,
  tournamentId,
  navigate,
  toast,
  highlightMatchId,
}: {
  matches: MatchWithGames[];
  players: Record<number, PlayerInfo>;
  user: { id: number };
  tournamentId: number;
  navigate: (path: string) => void;
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void;
  highlightMatchId?: number;
}) {
  const myMatches = matches.filter(
    m => m.player1Id === user.id || m.player2Id === user.id
  );

  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(() =>
    highlightMatchId ? new Set([highlightMatchId]) : new Set()
  );
  const [pendingGame, setPendingGame] = useState<{ matchId: number; gameNumber: number } | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightMatchId) return;
    setExpandedMatches(prev => {
      if (prev.has(highlightMatchId)) return prev;
      const next = new Set(prev);
      next.add(highlightMatchId);
      return next;
    });
  }, [highlightMatchId]);

  useEffect(() => {
    if (highlightMatchId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightMatchId, matches.length]);

  if (myMatches.length === 0) return null;

  const toggleExpanded = (matchId: number) => {
    setExpandedMatches(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  const startGame = async (matchId: number, gameNumber: number) => {
    setPendingGame({ matchId, gameNumber });
    try {
      const res = await apiRequest("POST", `/api/word-wars/matches/${matchId}/games/${gameNumber}/start`);
      const { roomCode } = await res.json() as { roomCode: string };
      queryClient.invalidateQueries({ queryKey: ["/api/word-wars", tournamentId] });
      navigate(`/duel/${roomCode}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPendingGame(null);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5" data-testid="my-matches-section">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          My Matches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {myMatches.map(match => {
          const opponentId = match.player1Id === user.id ? match.player2Id : match.player1Id;
          const opponent = opponentId ? players[opponentId] : null;

          const myWins = match.games.filter(
            g => g.status === "completed" && g.winnerId === user.id
          ).length;
          const opponentWins = match.games.filter(
            g => g.status === "completed" && g.winnerId !== null && g.winnerId !== user.id
          ).length;

          const iCompleted = match.status === "completed" || match.status === "forfeited";
          const iWon = iCompleted && match.winnerId === user.id;
          const isBye = match.status === "bye";
          const isExpanded = expandedMatches.has(match.id);

          const sortedGames = [...match.games].sort((a, b) => a.gameNumber - b.gameNumber);

          const nextPlayableGame = sortedGames.find(
            g => g.status !== "completed" && (match.status === "pending" || match.status === "active")
          );

          const matchStatusBadge = (() => {
            if (isBye) return <Badge variant="secondary" className="text-xs">Bye</Badge>;
            if (match.status === "completed") {
              return iWon
                ? <Badge className="text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">Won</Badge>
                : <Badge className="text-xs bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">Lost</Badge>;
            }
            if (match.status === "forfeited") {
              return iWon
                ? <Badge className="text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">Won</Badge>
                : <Badge className="text-xs bg-muted text-muted-foreground border">Forfeited</Badge>;
            }
            if (match.status === "active") return <Badge className="text-xs bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">Active</Badge>;
            return <Badge variant="secondary" className="text-xs">Pending</Badge>;
          })();

          const isHighlighted = highlightMatchId === match.id;

          return (
            <div
              key={match.id}
              ref={isHighlighted ? highlightRef : undefined}
              className={`rounded-lg border bg-background transition-colors ${isHighlighted ? "border-primary ring-2 ring-primary/30 bg-primary/5" : !iCompleted && !isBye ? "border-primary/20" : ""}`}
              data-testid={`my-match-row-${match.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {opponent ? (
                    <UserAvatar
                      name={opponent.name}
                      avatarUrl={opponent.avatarUrl}
                      className="h-8 w-8 shrink-0"
                      data-testid={`avatar-opponent-${match.id}`}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-opponent-name-${match.id}`}>
                      {opponent ? `vs. ${opponent.name}` : isBye ? "Bye Round" : "vs. TBD"}
                    </p>
                    <p className="text-xs text-muted-foreground">Round {match.round}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {!isBye && (
                    <div
                      className="flex items-center gap-1.5 text-sm font-bold tabular-nums"
                      data-testid={`series-score-${match.id}`}
                    >
                      <span className={myWins >= opponentWins ? "text-primary" : "text-muted-foreground"}>{myWins}</span>
                      <span className="text-muted-foreground font-normal">–</span>
                      <span className={opponentWins > myWins ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground"}>{opponentWins}</span>
                    </div>
                  )}

                  {matchStatusBadge}

                  {nextPlayableGame && !iCompleted && (
                    <Button
                      size="sm"
                      className="h-7 gap-1"
                      onClick={() => startGame(match.id, nextPlayableGame.gameNumber)}
                      disabled={pendingGame?.matchId === match.id}
                      data-testid={`button-play-match-${match.id}`}
                    >
                      {pendingGame?.matchId === match.id && pendingGame?.gameNumber === nextPlayableGame.gameNumber
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Play className="h-3 w-3" />
                      }
                      Play
                    </Button>
                  )}

                  {iCompleted && (
                    <div className="flex items-center gap-1">
                      {iWon
                        ? <Trophy className="h-4 w-4 text-amber-500" />
                        : <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  )}

                  {!isBye && sortedGames.length > 0 && (
                    <button
                      className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors text-muted-foreground"
                      onClick={() => toggleExpanded(match.id)}
                      aria-label={isExpanded ? "Collapse games" : "Expand games"}
                      data-testid={`button-toggle-games-${match.id}`}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </button>
                  )}
                </div>
              </div>

              {!isBye && isExpanded && sortedGames.length > 0 && (
                <div className="border-t px-4 py-3 space-y-2" data-testid={`game-breakdown-${match.id}`}>
                  {sortedGames.map(game => {
                    const isCompleted = game.status === "completed";
                    const iMWon = isCompleted && game.winnerId === user.id;
                    const iMLost = isCompleted && game.winnerId !== null && game.winnerId !== user.id;
                    const isNext = nextPlayableGame?.gameNumber === game.gameNumber && !iCompleted;
                    const isPlayable = isNext && !iCompleted;

                    return (
                      <div
                        key={game.gameNumber}
                        className={`flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors ${isNext ? "bg-primary/5 border border-primary/20" : "border border-transparent"}`}
                        data-testid={`game-row-${match.id}-${game.gameNumber}`}
                      >
                        <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 text-center">
                          G{game.gameNumber}
                        </span>

                        <span className="text-xs flex-1 truncate font-medium" data-testid={`game-slug-${match.id}-${game.gameNumber}`}>
                          {slugToLabel(game.gameSlug)}
                        </span>

                        {isCompleted ? (
                          <div className="flex items-center gap-1.5 shrink-0" data-testid={`game-status-${match.id}-${game.gameNumber}`}>
                            {iMWon ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Win</span>
                              </>
                            ) : iMLost ? (
                              <>
                                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Loss</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Done</span>
                              </>
                            )}
                          </div>
                        ) : isPlayable ? (
                          <Button
                            size="sm"
                            className="h-6 px-2 text-xs gap-1 shrink-0"
                            onClick={() => startGame(match.id, game.gameNumber)}
                            disabled={pendingGame?.matchId === match.id}
                            data-testid={`button-play-game-${match.id}-${game.gameNumber}`}
                          >
                            {pendingGame?.matchId === match.id && pendingGame?.gameNumber === game.gameNumber
                              ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              : <Play className="h-2.5 w-2.5" />
                            }
                            Play
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0" data-testid={`game-status-${match.id}-${game.gameNumber}`}>
                            <Circle className="h-3 w-3 text-muted-foreground/40" />
                            <span className="text-xs text-muted-foreground">Pending</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RegistrationCountdownCard({
  registrationDeadline,
  registrationCount,
  onDeadlinePassed,
}: {
  registrationDeadline: string;
  registrationCount: number;
  onDeadlinePassed: () => void;
}) {
  const remaining = useCountdown(registrationDeadline);
  const deadlinePassed = remaining <= 0;

  useEffect(() => {
    if (deadlinePassed) {
      onDeadlinePassed();
    }
  }, [deadlinePassed]);

  return (
    <Card className={`border-dashed transition-colors ${deadlinePassed ? "border-primary/40 bg-primary/5" : ""}`} data-testid="registration-countdown-card">
      <CardContent className="py-10 text-center">
        <Swords className={`h-10 w-10 mx-auto mb-3 ${deadlinePassed ? "text-primary opacity-60" : "text-muted-foreground opacity-30"}`} />

        {deadlinePassed ? (
          <div className="space-y-2">
            <p className="font-semibold text-primary" data-testid="text-drawing-bracket">Drawing bracket…</p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Page will update automatically</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-medium text-muted-foreground">Bracket draws when registration closes</p>
            <div
              className="inline-flex items-center gap-2 rounded-lg bg-muted px-5 py-3"
              data-testid="countdown-display"
            >
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <span className="text-2xl font-bold tabular-nums tracking-tight" data-testid="text-countdown">
                {formatCountdown(remaining)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {registrationCount} {registrationCount === 1 ? "warrior" : "warriors"} registered so far
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WordWarsBracket() {
  const [, params] = useRoute("/word-wars/:id");
  const [, matchParams] = useRoute("/word-wars/:id/match/:matchId");
  const tournamentId = parseInt(matchParams?.id ?? params?.id ?? "0");
  const highlightMatchId = matchParams?.matchId ? parseInt(matchParams.matchId) : undefined;
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<TournamentDetail>({
    queryKey: ["/api/word-wars", tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/word-wars/${tournamentId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: tournamentId > 0,
    refetchInterval: (query) => {
      const d = query.state.data as TournamentDetail | undefined;
      if (!d) return 15000;
      if (d.tournament.status === "registration") {
        const msLeft = new Date(d.tournament.registrationDeadline).getTime() - Date.now();
        if (msLeft <= 0) return 3000;
      }
      return 15000;
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="flex gap-6 overflow-x-auto pb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-4 shrink-0">
              {[1, 2].map(j => <Skeleton key={j} className="h-44 w-52 rounded-lg" />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Swords className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <h1 className="text-2xl font-bold">Tournament not found</h1>
        <Link href="/word-wars">
          <Button className="mt-4" variant="outline">Back to Word Wars</Button>
        </Link>
      </div>
    );
  }

  const { tournament, registrations, matches, players } = data;

  const maxRound = matches.length > 0 ? Math.max(...matches.map(m => m.round)) : 0;
  const rounds: MatchWithGames[][] = [];
  for (let r = 1; r <= maxRound; r++) {
    rounds.push(matches.filter(m => m.round === r).sort((a, b) => a.id - b.id));
  }

  const statusLabel = {
    registration: "Registration Open",
    active: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  }[tournament.status];

  const statusColor = {
    registration: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    active: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    completed: "bg-primary/15 text-primary border-primary/30",
    cancelled: "",
  }[tournament.status];

  const isRegistered = user ? registrations.some(r => r.userId === user.id) : false;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-start gap-3 flex-wrap">
          <Link href="/word-wars">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="link-back-word-wars">
              <ArrowLeft className="h-4 w-4" /> Word Wars
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className={statusColor} data-testid="badge-tournament-status">{statusLabel}</Badge>
                  {isRegistered && (
                    <Badge variant="secondary" data-testid="badge-registered">Registered</Badge>
                  )}
                </div>
                <h1 className="text-2xl font-bold" data-testid="text-bracket-tournament-name">{tournament.name}</h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {registrations.length} {registrations.length === 1 ? "warrior" : "warriors"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {tournament.roundDeadlineHours}h per round
                  </span>
                </div>
              </div>
              {tournament.status === "completed" && (() => {
                const finalRound = rounds[rounds.length - 1];
                const finalMatch = finalRound?.[0];
                const champion = finalMatch?.winnerId ? players[finalMatch.winnerId] : null;
                if (!champion) return null;
                return (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2" data-testid="champion-banner">
                    <Crown className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Champion</p>
                      <p className="font-bold text-amber-600 dark:text-amber-400" data-testid="text-champion-name">{champion.name}</p>
                    </div>
                    <UserAvatar name={champion.name} avatarUrl={champion.avatarUrl} className="h-8 w-8" />
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {tournament.status === "registration" && matches.length === 0 && (
          <RegistrationCountdownCard
            registrationDeadline={tournament.registrationDeadline}
            registrationCount={registrations.length}
            onDeadlinePassed={() => refetch()}
          />
        )}

        {user && <MyMatchesSection matches={matches} players={players} user={user} tournamentId={tournamentId} navigate={navigate} toast={toast} highlightMatchId={highlightMatchId} />}

        {rounds.length > 0 && (
          <div>
            <div className="overflow-x-auto pb-6">
              <div className="flex gap-8 min-w-max" data-testid="bracket-view">
                {rounds.map((roundMatches, ri) => (
                  <div key={ri} className="flex flex-col" data-testid={`bracket-round-${ri + 1}`}>
                    <h3 className="text-sm font-semibold text-center mb-3 text-muted-foreground uppercase tracking-wide">
                      {ri === rounds.length - 1 ? "Final" : ri === rounds.length - 2 ? "Semi-Final" : `Round ${ri + 1}`}
                    </h3>
                    <div
                      className="flex flex-col gap-4 justify-around"
                      style={{ minHeight: `${roundMatches.length * 44 * Math.pow(2, ri)}px` }}
                    >
                      {roundMatches.map(match => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          players={players}
                          currentUserId={user?.id}
                          tournamentId={tournamentId}
                          isHighlighted={highlightMatchId === match.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}
