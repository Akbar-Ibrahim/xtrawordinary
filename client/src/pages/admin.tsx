import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Shield, Users, Trophy, BarChart3, Ban, ShieldCheck, Trash2, Loader2, Star, Gamepad2, MessageSquare, Flag, Swords, Plus, Pencil, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [gameFilter, setGameFilter] = useState("all");

  if (!isAuthenticated || !user?.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-16 text-center" data-testid="admin-access-denied">
        <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You need admin privileges to view this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2" data-testid="text-admin-title">
          <Shield className="h-8 w-8" /> Admin Dashboard
        </h1>
        <Tabs defaultValue="overview" data-testid="admin-tabs">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="overview" data-testid="tab-overview"><BarChart3 className="h-4 w-4 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>
            <TabsTrigger value="leaderboard" data-testid="tab-leaderboard"><Trophy className="h-4 w-4 mr-1" />Leaderboard</TabsTrigger>
            <TabsTrigger value="groups" data-testid="tab-groups"><Users className="h-4 w-4 mr-1" />Groups</TabsTrigger>
            <TabsTrigger value="games" data-testid="tab-games"><Gamepad2 className="h-4 w-4 mr-1" />Games</TabsTrigger>
            <TabsTrigger value="comments" data-testid="tab-comments"><MessageSquare className="h-4 w-4 mr-1" />Comments</TabsTrigger>
            <TabsTrigger value="word-wars" data-testid="tab-word-wars"><Swords className="h-4 w-4 mr-1" />Word Wars</TabsTrigger>
            <TabsTrigger value="guild-wars" data-testid="tab-guild-wars"><Swords className="h-4 w-4 mr-1" />Guild Wars</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="leaderboard"><LeaderboardTab gameFilter={gameFilter} setGameFilter={setGameFilter} /></TabsContent>
          <TabsContent value="groups"><GroupsTab /></TabsContent>
          <TabsContent value="games"><GamesTab /></TabsContent>
          <TabsContent value="comments"><CommentsTab /></TabsContent>
          <TabsContent value="word-wars"><WordWarsTab /></TabsContent>
          <TabsContent value="guild-wars"><GuildWarsTab /></TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

function OverviewTab() {
  const { data: stats, isLoading } = useQuery<{ totalUsers: number; totalGamesPlayed: number; gamesPerSlug: Record<string, number> }>({
    queryKey: ["/api/admin/stats"],
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const sortedGames = stats?.gamesPerSlug
    ? Object.entries(stats.gamesPerSlug).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card data-testid="card-total-users">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.totalUsers ?? 0}</div></CardContent>
        </Card>
        <Card data-testid="card-total-games">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Games Played</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.totalGamesPlayed ?? 0}</div></CardContent>
        </Card>
        <Card data-testid="card-unique-games">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Game Types</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{sortedGames.length}</div></CardContent>
        </Card>
      </div>
      {sortedGames.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Games by Popularity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedGames.map(([slug, count]) => {
                const maxCount = sortedGames[0][1];
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={slug} className="flex items-center gap-3" data-testid={`game-stat-${slug}`}>
                    <span className="text-sm w-40 truncate font-medium">{slug}</span>
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });

  const banMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/users/${id}/ban`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User updated" }); },
    onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
  });

  const adminMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/users/${id}/admin`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User updated" }); },
    onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
  });

  const premiumMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/users/${id}/premium`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User updated" }); },
    onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader><CardTitle>All Users ({users?.length ?? 0})</CardTitle></CardHeader>
      <CardContent>
        {!users?.length ? (
          <p className="text-muted-foreground text-center py-8" data-testid="text-no-users">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Name</th>
                  <th className="text-left py-3 px-2">Email</th>
                  <th className="text-left py-3 px-2">Joined</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-right py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b hover:bg-muted/50" data-testid={`user-row-${u.id}`}>
                    <td className="py-3 px-2 font-medium">{u.name}</td>
                    <td className="py-3 px-2 text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-2 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1 flex-wrap">
                        {u.isAdmin && <Badge variant="default" data-testid={`badge-admin-${u.id}`}>Admin</Badge>}
                        {u.isPremium && <Badge className="bg-amber-500 text-white" data-testid={`badge-premium-${u.id}`}>Premium</Badge>}
                        {u.isBanned && <Badge variant="destructive" data-testid={`badge-banned-${u.id}`}>Banned</Badge>}
                        {!u.isAdmin && !u.isPremium && !u.isBanned && <Badge variant="secondary">User</Badge>}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant={u.isBanned ? "outline" : "destructive"}
                          onClick={() => banMutation.mutate(u.id)}
                          disabled={banMutation.isPending}
                          data-testid={`button-ban-${u.id}`}
                        >
                          <Ban className="h-3 w-3 mr-1" />
                          {u.isBanned ? "Unban" : "Ban"}
                        </Button>
                        <Button
                          size="sm"
                          variant={u.isAdmin ? "outline" : "secondary"}
                          onClick={() => adminMutation.mutate(u.id)}
                          disabled={adminMutation.isPending}
                          data-testid={`button-admin-${u.id}`}
                        >
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          {u.isAdmin ? "Remove Admin" : "Make Admin"}
                        </Button>
                        <Button
                          size="sm"
                          variant={u.isPremium ? "outline" : "secondary"}
                          onClick={() => premiumMutation.mutate(u.id)}
                          disabled={premiumMutation.isPending}
                          data-testid={`button-premium-${u.id}`}
                        >
                          <Star className="h-3 w-3 mr-1" />
                          {u.isPremium ? "Remove Premium" : "Make Premium"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeaderboardTab({ gameFilter, setGameFilter }: { gameFilter: string; setGameFilter: (v: string) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/leaderboard"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/leaderboard/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/leaderboard"] }); toast({ title: "Entry deleted" }); },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  const filtered = entries?.filter(e => gameFilter === "all" || e.gameSlug === gameFilter) ?? [];
  const gameSlugs = [...new Set(entries?.map(e => e.gameSlug) ?? [])].sort();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Leaderboard Entries ({filtered.length})</CardTitle>
          <Select value={gameFilter} onValueChange={setGameFilter}>
            <SelectTrigger className="w-48" data-testid="select-admin-game-filter">
              <SelectValue placeholder="Filter by game" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Games</SelectItem>
              {gameSlugs.map(slug => (
                <SelectItem key={slug} value={slug}>{slug}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!filtered.length ? (
          <p className="text-muted-foreground text-center py-8" data-testid="text-no-entries">No leaderboard entries.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Player</th>
                  <th className="text-left py-3 px-2">Game</th>
                  <th className="text-left py-3 px-2">Score</th>
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-right py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry: any) => (
                  <tr key={entry.id} className="border-b hover:bg-muted/50" data-testid={`lb-row-${entry.id}`}>
                    <td className="py-3 px-2 font-medium">{entry.playerName}</td>
                    <td className="py-3 px-2 text-muted-foreground">{entry.gameSlug}</td>
                    <td className="py-3 px-2 font-bold">{entry.score}</td>
                    <td className="py-3 px-2 text-muted-foreground">{new Date(entry.playedAt).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-lb-${entry.id}`}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GamesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: games, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/games"],
  });

  const toggleMutation = useMutation({
    mutationFn: ({ slug, isActive }: { slug: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/games/${slug}/active`, { isActive }),
    onMutate: async ({ slug, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/games"] });
      const previous = queryClient.getQueryData<any[]>(["/api/admin/games"]);
      queryClient.setQueryData<any[]>(["/api/admin/games"], (old) =>
        old?.map((g) => g.slug === slug ? { ...g, isActive } : g) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/admin/games"], context.previous);
      }
      toast({ title: "Failed to update game", variant: "destructive" });
    },
    onSuccess: () => toast({ title: "Game updated" }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!games?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground" data-testid="text-no-games">No games found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>All Games ({games.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">Name</th>
                <th className="text-left py-3 px-2">Slug</th>
                <th className="text-left py-3 px-2">Difficulty</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-right py-3 px-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g: any) => (
                <tr key={g.slug} className="border-b hover:bg-muted/50" data-testid={`game-row-${g.slug}`}>
                  <td className="py-3 px-2 font-medium">{g.name}</td>
                  <td className="py-3 px-2 text-muted-foreground font-mono text-xs">{g.slug}</td>
                  <td className="py-3 px-2">
                    <Badge variant="outline" className="capitalize text-xs">{g.difficulty}</Badge>
                  </td>
                  <td className="py-3 px-2">
                    {g.isActive !== false ? (
                      <Badge variant="default" className="text-xs bg-green-500/20 text-green-700 border-green-500/40 dark:text-green-300">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Switch
                      checked={g.isActive !== false}
                      onCheckedChange={(checked) => toggleMutation.mutate({ slug: g.slug, isActive: checked })}
                      disabled={toggleMutation.isPending}
                      data-testid={`toggle-game-${g.slug}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CommentsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/comments/reported"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/comments/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/comments/reported"] }); toast({ title: "Comment deleted" }); },
    onError: () => toast({ title: "Failed to delete comment", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!reports?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Flag className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-reports">No reported comments.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Reported Comments ({reports.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reports.map((r: any) => (
            <div key={r.id} className="border rounded-lg p-4 space-y-2" data-testid={`report-row-${r.id}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      <Flag className="h-3 w-3 mr-1" />
                      Report #{r.id}
                    </Badge>
                    {r.reporter && (
                      <span className="text-xs text-muted-foreground">
                        by <strong>{r.reporter.name}</strong>
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm"><strong>Reason:</strong> {r.reason}</p>
                  {r.comment && (
                    <div className="bg-muted/40 rounded p-2 mt-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        <strong>{r.comment.user?.name ?? "Unknown"}</strong> · {r.comment.targetType}/{r.comment.targetId}
                      </p>
                      {r.comment.isDeleted ? (
                        <p className="text-sm text-muted-foreground italic">[Already deleted]</p>
                      ) : (
                        <p className="text-sm break-words">{r.comment.content}</p>
                      )}
                    </div>
                  )}
                </div>
                {r.comment && !r.comment.isDeleted && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(r.comment.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-reported-${r.comment.id}`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete Comment
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GroupsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allGroups, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/groups"],
  });

  const featureMutation = useMutation({
    mutationFn: ({ id, isFeatured }: { id: number; isFeatured: boolean }) =>
      apiRequest("PATCH", `/api/groups/${id}/feature`, { isFeatured }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] }); toast({ title: "Group updated" }); },
    onError: () => toast({ title: "Failed to update group", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!allGroups?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground" data-testid="text-no-groups">No public groups yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>All Groups ({allGroups?.length ?? 0})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">Name</th>
                <th className="text-left py-3 px-2">Visibility</th>
                <th className="text-left py-3 px-2">Members</th>
                <th className="text-left py-3 px-2">Tags</th>
                <th className="text-left py-3 px-2">Featured</th>
                <th className="text-right py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(allGroups || []).map((g: any) => (
                <tr key={g.id} className="border-b hover:bg-muted/50" data-testid={`group-row-${g.id}`}>
                  <td className="py-3 px-2 font-medium">{g.name}</td>
                  <td className="py-3 px-2">
                    <Badge variant="outline" className="text-xs">{g.isPublic ? "Public" : "Private"}</Badge>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{g.memberCount ?? "—"}</td>
                  <td className="py-3 px-2">
                    <div className="flex flex-wrap gap-1">
                      {(g.tags || []).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    {g.isFeatured ? (
                      <Badge variant="default" className="gap-1 bg-yellow-500/20 text-yellow-700 border-yellow-500/40 dark:text-yellow-300" data-testid={`badge-featured-${g.id}`}>
                        <Star className="h-3 w-3 fill-current" />Featured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">—</Badge>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Button
                      size="sm"
                      variant={g.isFeatured ? "outline" : "secondary"}
                      onClick={() => featureMutation.mutate({ id: g.id, isFeatured: !g.isFeatured })}
                      disabled={featureMutation.isPending}
                      data-testid={`button-feature-${g.id}`}
                    >
                      <Star className={`h-3 w-3 mr-1 ${g.isFeatured ? "" : "fill-current"}`} />
                      {g.isFeatured ? "Unfeature" : "Feature"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function GuildWarsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [roundHours, setRoundHours] = useState("24");
  const [minGroups, setMinGroups] = useState("2");
  const [maxGroups, setMaxGroups] = useState("");

  const { data: tournaments = [], isLoading } = useQuery<Array<{
    id: number; name: string; status: string; registrationDeadline: string; roundDeadlineHours: number; minGroups: number; maxGroups: number | null; createdAt: string;
  }>>({
    queryKey: ["/api/guild-wars"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/guild-wars", {
      name: name.trim(),
      registrationDeadline: new Date(deadline).toISOString(),
      roundDeadlineHours: parseInt(roundHours),
      minGroups: parseInt(minGroups) || 2,
      maxGroups: maxGroups ? parseInt(maxGroups) : null,
    }),
    onSuccess: () => {
      toast({ title: "Tournament created!" });
      queryClient.invalidateQueries({ queryKey: ["/api/guild-wars"] });
      setName(""); setDeadline(""); setRoundHours("24"); setMinGroups("2"); setMaxGroups("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const drawMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/guild-wars/${id}/draw`),
    onSuccess: () => {
      toast({ title: "Bracket drawn!" });
      queryClient.invalidateQueries({ queryKey: ["/api/guild-wars"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const cancelMutation = useMutation({
    mutationFn: (id: number) => { setCancellingId(id); return apiRequest("PATCH", `/api/guild-wars/${id}/cancel`); },
    onSuccess: () => {
      toast({ title: "Tournament cancelled." });
      queryClient.invalidateQueries({ queryKey: ["/api/guild-wars"] });
      setCancellingId(null);
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); setCancellingId(null); },
  });

  const statusColor = (s: string) => ({
    registration: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    active: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    completed: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    cancelled: "bg-muted text-muted-foreground",
  }[s] ?? "bg-muted text-muted-foreground");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Guild Wars Tournament
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="gw-name">Tournament Name</Label>
              <Input
                id="gw-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Guild Wars Season 1"
                data-testid="input-gw-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-deadline">Registration Deadline</Label>
              <Input
                id="gw-deadline"
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                data-testid="input-gw-deadline"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-round-hours">Hours per Round</Label>
              <Input
                id="gw-round-hours"
                type="number"
                min="1"
                value={roundHours}
                onChange={e => setRoundHours(e.target.value)}
                data-testid="input-gw-round-hours"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-min">Min Guilds to Run</Label>
              <Input
                id="gw-min"
                type="number"
                min="2"
                value={minGroups}
                onChange={e => setMinGroups(e.target.value)}
                placeholder="2"
                data-testid="input-gw-min-groups"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-max">Max Guilds (optional)</Label>
              <Input
                id="gw-max"
                type="number"
                min="2"
                value={maxGroups}
                onChange={e => setMaxGroups(e.target.value)}
                placeholder="Unlimited"
                data-testid="input-gw-max-groups"
              />
            </div>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || !deadline || createMutation.isPending}
            data-testid="button-create-gw-tournament"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Create Tournament
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Swords className="h-4 w-4" />
            All Guild Wars Tournaments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : tournaments.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No Guild Wars tournaments yet.</p>
          ) : (
            <div className="space-y-3" data-testid="list-admin-gw-tournaments">
              {tournaments.map(t => (
                <div
                  key={t.id}
                  className="border rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
                  data-testid={`row-gw-tournament-${t.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs ${statusColor(t.status)}`}>{t.status}</Badge>
                      <span className="font-medium truncate" data-testid={`text-gw-name-${t.id}`}>{t.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Deadline: {new Date(t.registrationDeadline).toLocaleString()} · {t.roundDeadlineHours}h/round
                      {` · min ${t.minGroups ?? 2} guilds`}
                      {t.maxGroups ? ` · max ${t.maxGroups}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.status === "registration" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => drawMutation.mutate(t.id)}
                        disabled={drawMutation.isPending}
                        data-testid={`button-draw-gw-bracket-${t.id}`}
                      >
                        {drawMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Draw Bracket
                      </Button>
                    )}
                    {t.status === "registration" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (window.confirm(`Cancel "${t.name}"? This cannot be undone.`)) {
                            cancelMutation.mutate(t.id);
                          }
                        }}
                        disabled={cancellingId === t.id}
                        data-testid={`button-cancel-gw-tournament-${t.id}`}
                      >
                        {cancellingId === t.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
                        Cancel
                      </Button>
                    )}
                    <a href={`/guild-wars/${t.id}`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" data-testid={`link-gw-bracket-${t.id}`}>View</Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WordWarsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [roundHours, setRoundHours] = useState("24");
  const [minPlayers, setMinPlayers] = useState("2");
  const [maxPlayers, setMaxPlayers] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editRoundHours, setEditRoundHours] = useState("24");
  const [editMinPlayers, setEditMinPlayers] = useState("2");
  const [editMaxPlayers, setEditMaxPlayers] = useState("");

  const { data: tournaments = [], isLoading } = useQuery<Array<{
    id: number; name: string; status: string; registrationDeadline: string; roundDeadlineHours: number; minPlayers: number; maxPlayers: number | null; createdAt: string;
  }>>({
    queryKey: ["/api/word-wars"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/word-wars", {
      name: name.trim(),
      registrationDeadline: new Date(deadline).toISOString(),
      roundDeadlineHours: parseInt(roundHours),
      minPlayers: parseInt(minPlayers) || 2,
      maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
    }),
    onSuccess: () => {
      toast({ title: "Tournament created!" });
      queryClient.invalidateQueries({ queryKey: ["/api/word-wars"] });
      setName(""); setDeadline(""); setRoundHours("24"); setMinPlayers("2"); setMaxPlayers("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const drawMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/word-wars/${id}/draw`),
    onSuccess: () => {
      toast({ title: "Bracket drawn!" });
      queryClient.invalidateQueries({ queryKey: ["/api/word-wars"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/word-wars/${id}`, {
      name: editName.trim(),
      registrationDeadline: new Date(editDeadline).toISOString(),
      roundDeadlineHours: parseInt(editRoundHours),
      minPlayers: parseInt(editMinPlayers) || 2,
      maxPlayers: editMaxPlayers ? parseInt(editMaxPlayers) : null,
    }),
    onSuccess: () => {
      toast({ title: "Tournament updated!" });
      queryClient.invalidateQueries({ queryKey: ["/api/word-wars"] });
      setEditingId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const cancelMutation = useMutation({
    mutationFn: (id: number) => { setCancellingId(id); return apiRequest("POST", `/api/word-wars/${id}/cancel`); },
    onSuccess: () => {
      toast({ title: "Tournament cancelled." });
      queryClient.invalidateQueries({ queryKey: ["/api/word-wars"] });
      setCancellingId(null);
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); setCancellingId(null); },
  });

  function startEdit(t: { id: number; name: string; registrationDeadline: string; roundDeadlineHours: number; minPlayers: number; maxPlayers: number | null }) {
    setEditingId(t.id);
    setEditName(t.name);
    const d = new Date(t.registrationDeadline);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditDeadline(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setEditRoundHours(String(t.roundDeadlineHours));
    setEditMinPlayers(String(t.minPlayers ?? 2));
    setEditMaxPlayers(t.maxPlayers ? String(t.maxPlayers) : "");
  }

  const statusColor = (s: string) => ({
    registration: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    active: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    completed: "bg-primary/15 text-primary",
    cancelled: "bg-muted text-muted-foreground",
  }[s] ?? "bg-muted text-muted-foreground");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Tournament
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ww-name">Tournament Name</Label>
              <Input
                id="ww-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Word Wars Season 1"
                data-testid="input-ww-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ww-deadline">Registration Deadline</Label>
              <Input
                id="ww-deadline"
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                data-testid="input-ww-deadline"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ww-round-hours">Hours per Round</Label>
              <Input
                id="ww-round-hours"
                type="number"
                min="1"
                value={roundHours}
                onChange={e => setRoundHours(e.target.value)}
                data-testid="input-ww-round-hours"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ww-min">Min Players to Run</Label>
              <Input
                id="ww-min"
                type="number"
                min="2"
                value={minPlayers}
                onChange={e => setMinPlayers(e.target.value)}
                placeholder="2"
                data-testid="input-ww-min-players"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ww-max">Max Players (optional)</Label>
              <Input
                id="ww-max"
                type="number"
                min="2"
                value={maxPlayers}
                onChange={e => setMaxPlayers(e.target.value)}
                placeholder="Unlimited"
                data-testid="input-ww-max-players"
              />
            </div>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || !deadline || createMutation.isPending}
            data-testid="button-create-ww-tournament"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Create Tournament
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Swords className="h-4 w-4" />
            All Tournaments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : tournaments.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No tournaments yet.</p>
          ) : (
            <div className="space-y-3" data-testid="list-admin-tournaments">
              {tournaments.map(t => (
                <div
                  key={t.id}
                  className="border rounded-lg px-4 py-3 space-y-3"
                  data-testid={`row-ww-tournament-${t.id}`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${statusColor(t.status)}`}>{t.status}</Badge>
                        <span className="font-medium truncate" data-testid={`text-ww-name-${t.id}`}>{t.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Deadline: {new Date(t.registrationDeadline).toLocaleString()} · {t.roundDeadlineHours}h/round
                        {` · min ${t.minPlayers ?? 2}`}
                        {t.maxPlayers ? ` · max ${t.maxPlayers}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.status === "registration" && editingId !== t.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(t)}
                          data-testid={`button-edit-ww-tournament-${t.id}`}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                      {t.status === "registration" && editingId !== t.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => drawMutation.mutate(t.id)}
                          disabled={drawMutation.isPending}
                          data-testid={`button-draw-bracket-${t.id}`}
                        >
                          {drawMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Draw Bracket
                        </Button>
                      )}
                      {t.status === "registration" && editingId !== t.id && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (window.confirm(`Cancel "${t.name}"? This cannot be undone.`)) {
                              cancelMutation.mutate(t.id);
                            }
                          }}
                          disabled={cancellingId === t.id}
                          data-testid={`button-cancel-ww-tournament-${t.id}`}
                        >
                          {cancellingId === t.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
                          Cancel
                        </Button>
                      )}
                      {editingId !== t.id && (
                        <a href={`/word-wars/${t.id}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" data-testid={`link-ww-bracket-${t.id}`}>View</Button>
                        </a>
                      )}
                      {editingId === t.id && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => updateMutation.mutate(t.id)}
                            disabled={!editName.trim() || !editDeadline || updateMutation.isPending}
                            data-testid={`button-save-ww-tournament-${t.id}`}
                          >
                            {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            data-testid={`button-cancel-edit-ww-${t.id}`}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId === t.id && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1 border-t" data-testid={`form-edit-ww-${t.id}`}>
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          data-testid={`input-edit-ww-name-${t.id}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Registration Deadline</Label>
                        <Input
                          type="datetime-local"
                          value={editDeadline}
                          onChange={e => setEditDeadline(e.target.value)}
                          data-testid={`input-edit-ww-deadline-${t.id}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hours per Round</Label>
                        <Input
                          type="number"
                          min="1"
                          value={editRoundHours}
                          onChange={e => setEditRoundHours(e.target.value)}
                          data-testid={`input-edit-ww-round-hours-${t.id}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min Players</Label>
                        <Input
                          type="number"
                          min="2"
                          value={editMinPlayers}
                          onChange={e => setEditMinPlayers(e.target.value)}
                          data-testid={`input-edit-ww-min-players-${t.id}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Players (optional)</Label>
                        <Input
                          type="number"
                          min="2"
                          value={editMaxPlayers}
                          onChange={e => setEditMaxPlayers(e.target.value)}
                          placeholder="Unlimited"
                          data-testid={`input-edit-ww-max-players-${t.id}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
