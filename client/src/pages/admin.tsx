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
import { Shield, Users, Trophy, BarChart3, Ban, ShieldCheck, Trash2, Loader2, Star, Gamepad2 } from "lucide-react";
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
          <TabsList className="mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview"><BarChart3 className="h-4 w-4 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>
            <TabsTrigger value="leaderboard" data-testid="tab-leaderboard"><Trophy className="h-4 w-4 mr-1" />Leaderboard</TabsTrigger>
            <TabsTrigger value="groups" data-testid="tab-groups"><Users className="h-4 w-4 mr-1" />Groups</TabsTrigger>
            <TabsTrigger value="games" data-testid="tab-games"><Gamepad2 className="h-4 w-4 mr-1" />Games</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="leaderboard"><LeaderboardTab gameFilter={gameFilter} setGameFilter={setGameFilter} /></TabsContent>
          <TabsContent value="groups"><GroupsTab /></TabsContent>
          <TabsContent value="games"><GamesTab /></TabsContent>
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
                      <div className="flex gap-1">
                        {u.isAdmin && <Badge variant="default" data-testid={`badge-admin-${u.id}`}>Admin</Badge>}
                        {u.isBanned && <Badge variant="destructive" data-testid={`badge-banned-${u.id}`}>Banned</Badge>}
                        {!u.isAdmin && !u.isBanned && <Badge variant="secondary">User</Badge>}
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Game updated" });
    },
    onError: () => toast({ title: "Failed to update game", variant: "destructive" }),
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
