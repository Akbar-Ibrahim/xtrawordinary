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
import { Pencil, Trophy, Award, Gamepad2, Calendar, Target, UserPlus, UserCheck, User, GraduationCap, Copy, CheckCheck, Users, Trash2, Crown, Play } from "lucide-react";
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

        <Card>
          <CardContent className="pt-4">
            <Tabs defaultValue="stats">
              <TabsList className="w-full grid grid-cols-4" data-testid="tabs-profile-sections">
                <TabsTrigger value="stats" className="flex items-center gap-1.5" data-testid="tab-game-stats">
                  <Gamepad2 className="h-4 w-4" /> Game Stats
                </TabsTrigger>
                <TabsTrigger value="quizzes" className="flex items-center gap-1.5" data-testid="tab-my-quizzes">
                  <GraduationCap className="h-4 w-4" /> {isOwnProfile ? "My Quizzes" : "Quizzes"}
                  {quizzes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{quizzes.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="rankings" className="flex items-center gap-1.5" data-testid="tab-rankings">
                  <Trophy className="h-4 w-4" /> Rankings
                </TabsTrigger>
                <TabsTrigger value="achievements" className="flex items-center gap-1.5" data-testid="tab-achievements">
                  <Award className="h-4 w-4" /> Achievements
                  {profile.achievements.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{profile.achievements.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

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
                      const game = gameMap.get(stat.gameSlug);
                      return (
                        <div key={stat.gameSlug} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-game-stat-${stat.gameSlug}`}>
                          <div>
                            <p className="font-medium">{game?.name || stat.gameSlug}</p>
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
                        <p className="text-sm mb-4">Create a shareable quiz session from any supported game page so others can compete on the same puzzle.</p>
                        <Link href="/game/definition-match">
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
                      const game = gameMap.get(r.gameSlug);
                      return (
                        <div key={r.gameSlug} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-ranking-${r.gameSlug}`}>
                          <span className="font-medium">{game?.name || r.gameSlug}</span>
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
