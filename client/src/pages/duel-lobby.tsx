import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Swords, Loader2, RefreshCw, Users, Clock, Zap, Trophy, UserPlus, BarChart3, Star, TrendingUp, TrendingDown, Minus, History, X, Bell, ChevronDown, ChevronUp, Eye } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import { AuthModal } from "@/components/auth-modal";
import { PremiumBanner } from "@/components/premium-banner";
import { useDuelNotifications } from "@/lib/duel-notifications-context";
import type { UnseenChallenge } from "@/lib/duel-notifications-context";
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

interface DuelHistoryEntry {
  id: number;
  roomCode: string;
  opponentId: number;
  opponentName: string;
  opponentAvatarUrl: string | null;
  gameSlug: string;
  outcome: "win" | "loss" | "draw" | null;
  isForfeit: boolean;
  eloDelta: number | null;
  startedAt: string;
  endedAt: string | null;
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

const SIGNUP_PERKS = [
  { icon: Swords, label: "Post open challenges", desc: "Put yourself out there — anyone can accept and you're in a duel." },
  { icon: Trophy, label: "Track your ELO rating", desc: "Earn, lose, and climb the duel rankings over time." },
  { icon: BarChart3, label: "Full duel history", desc: "Review every match you've played, wins and losses alike." },
  { icon: UserPlus, label: "Challenge friends", desc: "Send direct duel invites to people on your friends list." },
];

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

function DuelGameCard({ game, waitingCount = 0 }: { game: Game; waitingCount?: number }) {
  return (
    <Card className="h-full" data-testid={`card-duel-game-${game.slug}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <GameIcon game={game} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="font-semibold text-sm truncate">{game.name}</p>
            <FormatBadge slug={game.slug} />
            {waitingCount > 0 && (
              <Badge
                className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0 shrink-0"
                data-testid={`badge-waiting-${game.slug}`}
              >
                {waitingCount} waiting
              </Badge>
            )}
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

function DuelNotificationsPanel({
  challenges,
  onDismiss,
  onDismissAll,
}: {
  challenges: UnseenChallenge[];
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
}) {
  const [, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (challenges.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 overflow-hidden"
      data-testid="panel-duel-notifications"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 bg-green-100/60 dark:bg-green-900/30">
        <Bell className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
        <p className="text-sm font-semibold text-green-800 dark:text-green-200 flex-1">
          My Duel Notifications
          <Badge className="ml-2 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 border-0 text-xs px-1.5 py-0">
            {challenges.length}
          </Badge>
        </p>
        <button
          onClick={onDismissAll}
          className="text-xs text-green-700 dark:text-green-300 hover:underline shrink-0"
          data-testid="button-dismiss-all-notifications"
        >
          Dismiss all
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
          data-testid="button-toggle-notifications"
          aria-label={collapsed ? "Expand notifications" : "Collapse notifications"}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="divide-y divide-green-200 dark:divide-green-800">
          {challenges.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-4 py-3"
              data-testid={`row-duel-notification-${c.id}`}
            >
              <UserAvatar
                name={c.challengeeName ?? "?"}
                avatarUrl={c.challengeeAvatarUrl ?? null}
                className="h-8 w-8 shrink-0 text-xs"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-900 dark:text-green-100 truncate">
                  {c.challengeeName ?? "Your opponent"} accepted your challenge!
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {ALL_GAME_LABELS[c.gameSlug] ?? c.gameSlug} · Room ready
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-2.5"
                  onClick={() => {
                    onDismiss(c.id);
                    navigate(`/duel/${c.roomCode}`);
                  }}
                  data-testid={`button-join-room-notification-${c.id}`}
                >
                  <Swords className="h-3.5 w-3.5" />
                  Join Room
                </Button>
                <button
                  onClick={() => onDismiss(c.id)}
                  className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-100"
                  data-testid={`button-dismiss-notification-${c.id}`}
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface LiveRoom {
  roomCode: string;
  gameSlug: string;
  format: "turn" | "race";
  player1Name: string;
  player2Name: string;
  spectatorCount: number;
}

function LiveNowSection() {
  const [, navigate] = useLocation();
  const { data: liveRooms = [], isLoading } = useQuery<LiveRoom[]>({
    queryKey: ["/api/duels/live"],
    queryFn: async () => {
      const res = await fetch("/api/duels/live", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });

  if (isLoading || liveRooms.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <h2 className="text-base font-semibold">Live Now</h2>
        <Badge variant="secondary" className="text-xs">{liveRooms.length}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {liveRooms.map((room) => {
          const gameName = room.gameSlug
            .split("-")
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          return (
            <button
              key={room.roomCode}
              onClick={() => navigate(`/duel/${room.roomCode}`)}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left w-full group"
              data-testid={`card-live-room-${room.roomCode}`}
            >
              <div className="shrink-0 w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                {room.format === "race" ? (
                  <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                ) : (
                  <Swords className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{gameName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {room.player1Name} vs {room.player2Name}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant="outline" className="text-xs gap-1 text-violet-600 border-violet-300 dark:border-violet-700 group-hover:bg-violet-50 dark:group-hover:bg-violet-950/30">
                  <Eye className="h-3 w-3" />
                  Watch
                </Badge>
                {room.spectatorCount > 0 && (
                  <span className="text-xs text-muted-foreground">{room.spectatorCount} watching</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function DuelLobby() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"signin" | "signup">("signup");
  const [lobbyTab, setLobbyTab] = useState<"challenges" | "my-duels">("challenges");
  const { unseenChallenges, dismiss: dismissNotification, dismissAll: dismissAllNotifications } = useDuelNotifications();

  const { data: allGames = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const duelGames = allGames.filter((g) => DUEL_GAME_SLUGS.has(g.slug));
  const turnGames = duelGames.filter((g) => DUEL_TURN_SLUGS.has(g.slug));
  const raceGames = duelGames.filter((g) => DUEL_RACE_SLUGS.has(g.slug));

  const { data: allOpenChallenges = [] } = useQuery<OpenChallenge[]>({
    queryKey: ["/api/duels/open"],
    queryFn: async () => {
      const res = await fetch("/api/duels/open", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  const waitingCountByGame = allOpenChallenges.reduce<Record<string, number>>((acc, c) => {
    acc[c.gameSlug] = (acc[c.gameSlug] ?? 0) + 1;
    return acc;
  }, {});

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

  const { data: duelHistory = [], isLoading: historyLoading } = useQuery<DuelHistoryEntry[]>({
    queryKey: ["/api/duels/sessions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/duels/sessions/${user.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!user?.id,
  });

  const myOpenChallenges = allOpenChallenges.filter((c) => c.challengerId === user?.id);

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

  const cancelMutation = useMutation<
    unknown,
    Error,
    number,
    { prevAll: OpenChallenge[] | undefined; prevFiltered: OpenChallenge[] | undefined; filterKey: string }
  >({
    mutationFn: async (challengeId: number) => {
      const res = await apiRequest("PATCH", `/api/duels/challenges/${challengeId}/cancel`, {});
      return res.json();
    },
    onMutate: async (challengeId: number) => {
      const filterKey = gameFilter;
      await queryClient.cancelQueries({ queryKey: ["/api/duels/open"] });
      const prevAll = queryClient.getQueryData<OpenChallenge[]>(["/api/duels/open"]);
      const prevFiltered = queryClient.getQueryData<OpenChallenge[]>(["/api/duels/open", filterKey]);
      queryClient.setQueryData<OpenChallenge[]>(["/api/duels/open"], (old) =>
        old ? old.filter((c) => c.id !== challengeId) : []
      );
      queryClient.setQueryData<OpenChallenge[]>(["/api/duels/open", filterKey], (old) =>
        old ? old.filter((c) => c.id !== challengeId) : []
      );
      return { prevAll, prevFiltered, filterKey };
    },
    onSuccess: () => {
      toast({ title: "Challenge cancelled", description: "Your open challenge has been removed from the lobby." });
    },
    onError: (err, _challengeId, ctx) => {
      if (ctx?.prevAll) queryClient.setQueryData(["/api/duels/open"], ctx.prevAll);
      if (ctx?.prevFiltered) queryClient.setQueryData(["/api/duels/open", ctx.filterKey], ctx.prevFiltered);
      toast({ title: "Could not cancel", description: err.message ?? "Try again.", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/duels/open"] });
    },
  });

  function openAuth(tab: "signin" | "signup") {
    setAuthInitialTab(tab);
    setAuthOpen(true);
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-10">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Swords className="h-7 w-7 text-violet-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Duels</h1>
            <Link href="/duels/leaderboard">
              <Button variant="outline" size="sm" className="gap-1.5 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40" data-testid="button-duel-rankings">
                <Trophy className="h-3.5 w-3.5" />
                Rankings
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">Challenge a friend or join an open duel — turn-based or simultaneous race.</p>
        </div>
      </div>

      {/* ── Duel Notifications Panel ── */}
      {isAuthenticated && (
        <DuelNotificationsPanel
          challenges={unseenChallenges}
          onDismiss={dismissNotification}
          onDismissAll={dismissAllNotifications}
        />
      )}

      {/* ── Live Now ── */}
      {isAuthenticated && <LiveNowSection />}

      {/* ── Game Directory ── */}
      <section>
        <h2 className="text-base font-semibold mb-3">Pick a Game</h2>

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
              {turnGames.map((g) => <DuelGameCard key={g.slug} game={g} waitingCount={waitingCountByGame[g.slug] ?? 0} />)}
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
              {raceGames.map((g) => <DuelGameCard key={g.slug} game={g} waitingCount={waitingCountByGame[g.slug] ?? 0} />)}
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* ── Open Challenges / My Duels ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1" data-testid="toggle-lobby-tab">
              <button
                onClick={() => setLobbyTab("challenges")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${lobbyTab === "challenges" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="tab-open-challenges"
              >
                <Users className="h-3.5 w-3.5" />
                Open Challenges
                {openChallenges.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-xs h-4 px-1">{openChallenges.length}</Badge>
                )}
              </button>
              <button
                onClick={() => setLobbyTab("my-duels")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${lobbyTab === "my-duels" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="tab-my-duels"
              >
                <History className="h-3.5 w-3.5" />
                My Duels
                {duelHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-xs h-4 px-1">{duelHistory.length}</Badge>
                )}
              </button>
            </div>
          ) : (
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Open Challenges
            </h2>
          )}
          {isAuthenticated && lobbyTab === "challenges" && (
            <Button variant="ghost" size="icon" onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["/api/duels/open"] }); }} disabled={isFetching} data-testid="button-refresh-lobby">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>

        {!isAuthenticated ? (
          <div className="space-y-4">
            {/* Sign-up CTA */}
            <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20" data-testid="card-guest-signup-cta">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center shrink-0">
                    <Swords className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-violet-900 dark:text-violet-100">Join the arena</p>
                    <p className="text-xs text-violet-700 dark:text-violet-300">Create a free account to unlock the full duel experience.</p>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-5">
                  {SIGNUP_PERKS.map(({ icon: Icon, label, desc }) => (
                    <li key={label} className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-violet-900 dark:text-violet-100">{label}</span>
                        <span className="text-xs text-violet-700/80 dark:text-violet-300/80 ml-1.5">{desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white gap-2"
                    onClick={() => openAuth("signup")}
                    data-testid="button-guest-create-account"
                  >
                    <Star className="h-4 w-4" />
                    Create Free Account
                  </Button>
                  <Button
                    variant="outline"
                    className="border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                    onClick={() => openAuth("signin")}
                    data-testid="button-guest-signin"
                  >
                    Sign In
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Premium teaser for guests */}
            <PremiumBanner variant="card" />
          </div>
        ) : lobbyTab === "challenges" ? (
          <>
            {/* Premium teaser for free signed-in users */}
            {!user?.isPremium && (
              <div className="mb-4">
                <PremiumBanner variant="card" />
              </div>
            )}

            {/* ── My Open Challenges sub-section ── */}
            {myOpenChallenges.length > 0 && (
              <div className="mb-5" data-testid="section-my-open-challenges">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Your Posted Challenges</p>
                <div className="space-y-2">
                  {myOpenChallenges.map((c) => {
                    const isCancelling = cancelMutation.isPending && cancelMutation.variables === c.id;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/40 dark:bg-violet-950/10"
                        data-testid={`row-my-challenge-${c.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {ALL_GAME_LABELS[c.gameSlug] ?? c.gameSlug}
                            </Badge>
                            {c.message && (
                              <span className="text-xs text-muted-foreground truncate">"{c.message}"</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Posted {timeAgo(c.createdAt)} · waiting for an opponent
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          disabled={isCancelling}
                          onClick={() => cancelMutation.mutate(c.id)}
                          data-testid={`button-cancel-challenge-${c.id}`}
                        >
                          {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                          Cancel
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Separator className="mt-4" />
              </div>
            )}

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
            ) : openChallenges.filter((c) => c.challengerId !== user?.id).length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-sm">No open challenges right now.</p>
                  <p className="text-xs mt-1">Go to a game above and post an open challenge to start one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {openChallenges.filter((c) => c.challengerId !== user?.id).map((c) => {
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
        ) : (
          /* ── My Duels tab ── */
          <>
            {historyLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : duelHistory.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Swords className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-sm">No duel history yet.</p>
                  <p className="text-xs mt-1">Play a duel from the game list above to see your matches here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {duelHistory.slice(0, 50).map((duel) => {
                  const isWin = duel.outcome === "win";
                  const isLoss = duel.outcome === "loss";
                  const isDraw = duel.outcome === "draw";
                  const outcomeLabel = isWin ? "Win" : isLoss ? "Loss" : isDraw ? "Draw" : "—";
                  const eloDeltaPos = duel.eloDelta !== null && duel.eloDelta > 0;
                  const eloDeltaNeg = duel.eloDelta !== null && duel.eloDelta < 0;
                  const date = duel.endedAt ? new Date(duel.endedAt) : new Date(duel.startedAt);
                  const isForfeit = duel.isForfeit;
                  const badgeClass = isWin
                    ? "bg-green-500 hover:bg-green-500 text-white border-0"
                    : isForfeit
                    ? "bg-orange-500 hover:bg-orange-500 text-white border-0"
                    : "";
                  const badgeVariant: "default" | "destructive" | "secondary" = isWin || isForfeit ? "default" : isLoss ? "destructive" : "secondary";
                  const label = isWin ? (isForfeit ? "Forfeit" : "Win") : isLoss ? (isForfeit ? "Forfeit" : "Loss") : isDraw ? "Draw" : "—";
                  return (
                    <div
                      key={duel.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      data-testid={`row-duel-history-${duel.id}`}
                    >
                      <Badge
                        variant={badgeVariant}
                        className={`w-16 justify-center shrink-0 text-xs ${badgeClass}`}
                        data-testid={`badge-duel-outcome-${duel.id}`}
                      >
                        {label}
                      </Badge>
                      <UserAvatar name={duel.opponentName} avatarUrl={duel.opponentAvatarUrl} className="h-8 w-8 shrink-0 text-xs" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          vs{" "}
                          <Link href={`/profile/${duel.opponentId}`}>
                            <span className="hover:underline cursor-pointer">{duel.opponentName}</span>
                          </Link>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ALL_GAME_LABELS[duel.gameSlug] ?? duel.gameSlug} · {timeAgo(date.toISOString())}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" data-testid={`text-elo-delta-${duel.id}`}>
                        {duel.eloDelta !== null ? (
                          <>
                            {eloDeltaPos && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
                            {eloDeltaNeg && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                            {!eloDeltaPos && !eloDeltaNeg && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className={`text-sm font-semibold ${eloDeltaPos ? "text-green-500" : eloDeltaNeg ? "text-red-500" : "text-muted-foreground"}`}>
                              {eloDeltaPos ? "+" : ""}{duel.eloDelta}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} initialTab={authInitialTab} />
    </div>
  );
}
