import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Game } from "@shared/schema";
import {
  ACHIEVEMENT_DEFINITIONS,
  getTotalAchievementPoints,
  getMaxAchievementPoints,
  loadStats as loadLocalStats,
  loadStreak as loadLocalStreak,
  loadDuelStats as loadLocalDuelStats,
} from "@/lib/game-stats";
import type { PublicProfile, QuizSessionWithCount, DuelHistoryEntry, FriendEntry, GroupSummary } from "./types";

export function useProfileData(userId: number) {
  const { user: currentUser, isAuthenticated, refreshUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const isOwnProfile = currentUser?.id === userId;

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
  const gameMap = new Map(games.map(g => [g.slug, g]));

  function formatGameName(gameSlug: string): string {
    const game = gameMap.get(gameSlug);
    if (game) return game.name;
    const lockedMatch = gameSlug.match(/^letter-balance-locked-(\d+)l(\d+)c$/);
    if (lockedMatch) {
      const length = parseInt(lockedMatch[1]);
      const consonants = parseInt(lockedMatch[2]);
      return `Locked Balance (${length}L/${consonants}C/${length - consonants}V)`;
    }
    if (gameSlug === "letter-balance-locked-advanced") return "Locked Balance (Advanced)";
    if (gameSlug === "letter-balance-survival") return "Vowel & Consonant (Survival)";
    return gameSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

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
    mutationFn: (data: { username?: string; name?: string; avatarUrl?: string | null; bio?: string | null }) =>
      apiRequest("PATCH", "/api/users/me", data),
    onSuccess: async () => {
      toast({ title: "Profile updated!" });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "profile"] });
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
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

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

  const { data: guildWarsChampionships = [] } = useQuery<Array<{ id: number; tournamentId: number; groupId: number; tournamentName: string; groupName: string; createdAt: string }>>({
    queryKey: ["/api/users", userId, "guild-wars-championships"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/guild-wars-championships`, { credentials: "include" });
      if (!res.ok) return [];
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

  return {
    profile, isLoading,
    isOwnProfile, isAuthenticated,
    gameMap, formatGameName,
    friendship,
    sendRequest, downgradePremium, updateProfile, deleteAccount, deleteQuiz,
    duelRating, hasDuelActivity, duelRank, totalDuelPlayers,
    championships, wordWarsStats, guildWarsChampionships,
    ownStreak, ownDailyStreak, viewedStreak,
    duelHistory, duelHistoryLoading,
    quizzes, quizzesLoading,
    myFriends, friendsLoading, myGroups,
    unlockedIds, achievementPoints, maxPoints,
    localStats, localStreak, localDuelStats,
  };
}
