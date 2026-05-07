import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import { Pencil, Trophy, Award, Gamepad2, Calendar, Target, UserPlus, UserCheck, User, GraduationCap, Copy, CheckCheck, Users, Trash2, Crown, Play, Swords, TrendingUp, TrendingDown, Minus, Bell, Globe, Lock, ChevronRight, Heart, Sword } from "lucide-react";
import { motion } from "framer-motion";
import type { UserGameStats, UserAchievement, Game, QuizSession } from "@shared/schema";

type QuizSessionWithCount = QuizSession & { playerCount: number };

interface PublicProfile {
  user: { id: number; name: string; avatarUrl: string | null; createdAt: string; isPremium: boolean };
  stats: UserGameStats[];
  achievements: UserAchievement[];
  leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }>;
}

export default function Profile() {
  const [, params] = useRoute("/profile/:id");
  const userId = parseInt(params?.id || "0");
  const { user: currentUser, isAuthenticated, refreshUser } = useAuth();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: ["/api/users", userId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/profile`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: userId > 0,
  });

  const { data: games = [] } = useQuery<Game[]>({ queryKey: ["/api/games"] });

  const { data: friendship } = useQuery({
    queryKey: ["/api/friends/check", userId],
    queryFn: async () => {
      if (!isAuthenticated || currentUser?.id === userId) return null;
      const res = await fetch("/api/friends", { credentials: "include" });
      const friends = await res.json();
      return friends.find((f: any) => f.friendUser.id === userId) || null;
    },
    enabled: isAuthenticated && currentUser?.id !== userId,
  });

  const sendRequest = useMutation({
    mutationFn: () => apiRequest("POST", "/api/friends/request", { userId }),
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/check", userId] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const downgradePremium = useMutation({
    mutationFn: () => apiRequest("POST", "/api/users/me/downgrade-premium"),
    onSuccess: async () => {
      toast({ title: "Premium removed" });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "profile"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateProfile = useMutation({
    mutationFn: (data: { name?: string; avatarUrl?: string | null }) =>
      apiRequest("PATCH", "/api/users/me", data),
    onSuccess: async () => {
      toast({ title: "Profile updated!" });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "profile"] });
      setEditOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isOwnProfile = currentUser?.id === userId;
  const gameMap = new Map(games.map(g => [g.slug, g]));

  function formatGameName(gameSlug: string): string {
    const game = gameMap.get(gameSlug);
    if (game) return game.name;
    const lockedMatch = gameSlug.match(/^letter-balance-locked-(\d+)l(\d+)c$/);
    if (lockedMatch) {
      const length = parseInt(lockedMatch[1]);
      const consonants = parseInt(lockedMatch[2]);
      const vowels = length - consonants;
      return `Locked Balance (${length}L/${consonants}C/${vowels}V)`;
    }
    if (gameSlug === "letter-balance-locked-advanced") return "Locked Balance (Advanced)";
    if (gameSlug === "letter-balance-survival") return "Letter Balance (Survival)";
    return gameSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  const { data: duelRating } = useQuery<{ userId: number; elo: number; wins: number; losses: number; draws: number; rank: number | null; totalPlayers: number }>({
    queryKey: ["/api/duels/ratings", userId],
    queryFn: async () => {
      const res = await fetch(`/api/duels/ratings/${userId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: userId > 0,
  });

  const hasDuelActivity = duelRating ? (duelRating.wins + duelRating.losses + duelRating.draws > 0) : false;
  const duelRank = duelRating?.rank ?? null;
  const totalDuelPlayers = duelRating?.totalPlayers ?? 0;

  const { data: championships = [] } = useQuery<Array<{ id: number; tournamentId: number; createdAt: string; tournamentName: string }>>({
    queryKey: ["/api/users", userId, "championships"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/championships`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: userId > 0,
  });

  const { data: wordWarsStats } = useQuery<{ tournamentsEntered: number; matchWins: number; matchLosses: number }>({
    queryKey: ["/api/users", userId, "word-wars-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/word-wars-stats`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: userId > 0,
  });

  type DuelHistoryEntry = {
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
  };

  const { data: duelHistory = [], isLoading: duelHistoryLoading } = useQuery<DuelHistoryEntry[]>({
    queryKey: ["/api/duels/sessions", userId],
    queryFn: async () => {
      const res = await fetch(`/api/duels/sessions/${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch duel history");
      return res.json();
    },
    enabled: userId > 0,
  });

  const { data: myQuizzes = [], isLoading: myQuizzesLoading } = useQuery<QuizSessionWithCount[]>({
    queryKey: ["/api/quiz-sessions/my"],
    queryFn: async () => {
      const res = await fetch("/api/quiz-sessions/my", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quizzes");
      return res.json();
    },
    enabled: isOwnProfile && isAuthenticated,
  });

  const { data: otherQuizzes = [], isLoading: otherQuizzesLoading } = useQuery<QuizSessionWithCount[]>({
    queryKey: ["/api/users", userId, "quiz-sessions"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/quiz-sessions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quizzes");
      return res.json();
    },
    enabled: !isOwnProfile && userId > 0,
  });

  const quizzes = isOwnProfile ? myQuizzes : otherQuizzes;
  const quizzesLoading = isOwnProfile ? myQuizzesLoading : otherQuizzesLoading;

  type FriendEntry = { id: number; friendUser: { id: number; name: string; avatarUrl: string | null } };
  const { data: myFriends = [], isLoading: friendsLoading } = useQuery<FriendEntry[]>({
    queryKey: ["/api/friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOwnProfile && isAuthenticated,
  });

  type GroupSummary = { id: number; name: string; memberCount: number; isPublic: boolean };
  const { data: groupsData } = useQuery<{ myGroups: GroupSummary[] }>({
    queryKey: ["/api/groups"],
    enabled: isOwnProfile && isAuthenticated,
  });
  const myGroups = groupsData?.myGroups ?? [];

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteQuizCode, setDeleteQuizCode] = useState<string | null>(null);

  function copyQuizLink(shareCode: string) {
    navigator.clipboard.writeText(`${window.location.origin}/quiz/${shareCode}`);
    setCopiedCode(shareCode);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({ title: "Play link copied!" });
  }

  const deleteQuiz = useMutation({
    mutationFn: (shareCode: string) =>
      apiRequest("DELETE", `/api/quiz-sessions/${shareCode}`),
    onSuccess: () => {
      toast({ title: "Quiz deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-sessions/my"] });
      setDeleteQuizCode(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDeleteQuizCode(null);
    },
  });

  function openEdit() {
    if (!profile) return;
    setEditName(profile.user.name);
    setEditAvatarUrl(profile.user.avatarUrl ?? "");
    setEditOpen(true);
  }

  function handleSave() {
    const data: { name?: string; avatarUrl?: string | null } = {};
    if (editName.trim() && editName.trim() !== profile?.user.name) {
      data.name = editName.trim();
    }
    const url = editAvatarUrl.trim() || null;
    if (url !== (profile?.user.avatarUrl ?? null)) {
      data.avatarUrl = url;
    }
    if (Object.keys(data).length === 0) {
      setEditOpen(false);
      return;
    }
    updateProfile.mutate(data);
  }

  const previewName = editName.trim() || (profile?.user.name ?? "");
  const previewUrl = editAvatarUrl.trim() || null;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl text-center">
        <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold">Profile not found</h1>
      </div>
    );
  }

  const totalGames = profile.stats.reduce((sum, s) => sum + s.gamesPlayed, 0);
  const totalWins = profile.stats.reduce((sum, s) => sum + s.gamesWon, 0);
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <UserAvatar
                name={profile.user.name}
                avatarUrl={profile.user.avatarUrl}
                className="h-16 w-16 text-xl"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold" data-testid="text-profile-name">{profile.user.name}</h1>
                  {profile.user.isPremium && (
                    <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white border-0" data-testid="badge-premium-profile">
                      <Crown className="h-3 w-3" />
                      Premium
                    </Badge>
                  )}
                  {championships.length > 0 && (
                    <Badge className="gap-1 bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 hover:bg-amber-400/25" data-testid="badge-word-wars-champion">
                      <Crown className="h-3 w-3 fill-current" />
                      Word Wars Champion{championships.length > 1 ? ` ×${championships.length}` : ""}
                    </Badge>
                  )}
                  {isOwnProfile && (
                    <button
                      onClick={openEdit}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-edit-profile"
                      aria-label="Edit profile"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isOwnProfile && profile.user.isPremium && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => downgradePremium.mutate()}
                    disabled={downgradePremium.isPending}
                    data-testid="button-downgrade-premium"
                  >
                    Remove Premium (testing)
                  </Button>
                )}
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {new Date(profile.user.createdAt).toLocaleDateString()}
                </p>
              </div>
              {isAuthenticated && !isOwnProfile && (
                friendship ? (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-friend">
                    <UserCheck className="h-3 w-3" /> Friends
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending} data-testid="button-add-friend">
                    <UserPlus className="h-4 w-4 mr-1" /> Add Friend
                  </Button>
                )
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Games Played", value: totalGames, icon: Gamepad2 },
            { label: "Win Rate", value: `${winRate}%`, icon: Target },
            { label: "Achievements", value: profile.achievements.length, icon: Award },
            { label: "Rankings", value: profile.leaderboardRankings.length, icon: Trophy },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-4 text-center">
                <stat.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {duelRating && hasDuelActivity && (
          <Card className="border-violet-300 dark:border-violet-700" data-testid="card-duel-elo">
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Swords className="h-5 w-5 text-violet-500" />
                  <div>
                    <p className="font-semibold text-sm">Duel Rating</p>
                    <p className="text-xs text-muted-foreground">Rated ELO · {duelRating.wins + duelRating.losses + duelRating.draws} matches</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-violet-600 dark:text-violet-400" data-testid="text-duel-elo">{duelRating.elo}</p>
                  <p className="text-xs text-muted-foreground">
                    {duelRating.wins}W · {duelRating.losses}L · {duelRating.draws}D
                    {duelRating.wins + duelRating.losses > 0 && (
                      <> · {Math.round((duelRating.wins / (duelRating.wins + duelRating.losses)) * 100)}% win rate</>
                    )}
                  </p>
                  {duelRank !== null && totalDuelPlayers > 0 && (
                    <Link href="/duels/leaderboard">
                      <span
                        className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                        data-testid="link-duel-rank"
                      >
                        #{duelRank} of {totalDuelPlayers} players
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {wordWarsStats && (wordWarsStats.tournamentsEntered > 0 || championships.length > 0) && (
          <Card className="border-amber-300 dark:border-amber-700" data-testid="card-word-wars-stats">
            <CardContent className="py-4 px-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Sword className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Word Wars</p>
                    <p className="text-xs text-muted-foreground">
                      {wordWarsStats.tournamentsEntered} {wordWarsStats.tournamentsEntered === 1 ? "tournament" : "tournaments"} entered
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-3 justify-end mb-1">
                    <div className="text-center">
                      <p className="text-xl font-black text-amber-600 dark:text-amber-400" data-testid="text-word-wars-match-wins">{wordWarsStats.matchWins}</p>
                      <p className="text-[10px] text-muted-foreground">Wins</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black text-muted-foreground" data-testid="text-word-wars-match-losses">{wordWarsStats.matchLosses}</p>
                      <p className="text-[10px] text-muted-foreground">Losses</p>
                    </div>
                    {wordWarsStats.matchWins + wordWarsStats.matchLosses > 0 && (
                      <div className="text-center">
                        <p className="text-xl font-black text-foreground" data-testid="text-word-wars-win-rate">
                          {Math.round((wordWarsStats.matchWins / (wordWarsStats.matchWins + wordWarsStats.matchLosses)) * 100)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">Win Rate</p>
                      </div>
                    )}
                  </div>
                  <Link href="/word-wars">
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer" data-testid="link-word-wars-profile">
                      View tournaments
                    </span>
                  </Link>
                </div>
              </div>

              {championships.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/50">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                    <Crown className="h-3.5 w-3.5 fill-current" />
                    {championships.length === 1 ? "Champion" : `Champion ×${championships.length}`}
                  </p>
                  <div className="space-y-1">
                    {championships.map((c) => (
                      <Link key={c.id} href={`/word-wars/${c.tournamentId}`}>
                        <div
                          className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          data-testid={`row-championship-${c.id}`}
                        >
                          <span className="font-medium truncate">{c.tournamentName}</span>
                          <span className="shrink-0 ml-2">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-4">
            <Tabs defaultValue="stats">
              <div className="w-full overflow-x-auto">
                <TabsList className="flex w-max min-w-full h-auto" data-testid="tabs-profile-sections">
                  <TabsTrigger value="stats" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-game-stats">
                    <Gamepad2 className="h-4 w-4" /> <span className="hidden sm:inline">Game Stats</span>
                  </TabsTrigger>
                  <TabsTrigger value="quizzes" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-my-quizzes">
                    <GraduationCap className="h-4 w-4" /> <span className="hidden sm:inline">{isOwnProfile ? "My Quizzes" : "Quizzes"}</span>
                    {quizzes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">{quizzes.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="rankings" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-rankings">
                    <Trophy className="h-4 w-4" /> <span className="hidden sm:inline">Rankings</span>
                  </TabsTrigger>
                  <TabsTrigger value="achievements" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-achievements">
                    <Award className="h-4 w-4" /> <span className="hidden sm:inline">Achievements</span>
                    {profile.achievements.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">{profile.achievements.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="duels" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-duels">
                    <Swords className="h-4 w-4" /> <span className="hidden sm:inline">Duels</span>
                    {duelHistory.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">{duelHistory.length}</Badge>
                    )}
                  </TabsTrigger>
                  {isOwnProfile && (
                    <TabsTrigger value="social" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-social">
                      <Heart className="h-4 w-4" /> <span className="hidden sm:inline">Social</span>
                      {(myFriends.length + myGroups.length) > 0 && (
                        <Badge variant="secondary" className="ml-1 text-xs">{myFriends.length + myGroups.length}</Badge>
                      )}
                    </TabsTrigger>
                  )}
                  {isOwnProfile && (
                    <TabsTrigger value="settings" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-settings">
                      <Bell className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent value="stats" className="mt-4">
                {profile.stats.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Gamepad2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">No games played yet</p>
                    <p className="text-sm">Play some games to see stats here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profile.stats.map((stat) => {
                      return (
                        <div key={stat.gameSlug} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-game-stat-${stat.gameSlug}`}>
                          <div>
                            <p className="font-medium">{formatGameName(stat.gameSlug)}</p>
                            <p className="text-xs text-muted-foreground">{stat.gamesPlayed} played, {stat.gamesWon} won</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{stat.bestScore.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Best Score</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="quizzes" className="mt-4">
                {isOwnProfile && !quizzesLoading && (
                  <div className="flex items-center justify-between mb-3">
                    <Link href="/my-quizzes">
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground text-xs h-7 px-2" data-testid="link-manage-all-quizzes">
                        Manage all <ChevronRight className="h-3 w-3" />
                      </Button>
                    </Link>
                    <Link href="/create-quiz">
                      <Button size="sm" className="gap-2" data-testid="button-create-new-quiz">
                        <GraduationCap className="h-4 w-4" />
                        Create Quiz
                      </Button>
                    </Link>
                  </div>
                )}
                {quizzesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full rounded-lg" />
                    <Skeleton className="h-14 w-full rounded-lg" />
                  </div>
                ) : quizzes.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">No quizzes yet</p>
                    {isOwnProfile ? (
                      <>
                        <p className="text-sm mb-4">Pick a game and set up a shareable quiz — others compete on the same puzzle and scores appear on your leaderboard.</p>
                        <Link href="/create-quiz">
                          <Button variant="outline" size="sm" data-testid="button-quiz-empty-cta">Browse Quiz Games</Button>
                        </Link>
                      </>
                    ) : (
                      <p className="text-sm">This user hasn't created any quiz sessions yet.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {quizzes.map((quiz) => {
                      const game = gameMap.get(quiz.gameSlug);
                      const isClosed = quiz.closesAt ? new Date(quiz.closesAt) < new Date() : false;
                      return (
                        <div
                          key={quiz.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                          data-testid={`row-quiz-${quiz.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={isOwnProfile ? `/quiz/${quiz.shareCode}/results` : `/quiz/${quiz.shareCode}`}>
                                <span className="font-medium hover:underline cursor-pointer" data-testid={`text-quiz-title-${quiz.id}`}>{quiz.title}</span>
                              </Link>
                              {isClosed && <Badge variant="destructive" className="text-xs">Closed</Badge>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              <span>{game?.name ?? quiz.gameSlug.replace(/-/g, " ")}</span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {quiz.playerCount} {quiz.playerCount === 1 ? "player" : "players"}
                              </span>
                              {isOwnProfile && <span className="font-mono tracking-widest">{quiz.shareCode}</span>}
                              <span>Created {new Date(quiz.createdAt).toLocaleDateString()}</span>
                              {quiz.closesAt && (
                                <span>{isClosed ? "Closed" : "Closes"}: {new Date(quiz.closesAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isOwnProfile && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyQuizLink(quiz.shareCode)}
                                title="Copy play link"
                                data-testid={`button-copy-quiz-${quiz.id}`}
                              >
                                {copiedCode === quiz.shareCode
                                  ? <CheckCheck className="h-4 w-4 text-green-500" />
                                  : <Copy className="h-4 w-4" />}
                              </Button>
                            )}
                            <Link href={`/quiz/${quiz.shareCode}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Play quiz" data-testid={`button-play-quiz-${quiz.id}`}>
                                <Play className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/quiz/${quiz.shareCode}/results`}>
                              <Button variant="ghost" size="sm" className="h-8 text-xs" data-testid={`button-results-quiz-${quiz.id}`}>
                                Results
                              </Button>
                            </Link>
                            {isOwnProfile && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteQuizCode(quiz.shareCode)}
                                title="Delete quiz"
                                data-testid={`button-delete-quiz-${quiz.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rankings" className="mt-4">
                {profile.leaderboardRankings.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">No rankings yet</p>
                    <p className="text-sm">Submit scores to appear on the leaderboard.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profile.leaderboardRankings.map((r) => {
                      return (
                        <div key={r.gameSlug} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-ranking-${r.gameSlug}`}>
                          <span className="font-medium">{formatGameName(r.gameSlug)}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{r.score.toLocaleString()} pts</span>
                            <Badge variant={r.rank <= 3 ? "default" : "secondary"}>#{r.rank}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="achievements" className="mt-4">
                {profile.achievements.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">No achievements yet</p>
                    <p className="text-sm">Play games and complete milestones to earn achievements.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {profile.achievements.map((a) => (
                      <Badge key={a.achievementId} variant="secondary" data-testid={`badge-achievement-${a.achievementId}`}>
                        {a.achievementId.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                )}
              </TabsContent>

              {isOwnProfile && (
                <TabsContent value="settings" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-sm mb-1">Notification Preferences</h3>
                      <p className="text-xs text-muted-foreground mb-2">Choose which in-app notifications you receive.</p>
                    </div>
                    <Link href="/settings/notifications">
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                        data-testid="link-manage-notifications"
                      >
                        <span className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-muted-foreground" />
                          Manage Notification Preferences
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </Link>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="duels" className="mt-4">
                {duelHistoryLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full rounded-lg" />
                    <Skeleton className="h-14 w-full rounded-lg" />
                    <Skeleton className="h-14 w-full rounded-lg" />
                  </div>
                ) : duelHistory.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">No duels played yet</p>
                    <p className="text-sm">Duel a Friend to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {duelHistory.map((duel) => {
                      const isForfeit = duel.isForfeit;
                      const outcomeLabel = duel.outcome === "win"
                        ? (isForfeit ? "Forfeit" : "Win")
                        : duel.outcome === "loss"
                        ? (isForfeit ? "Forfeit" : "Loss")
                        : duel.outcome === "draw" ? "Draw" : "In Progress";
                      const outcomeBadgeVariant: "default" | "destructive" | "secondary" = (duel.outcome === "win" || isForfeit) ? "default" : duel.outcome === "loss" ? "destructive" : "secondary";
                      const outcomeBadgeClass = duel.outcome === "win"
                        ? (isForfeit ? "bg-orange-500 hover:bg-orange-500 text-white border-0" : "bg-green-500 hover:bg-green-500 text-white border-0")
                        : isForfeit ? "bg-orange-500 hover:bg-orange-500 text-white border-0" : "";
                      const eloDeltaPositive = duel.eloDelta !== null && duel.eloDelta > 0;
                      const eloDeltaNegative = duel.eloDelta !== null && duel.eloDelta < 0;
                      const date = duel.endedAt ? new Date(duel.endedAt) : new Date(duel.startedAt);
                      return (
                        <div
                          key={duel.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          data-testid={`row-duel-${duel.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={outcomeBadgeVariant}
                              className={`w-16 justify-center shrink-0 ${outcomeBadgeClass}`}
                              data-testid={`badge-duel-outcome-${duel.id}`}
                            >
                              {outcomeLabel}
                            </Badge>
                            <UserAvatar name={duel.opponentName} avatarUrl={duel.opponentAvatarUrl} className="h-8 w-8 shrink-0 text-xs" />
                            <div>
                              <p className="font-medium text-sm" data-testid={`text-duel-opponent-${duel.id}`}>
                                vs{" "}
                                <Link href={`/profile/${duel.opponentId}`}>
                                  <span className="hover:underline cursor-pointer">{duel.opponentName}</span>
                                </Link>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatGameName(duel.gameSlug)} · {date.toLocaleDateString(undefined, { dateStyle: "medium" })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0" data-testid={`text-duel-elo-delta-${duel.id}`}>
                            {duel.eloDelta !== null ? (
                              <>
                                {eloDeltaPositive && <TrendingUp className="h-4 w-4 text-green-500" />}
                                {eloDeltaNegative && <TrendingDown className="h-4 w-4 text-red-500" />}
                                {!eloDeltaPositive && !eloDeltaNegative && <Minus className="h-4 w-4 text-muted-foreground" />}
                                <span className={`text-sm font-semibold ${eloDeltaPositive ? "text-green-500" : eloDeltaNegative ? "text-red-500" : "text-muted-foreground"}`}>
                                  {eloDeltaPositive ? "+" : ""}{duel.eloDelta}
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
              </TabsContent>

              {isOwnProfile && (
                <TabsContent value="social" className="mt-4">
                  <div className="space-y-6">
                    {/* Friends */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-sm flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-primary" /> Friends
                          {myFriends.length > 0 && <Badge variant="secondary" className="text-xs">{myFriends.length}</Badge>}
                        </h3>
                        <Link href="/friends">
                          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground text-xs h-7 px-2" data-testid="link-all-friends">
                            View all <ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                      {friendsLoading ? (
                        <div className="space-y-2">
                          {[1,2,3].map(i => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
                        </div>
                      ) : myFriends.length === 0 ? (
                        <div className="text-center py-5 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm font-medium">No friends yet</p>
                          <Link href="/friends">
                            <Button variant="outline" size="sm" className="mt-3 gap-1" data-testid="button-find-friends">
                              <UserPlus className="h-3.5 w-3.5" /> Find Friends
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {myFriends.slice(0, 5).map(f => (
                            <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors" data-testid={`row-friend-${f.friendUser.id}`}>
                              <div className="flex items-center gap-2.5">
                                <UserAvatar name={f.friendUser.name} avatarUrl={f.friendUser.avatarUrl} className="h-7 w-7 text-xs shrink-0" />
                                <span className="text-sm font-medium">{f.friendUser.name}</span>
                              </div>
                              <Link href={`/profile/${f.friendUser.id}`}>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" data-testid={`link-friend-profile-${f.friendUser.id}`}>
                                  Profile <ChevronRight className="h-3 w-3 ml-0.5" />
                                </Button>
                              </Link>
                            </div>
                          ))}
                          {myFriends.length > 5 && (
                            <Link href="/friends">
                              <p className="text-xs text-center text-muted-foreground hover:text-foreground cursor-pointer py-1" data-testid="link-more-friends">
                                +{myFriends.length - 5} more — view all
                              </p>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Groups */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-sm flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-primary" /> Groups
                          {myGroups.length > 0 && <Badge variant="secondary" className="text-xs">{myGroups.length}</Badge>}
                        </h3>
                        <Link href="/groups">
                          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground text-xs h-7 px-2" data-testid="link-all-groups">
                            View all <ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                      {myGroups.length === 0 ? (
                        <div className="text-center py-5 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm font-medium">No groups yet</p>
                          <Link href="/groups">
                            <Button variant="outline" size="sm" className="mt-3 gap-1" data-testid="button-find-groups">
                              <Users className="h-3.5 w-3.5" /> Browse Groups
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {myGroups.slice(0, 5).map(g => (
                            <Link key={g.id} href={`/groups/${g.id}`}>
                              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" data-testid={`row-group-${g.id}`}>
                                <div className="flex items-center gap-2.5">
                                  {g.isPublic
                                    ? <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                                    : <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                                  <div>
                                    <p className="text-sm font-medium leading-tight">{g.name}</p>
                                    <p className="text-xs text-muted-foreground">{g.memberCount} {g.memberCount === 1 ? "member" : "members"}</p>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </Link>
                          ))}
                          {myGroups.length > 5 && (
                            <Link href="/groups">
                              <p className="text-xs text-center text-muted-foreground hover:text-foreground cursor-pointer py-1" data-testid="link-more-groups">
                                +{myGroups.length - 5} more — view all
                              </p>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-edit-profile">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex justify-center">
              <UserAvatar name={previewName} avatarUrl={previewUrl} className="h-20 w-20 text-2xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Display name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={50}
                placeholder="Your name"
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-avatar">Avatar URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="edit-avatar"
                value={editAvatarUrl}
                onChange={e => setEditAvatarUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                data-testid="input-edit-avatar-url"
              />
              <p className="text-xs text-muted-foreground">Paste a link to your photo. Leave blank to use your initials.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} data-testid="button-cancel-edit">Cancel</Button>
            <Button onClick={handleSave} disabled={updateProfile.isPending} data-testid="button-save-profile">
              {updateProfile.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteQuizCode} onOpenChange={(open) => { if (!open) setDeleteQuizCode(null); }}>
        <AlertDialogContent data-testid="dialog-delete-quiz">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the quiz and all submitted scores. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-quiz">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteQuizCode && deleteQuiz.mutate(deleteQuizCode)}
              disabled={deleteQuiz.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-quiz"
            >
              {deleteQuiz.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
