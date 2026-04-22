import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import { Pencil, Trophy, Award, Gamepad2, Calendar, Target, UserPlus, UserCheck, User } from "lucide-react";
import { motion } from "framer-motion";
import type { UserGameStats, UserAchievement, Game } from "@shared/schema";

interface PublicProfile {
  user: { id: number; name: string; avatarUrl: string | null; createdAt: string };
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
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl text-center">
        <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold">Profile not found</h1>
      </div>
    );
  }

  const totalGames = profile.stats.reduce((sum, s) => sum + s.gamesPlayed, 0);
  const totalWins = profile.stats.reduce((sum, s) => sum + s.gamesWon, 0);
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
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
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold" data-testid="text-profile-name">{profile.user.name}</h1>
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

        {profile.stats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" /> Game Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {profile.leaderboardRankings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5" /> Leaderboard Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {profile.achievements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5" /> Achievements ({profile.achievements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.achievements.map((a) => (
                  <Badge key={a.achievementId} variant="secondary" data-testid={`badge-achievement-${a.achievementId}`}>
                    {a.achievementId.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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
    </div>
  );
}
