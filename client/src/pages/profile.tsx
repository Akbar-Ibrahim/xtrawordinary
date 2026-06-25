import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
import { PlayerChallengeDialog } from "@/components/player-challenge-dialog";
import { Pencil, Trophy, Award, Gamepad2, Calendar, Target, UserPlus, UserCheck, User, GraduationCap, Crown, Swords, Heart, Bell, Sword } from "lucide-react";
import { motion } from "framer-motion";
import type { Game } from "@shared/schema";
import {
  ACHIEVEMENT_DEFINITIONS,
  getTotalAchievementPoints,
  getMaxAchievementPoints,
  loadStats as loadLocalStats,
  loadStreak as loadLocalStreak,
  loadDuelStats as loadLocalDuelStats,
} from "@/lib/game-stats";
import type { PublicProfile, QuizSessionWithCount, DuelHistoryEntry, FriendEntry, GroupSummary } from "./profile/types";
import { StatsTab } from "./profile/StatsTab";
import { QuizzesTab } from "./profile/QuizzesTab";
import { RankingsTab } from "./profile/RankingsTab";
import { AchievementsTab } from "./profile/AchievementsTab";
import { DuelsTab } from "./profile/DuelsTab";
import { SocialTab } from "./profile/SocialTab";
import { SettingsTab } from "./profile/SettingsTab";

export default function Profile() {
  const [, params] = useRoute("/profile/:id");
  const userId = parseInt(params?.id || "0");
  const { user: currentUser, isAuthenticated, refreshUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBio, setEditBio] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playerChallengeOpen, setPlayerChallengeOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteQuizCode, setDeleteQuizCode] = useState<string | null>(null);

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
    mutationFn: (data: { name?: string; avatarUrl?: string | null; bio?: string | null }) =>
      apiRequest("PATCH", "/api/users/me", data),
    onSuccess: async () => {
      toast({ title: "Profile updated!" });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "profile"] });
      setEditOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteAccount = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/users/me"),
    onSuccess: () => {
      toast({ title: "Account deleted", description: "Your account has been permanently removed." });
      navigate("/");
      window.location.reload();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteQuiz = useMutation({
    mutationFn: (shareCode: string) => apiRequest("DELETE", `/api/quiz-sessions/${shareCode}`),
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

  const { data: ownStreak } = useQuery<{ currentStreak: number; longestStreak: number; lastPlayedDate: string | null }>({
    queryKey: ["/api/user/streak"],
    enabled: isAuthenticated,
  });

  const { data: ownDailyStreak } = useQuery<{ streak: number; longest: number }>({
    queryKey: ["/api/user/daily-streak"],
    enabled: isAuthenticated && isOwnProfile,
  });

  const { data: viewedStreak } = useQuery<{ currentStreak: number; longestStreak: number; lastPlayedDate: string | null }>({
    queryKey: ["/api/users", userId, "streak"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/streak`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !isOwnProfile && userId > 0,
  });

  const { data: guildWarsChampionships = [] } = useQuery<Array<{
    id: number; tournamentId: number; groupId: number; tournamentName: string; groupName: string; createdAt: string;
  }>>({
    queryKey: ["/api/users", userId, "guild-wars-championships"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/guild-wars-championships`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: userId > 0,
  });

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

  const { data: myFriends = [], isLoading: friendsLoading } = useQuery<FriendEntry[]>({
    queryKey: ["/api/friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOwnProfile && isAuthenticated,
  });

  const { data: groupsData } = useQuery<{ myGroups: GroupSummary[] }>({
    queryKey: ["/api/groups"],
    enabled: isOwnProfile && isAuthenticated,
  });
  const myGroups = groupsData?.myGroups ?? [];

  const unlockedIds = useMemo(
    () => new Set((profile?.achievements ?? []).map((a) => a.achievementId)),
    [profile?.achievements]
  );

  const achievementPoints = useMemo(() => {
    const unlocked = ACHIEVEMENT_DEFINITIONS.filter((a) => unlockedIds.has(a.id)).map((a) => ({ ...a, unlockedAt: 1 }));
    return getTotalAchievementPoints(unlocked);
  }, [unlockedIds]);

  const maxPoints = getMaxAchievementPoints();
  const localStats = useMemo(() => (isOwnProfile ? loadLocalStats() : null), [isOwnProfile]);
  const localStreak = useMemo(() => (isOwnProfile ? loadLocalStreak() : null), [isOwnProfile]);
  const localDuelStats = useMemo(() => (isOwnProfile ? loadLocalDuelStats() : null), [isOwnProfile]);

  function copyQuizLink(shareCode: string) {
    navigator.clipboard.writeText(`${window.location.origin}/quiz/${shareCode}`);
    setCopiedCode(shareCode);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({ title: "Play link copied!" });
  }

  function openEdit() {
    if (!profile) return;
    setEditName(profile.user.name);
    setEditAvatarUrl(profile.user.avatarUrl ?? "");
    setEditBio((profile.user as any).bio ?? "");
    setEditOpen(true);
  }

  function handleSave() {
    const data: { name?: string; avatarUrl?: string | null; bio?: string | null } = {};
    if (editName.trim() && editName.trim() !== profile?.user.name) data.name = editName.trim();
    const url = editAvatarUrl.trim() || null;
    if (url !== (profile?.user.avatarUrl ?? null)) data.avatarUrl = url;
    const bioVal = editBio.trim() || null;
    if (bioVal !== ((profile?.user as any)?.bio ?? null)) data.bio = bioVal;
    if (Object.keys(data).length === 0) { setEditOpen(false); return; }
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
        {/* Header card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <UserAvatar name={profile.user.name} avatarUrl={profile.user.avatarUrl} className="h-16 w-16 text-xl" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold" data-testid="text-profile-name">{profile.user.name}</h1>
                  {profile.user.isPremium && (
                    <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white border-0" data-testid="badge-premium-profile">
                      <Crown className="h-3 w-3" /> Premium
                    </Badge>
                  )}
                  {championships.length > 0 && (
                    <Badge className="gap-1 bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 hover:bg-amber-400/25" data-testid="badge-word-wars-champion">
                      <Crown className="h-3 w-3 fill-current" />
                      Word Wars Champion{championships.length > 1 ? ` ×${championships.length}` : ""}
                    </Badge>
                  )}
                  {guildWarsChampionships.length > 0 && (
                    <Badge className="gap-1 bg-purple-400/20 text-purple-700 dark:text-purple-300 border border-purple-400/40 hover:bg-purple-400/25" data-testid="badge-guild-wars-champion">
                      <Swords className="h-3 w-3" />
                      Guild Wars Champion{guildWarsChampionships.length > 1 ? ` ×${guildWarsChampionships.length}` : ""}
                    </Badge>
                  )}
                  {isOwnProfile && (
                    <button onClick={openEdit} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-edit-profile" aria-label="Edit profile">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isOwnProfile && profile.user.isPremium && (
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={() => downgradePremium.mutate()} disabled={downgradePremium.isPending} data-testid="button-downgrade-premium">
                    Remove Premium (testing)
                  </Button>
                )}
                {(profile.user as any).bio && (
                  <p className="text-sm text-muted-foreground mt-0.5 max-w-md" data-testid="text-profile-bio">{(profile.user as any).bio}</p>
                )}
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {new Date(profile.user.createdAt).toLocaleDateString()}
                </p>
              </div>
              {isAuthenticated && !isOwnProfile && (
                <div className="flex items-center gap-2 flex-wrap">
                  {friendship ? (
                    <Badge variant="secondary" className="gap-1" data-testid="badge-friend">
                      <UserCheck className="h-3 w-3" /> Friends
                    </Badge>
                  ) : (
                    <Button size="sm" onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending} data-testid="button-add-friend">
                      <UserPlus className="h-4 w-4 mr-1" /> Add Friend
                    </Button>
                  )}
                  <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1" onClick={() => setPlayerChallengeOpen(true)} data-testid="button-open-challenge">
                    <Swords className="h-4 w-4" /> Challenge
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Games Played", value: totalGames, icon: Gamepad2 },
            { label: "Win Rate", value: `${winRate}%`, icon: Target },
            { label: "Achiev. Points", value: achievementPoints, icon: Award },
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

        {/* Duel ELO card */}
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
                      <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer" data-testid="link-duel-rank">
                        #{duelRank} of {totalDuelPlayers} players
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Guild Wars championships */}
        {guildWarsChampionships.length > 0 && (
          <Card className="border-amber-300 dark:border-amber-700" data-testid="card-guild-wars-stats">
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-2 mb-3">
                <Swords className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Guild Wars</p>
                  <p className="text-xs text-muted-foreground">
                    {guildWarsChampionships.length} {guildWarsChampionships.length === 1 ? "championship" : "championships"}
                  </p>
                </div>
                <div className="ml-auto">
                  <Link href="/guild-wars">
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer" data-testid="link-guild-wars-profile">View tournaments</span>
                  </Link>
                </div>
              </div>
              <div className="space-y-1">
                {guildWarsChampionships.map((c) => (
                  <Link key={c.id} href={`/guild-wars/${c.tournamentId}`}>
                    <div className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer gap-2" data-testid={`row-gw-championship-${c.id}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Crown className="h-3 w-3 text-amber-500 shrink-0 fill-current" />
                        <span className="font-medium truncate">{c.tournamentName}</span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1 text-amber-500/70">
                        <span className="text-muted-foreground">({c.groupName})</span>
                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Word Wars stats */}
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
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer" data-testid="link-word-wars-profile">View tournaments</span>
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
                        <div className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid={`row-championship-${c.id}`}>
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

        {/* Tab panels */}
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
                    {quizzes.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{quizzes.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="rankings" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-rankings">
                    <Trophy className="h-4 w-4" /> <span className="hidden sm:inline">Rankings</span>
                  </TabsTrigger>
                  <TabsTrigger value="achievements" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-achievements">
                    <Award className="h-4 w-4" /> <span className="hidden sm:inline">Achievements</span>
                    {achievementPoints > 0 && <Badge variant="secondary" className="ml-1 text-xs">{achievementPoints}pts</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="duels" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-duels">
                    <Swords className="h-4 w-4" /> <span className="hidden sm:inline">Duels</span>
                    {duelHistory.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{duelHistory.length}</Badge>}
                  </TabsTrigger>
                  {isOwnProfile && (
                    <TabsTrigger value="social" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-social">
                      <Heart className="h-4 w-4" /> <span className="hidden sm:inline">Social</span>
                      {(myFriends.length + myGroups.length) > 0 && <Badge variant="secondary" className="ml-1 text-xs">{myFriends.length + myGroups.length}</Badge>}
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
                <StatsTab
                  profileName={profile.user.name}
                  stats={profile.stats}
                  isOwnProfile={isOwnProfile}
                  isAuthenticated={isAuthenticated}
                  ownStreak={ownStreak}
                  ownDailyStreak={ownDailyStreak}
                  viewedStreak={viewedStreak}
                  formatGameName={formatGameName}
                />
              </TabsContent>

              <TabsContent value="quizzes" className="mt-4">
                <QuizzesTab
                  isOwnProfile={isOwnProfile}
                  quizzesLoading={quizzesLoading}
                  quizzes={quizzes}
                  gameMap={gameMap}
                  copiedCode={copiedCode}
                  onCopyLink={copyQuizLink}
                  onDeleteClick={setDeleteQuizCode}
                />
              </TabsContent>

              <TabsContent value="rankings" className="mt-4">
                <RankingsTab rankings={profile.leaderboardRankings} formatGameName={formatGameName} />
              </TabsContent>

              <TabsContent value="achievements" className="mt-4">
                <AchievementsTab
                  unlockedIds={unlockedIds}
                  achievementPoints={achievementPoints}
                  maxPoints={maxPoints}
                  isOwnProfile={isOwnProfile}
                  localStats={localStats}
                  localStreak={localStreak}
                  localDuelStats={localDuelStats}
                />
              </TabsContent>

              <TabsContent value="duels" className="mt-4">
                <DuelsTab
                  duelHistoryLoading={duelHistoryLoading}
                  duelHistory={duelHistory}
                  formatGameName={formatGameName}
                />
              </TabsContent>

              {isOwnProfile && (
                <TabsContent value="social" className="mt-4">
                  <SocialTab myFriends={myFriends} myGroups={myGroups} friendsLoading={friendsLoading} />
                </TabsContent>
              )}

              {isOwnProfile && (
                <TabsContent value="settings" className="mt-4">
                  <SettingsTab onDeleteAccount={() => setDeleteDialogOpen(true)} />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit profile dialog */}
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
              <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} maxLength={50} placeholder="Your name" data-testid="input-edit-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-avatar">Avatar URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="edit-avatar" value={editAvatarUrl} onChange={e => setEditAvatarUrl(e.target.value)} placeholder="https://example.com/photo.jpg" data-testid="input-edit-avatar-url" />
              <p className="text-xs text-muted-foreground">Paste a link to your photo. Leave blank to use your initials.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bio">Bio <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <textarea
                id="edit-bio"
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                maxLength={200}
                placeholder="A short tagline or description about you…"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                data-testid="input-edit-bio"
              />
              <p className="text-xs text-muted-foreground text-right">{editBio.length}/200</p>
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

      {isAuthenticated && !isOwnProfile && profile && (
        <PlayerChallengeDialog targetUser={profile.user} open={playerChallengeOpen} onOpenChange={setPlayerChallengeOpen} />
      )}

      {/* Delete account dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-account">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove your account, stats, achievements, and all associated data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-account">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAccount.mutate()} disabled={deleteAccount.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-account">
              {deleteAccount.isPending ? "Deleting…" : "Delete Forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete quiz dialog */}
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
            <AlertDialogAction onClick={() => deleteQuizCode && deleteQuiz.mutate(deleteQuizCode)} disabled={deleteQuiz.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-quiz">
              {deleteQuiz.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
