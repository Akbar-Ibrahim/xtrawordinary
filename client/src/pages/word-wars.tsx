import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCountdown, formatCountdown } from "@/lib/use-countdown";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import { AuthModal } from "@/components/auth-modal";
import { Trophy, Swords, Users, Clock, Crown, Calendar, ChevronRight, Loader2, Star, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import type { WordWarsTournament } from "@shared/schema";

type ChampionEntry = {
  id: number;
  tournamentId: number;
  userId: number;
  createdAt: string;
  user: { id: number; name: string; avatarUrl: string | null } | null;
  tournament: { id: number; name: string } | null;
};


function statusBadge(t: WordWarsTournament) {
  if (t.status === "registration") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" data-testid="badge-status-registration">
        Registration Open
      </Badge>
    );
  }
  if (t.status === "active") {
    return (
      <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" data-testid="badge-status-active">
        In Progress
      </Badge>
    );
  }
  if (t.status === "completed") {
    return (
      <Badge className="bg-primary/15 text-primary border-primary/30" data-testid="badge-status-completed">
        Completed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" data-testid="badge-status-cancelled">Cancelled</Badge>
  );
}

function TournamentCard({ tournament, userId, isAuthenticated }: {
  tournament: WordWarsTournament;
  userId: number | undefined;
  isAuthenticated: boolean;
}) {
  const { toast } = useToast();
  const countdown = useCountdown(tournament.registrationDeadline, tournament.status === "registration");

  const { data: detail } = useQuery<{
    tournament: WordWarsTournament;
    registrations: Array<{ id: number; tournamentId: number; userId: number; createdAt: string }>;
  }>({
    queryKey: ["/api/word-wars", tournament.id],
    queryFn: async () => {
      const res = await fetch(`/api/word-wars/${tournament.id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const isRegistered = detail?.registrations.some(r => r.userId === userId) ?? false;
  const playerCount = detail?.registrations.length ?? 0;

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/word-wars/${tournament.id}/register`);
      return res.json() as Promise<{ registered: boolean }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/word-wars", tournament.id] });
      toast({ title: data.registered ? "Registered for the war!" : "Registration withdrawn" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canRegister = tournament.status === "registration" && new Date(tournament.registrationDeadline) > new Date();

  const WARN_THRESHOLD_MS = 24 * 60 * 60 * 1000;
  const needsMorePlayers = tournament.status === "registration" && playerCount < tournament.minPlayers;
  const closingSoon = countdown > 0 && countdown <= WARN_THRESHOLD_MS;
  const showLowRegistrationWarning = needsMorePlayers && closingSoon;
  const playersNeeded = tournament.minPlayers - playerCount;

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-tournament-${tournament.id}`}>
      <CardContent className="pt-5 pb-4">
        {showLowRegistrationWarning && (
          <div
            className="flex items-center gap-2 mb-3 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
            data-testid={`banner-low-registration-${tournament.id}`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Needs {playersNeeded} more {playersNeeded === 1 ? "player" : "players"} to run</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {statusBadge(tournament)}
              {tournament.maxPlayers && (
                <Badge variant="outline" className="text-xs" data-testid={`badge-max-players-${tournament.id}`}>
                  Max {tournament.maxPlayers}
                </Badge>
              )}
            </div>
            <h3 className="font-bold text-lg truncate" data-testid={`text-tournament-name-${tournament.id}`}>
              {tournament.name}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1" data-testid={`text-player-count-${tournament.id}`}>
                <Users className="h-3.5 w-3.5" />
                {tournament.status === "registration"
                  ? `${playerCount} / ${tournament.minPlayers} needed`
                  : `${playerCount} ${playerCount === 1 ? "warrior" : "warriors"}`}
              </span>
              {tournament.status === "registration" && (
                <span className="flex items-center gap-1" data-testid={`text-deadline-${tournament.id}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {formatCountdown(countdown)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {tournament.roundDeadlineHours}h per round
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated && canRegister && (
              <Button
                size="sm"
                variant={isRegistered ? "outline" : "default"}
                onClick={() => registerMutation.mutate()}
                disabled={registerMutation.isPending}
                data-testid={`button-register-${tournament.id}`}
              >
                {registerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRegistered ? (
                  "Withdraw"
                ) : (
                  "Enter the War"
                )}
              </Button>
            )}
            <Link href={`/word-wars/${tournament.id}`}>
              <Button size="sm" variant="ghost" data-testid={`link-bracket-${tournament.id}`}>
                View Bracket <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WordWarsLobby() {
  const { user, isAuthenticated } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const { data: tournaments = [], isLoading } = useQuery<WordWarsTournament[]>({
    queryKey: ["/api/word-wars"],
  });

  const { data: champions = [], isLoading: championsLoading } = useQuery<ChampionEntry[]>({
    queryKey: ["/api/word-wars/champions"],
  });

  const active = tournaments.filter(t => t.status === "registration" || t.status === "active");
  const past = tournaments.filter(t => t.status === "completed" || t.status === "cancelled");

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-word-wars-title">
              <Swords className="h-8 w-8 text-primary" />
              Word Wars
            </h1>
            <p className="text-muted-foreground mt-1">Solo bracket tournaments. Last word warrior standing wins.</p>
          </div>
          {!isAuthenticated && (
            <Button onClick={() => setAuthOpen(true)} data-testid="button-signin-word-wars">
              Sign in to compete
            </Button>
          )}
        </div>

        {/* ── Two-column layout ── */}
        <div className="flex flex-col md:flex-row gap-6 items-start">

          {/* Left column: Active & Upcoming + Past Tournaments */}
          <div className="flex-1 min-w-0 space-y-8">

            {!isAuthenticated && (
              <Card className="border-dashed">
                <CardContent className="py-6 text-center text-muted-foreground">
                  <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Sign in to register for tournaments and track your progress.</p>
                  <Button className="mt-4" onClick={() => setAuthOpen(true)} data-testid="button-signin-prompt">
                    Sign In
                  </Button>
                </CardContent>
              </Card>
            )}

            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Active & Upcoming
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
                </div>
              ) : active.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No active tournaments right now. Check back soon.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3" data-testid="list-active-tournaments">
                  {active.map(t => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      userId={user?.id}
                      isAuthenticated={isAuthenticated}
                    />
                  ))}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  Past Tournaments
                </h2>
                <div className="space-y-3" data-testid="list-past-tournaments">
                  {past.map(t => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      userId={user?.id}
                      isAuthenticated={isAuthenticated}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right column: Hall of Fame (sticky on desktop, stacked below on mobile) */}
          <aside className="w-full md:w-72 shrink-0 md:sticky md:top-4">
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Hall of Fame
              </h2>
              {championsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : champions.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Crown className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No champions yet. The glory awaits.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2" data-testid="list-champions">
                  {champions.map((c, idx) => (
                    <Card key={c.id} className="hover:shadow-sm transition-shadow" data-testid={`card-champion-${c.id}`}>
                      <CardContent className="py-2.5 px-3 flex items-center gap-2.5">
                        <span className="text-base font-bold text-muted-foreground w-6 text-center shrink-0">
                          {idx + 1}
                        </span>
                        <UserAvatar
                          name={c.user?.name ?? "Unknown"}
                          avatarUrl={c.user?.avatarUrl}
                          className="h-8 w-8 text-xs shrink-0"
                          data-testid={`avatar-champion-${c.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <Link href={c.user ? `/profile/${c.user.id}` : "#"}>
                            <span className="font-semibold text-sm hover:underline cursor-pointer truncate block" data-testid={`link-champion-name-${c.id}`}>
                              {c.user?.name ?? "Unknown"}
                            </span>
                          </Link>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.tournament?.name ?? "Tournament"}
                          </p>
                        </div>
                        <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" data-testid={`badge-champion-${c.id}`} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </motion.div>

      <AuthModal open={authOpen} onOpenChange={(v) => setAuthOpen(v)} />
    </div>
  );
}
