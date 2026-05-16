import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCountdown, formatCountdown } from "@/lib/use-countdown";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AuthModal } from "@/components/auth-modal";
import { Trophy, Swords, Users, Clock, Crown, Calendar, ChevronRight, Loader2, Star, AlertTriangle, Shield } from "lucide-react";
import { motion } from "framer-motion";
import type { GuildWarsTournament, Group } from "@shared/schema";

type ChampionEntry = {
  id: number;
  tournamentId: number;
  groupId: number;
  tournamentName: string;
  createdAt: string;
  groupName: string | null;
};

type RegistrationEntry = {
  id: number;
  tournamentId: number;
  groupId: number;
  registeredBy: number;
  createdAt: string;
  groupName: string | null;
};

type TournamentDetail = GuildWarsTournament & {
  registrations: RegistrationEntry[];
  groups: Record<number, { id: number; name: string }>;
};

function statusBadge(t: GuildWarsTournament) {
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

function TournamentCard({
  tournament,
  isAuthenticated,
  allUserGroups,
  adminGroups,
}: {
  tournament: GuildWarsTournament & { registrationCount?: number };
  isAuthenticated: boolean;
  allUserGroups: Group[];
  adminGroups: Group[];
}) {
  const { toast } = useToast();
  const countdown = useCountdown(tournament.registrationDeadline, tournament.status === "registration");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const { data: detail } = useQuery<TournamentDetail>({
    queryKey: ["/api/guild-wars", tournament.id],
    queryFn: async () => {
      const res = await fetch(`/api/guild-wars/${tournament.id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const registeredGroupIds = new Set((detail?.registrations ?? []).map((r) => r.groupId));
  // Any of the user's groups being registered → show "registered" indicator
  const userRegisteredGroup = allUserGroups.find((g) => registeredGroupIds.has(g.id));
  const isRegistered = !!userRegisteredGroup;
  // Only admin/owner groups that aren't already registered can register
  const adminRegisteredGroup = adminGroups.find((g) => registeredGroupIds.has(g.id));
  const groupCount = detail?.registrations.length ?? tournament.registrationCount ?? 0;

  const registerMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const res = await apiRequest("POST", `/api/guild-wars/${tournament.id}/register`, { groupId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guild-wars", tournament.id] });
      setRegisterOpen(false);
      toast({ title: "Group registered for the war!" });
    },
    onError: async (err: any) => {
      let msg = "Failed to register";
      try { const b = await err.response?.json(); if (b?.error) msg = b.error; } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const res = await apiRequest("DELETE", `/api/guild-wars/${tournament.id}/register`, { groupId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guild-wars", tournament.id] });
      toast({ title: "Registration withdrawn" });
    },
    onError: async (err: any) => {
      let msg = "Failed to withdraw";
      try { const b = await err.response?.json(); if (b?.error) msg = b.error; } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  const canRegister = tournament.status === "registration" && new Date(tournament.registrationDeadline) > new Date();
  const WARN_THRESHOLD_MS = 24 * 60 * 60 * 1000;
  const needsMore = tournament.status === "registration" && groupCount < tournament.minGroups;
  const closingSoon = countdown > 0 && countdown <= WARN_THRESHOLD_MS;
  const showWarning = needsMore && closingSoon;
  const groupsNeeded = tournament.minGroups - groupCount;

  const unregisteredAdminGroups = adminGroups.filter((g) => !registeredGroupIds.has(g.id));

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-gw-tournament-${tournament.id}`}>
      <CardContent className="pt-5 pb-4">
        {showWarning && (
          <div
            className="flex items-center gap-2 mb-3 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
            data-testid={`banner-low-registration-${tournament.id}`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Needs {groupsNeeded} more {groupsNeeded === 1 ? "guild" : "guilds"} to run</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {statusBadge(tournament)}
              {tournament.maxGroups && (
                <Badge variant="outline" className="text-xs" data-testid={`badge-max-groups-${tournament.id}`}>
                  Max {tournament.maxGroups} guilds
                </Badge>
              )}
            </div>
            <h3 className="font-bold text-lg truncate" data-testid={`text-gw-tournament-name-${tournament.id}`}>
              {tournament.name}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1" data-testid={`text-group-count-${tournament.id}`}>
                <Shield className="h-3.5 w-3.5" />
                {tournament.status === "registration"
                  ? `${groupCount} / ${tournament.minGroups} guilds needed`
                  : `${groupCount} ${groupCount === 1 ? "guild" : "guilds"}`}
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

            {isRegistered && userRegisteredGroup && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400" data-testid={`text-my-group-registered-${tournament.id}`}>
                <Shield className="h-3 w-3" />
                <strong>{userRegisteredGroup.name}</strong> is registered
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated && canRegister && (
              adminRegisteredGroup ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => withdrawMutation.mutate(adminRegisteredGroup.id)}
                  disabled={withdrawMutation.isPending}
                  data-testid={`button-withdraw-${tournament.id}`}
                >
                  {withdrawMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Withdraw"}
                </Button>
              ) : unregisteredAdminGroups.length > 0 ? (
                <Button
                  size="sm"
                  onClick={() => setRegisterOpen(true)}
                  data-testid={`button-register-${tournament.id}`}
                >
                  Enter the War
                </Button>
              ) : null
            )}
            <Link href={`/guild-wars/${tournament.id}`}>
              <Button size="sm" variant="ghost" data-testid={`link-gw-bracket-${tournament.id}`}>
                View Bracket <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {(detail?.registrations.length ?? 0) > 0 && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5" data-testid={`list-registered-groups-${tournament.id}`}>
            {(detail?.registrations ?? []).map((r) => (
              <Badge key={r.id} variant="secondary" className="text-xs gap-1">
                <Shield className="h-2.5 w-2.5" />
                {r.groupName ?? `Group ${r.groupId}`}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent data-testid={`dialog-register-${tournament.id}`}>
          <DialogHeader>
            <DialogTitle>Register a Guild</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Select one of your guilds to enter <strong>{tournament.name}</strong>.
              You must be an owner or admin of the guild.
            </p>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId} data-testid="select-group-register">
              <SelectTrigger data-testid="trigger-select-group">
                <SelectValue placeholder="Choose a guild…" />
              </SelectTrigger>
              <SelectContent>
                {unregisteredAdminGroups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)} data-testid={`option-group-${g.id}`}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)} data-testid="button-cancel-register">Cancel</Button>
            <Button
              onClick={() => selectedGroupId && registerMutation.mutate(parseInt(selectedGroupId))}
              disabled={!selectedGroupId || registerMutation.isPending}
              data-testid="button-confirm-register"
            >
              {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Register Guild
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function GuildWarsLobby() {
  const { user, isAuthenticated } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const { data: tournaments = [], isLoading } = useQuery<GuildWarsTournament[]>({
    queryKey: ["/api/guild-wars"],
  });

  const { data: champions = [], isLoading: championsLoading } = useQuery<ChampionEntry[]>({
    queryKey: ["/api/guild-wars/champions"],
  });

  const { data: groupsData } = useQuery<{ myGroups: Group[] }>({
    queryKey: ["/api/groups"],
    enabled: isAuthenticated,
  });

  const { data: adminGroups = [] } = useQuery<Group[]>({
    queryKey: ["/api/groups/my/admin"],
    queryFn: async () => {
      const res = await fetch("/api/groups/my/admin", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const allUserGroups = groupsData?.myGroups ?? [];

  const registrationOpen = tournaments.filter((t) => t.status === "registration");
  const inProgress = tournaments.filter((t) => t.status === "active");
  const past = tournaments.filter((t) => t.status === "completed" || t.status === "cancelled");

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-guild-wars-title">
              <Swords className="h-8 w-8 text-purple-500" />
              Guild Wars
            </h1>
            <p className="text-muted-foreground mt-1">Group bracket tournaments. Last guild standing wins.</p>
          </div>
          {!isAuthenticated && (
            <Button onClick={() => setAuthOpen(true)} data-testid="button-signin-guild-wars">
              Sign in to compete
            </Button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">

          <div className="flex-1 min-w-0 space-y-8">

            {!isAuthenticated && (
              <Card className="border-dashed">
                <CardContent className="py-6 text-center text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Sign in and register your guild to compete in tournaments.</p>
                  <Button className="mt-4" onClick={() => setAuthOpen(true)} data-testid="button-signin-prompt">
                    Sign In
                  </Button>
                </CardContent>
              </Card>
            )}

            {isAuthenticated && allUserGroups.length === 0 && (
              <Card className="border-dashed border-purple-300/40 bg-purple-50/20 dark:bg-purple-950/10">
                <CardContent className="py-6 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">You need to be in a guild to compete.</p>
                  <Link href="/groups">
                    <Button className="mt-4" variant="outline" data-testid="button-find-group">
                      Find or Create a Guild
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {isLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
              </div>
            )}

            {!isLoading && registrationOpen.length === 0 && inProgress.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No active tournaments right now. Check back soon.</p>
                </CardContent>
              </Card>
            )}

            {registrationOpen.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Star className="h-5 w-5 text-emerald-500" />
                  Registration Open
                </h2>
                <div className="space-y-3" data-testid="list-gw-registration-tournaments">
                  {registrationOpen.map((t) => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      isAuthenticated={isAuthenticated}
                      allUserGroups={allUserGroups}
                      adminGroups={adminGroups}
                    />
                  ))}
                </div>
              </section>
            )}

            {inProgress.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Swords className="h-5 w-5 text-orange-500" />
                  In Progress
                </h2>
                <div className="space-y-3" data-testid="list-gw-active-tournaments">
                  {inProgress.map((t) => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      isAuthenticated={isAuthenticated}
                      allUserGroups={allUserGroups}
                      adminGroups={adminGroups}
                    />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  Past Tournaments
                </h2>
                <div className="space-y-3" data-testid="list-gw-past-tournaments">
                  {past.map((t) => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      isAuthenticated={isAuthenticated}
                      allUserGroups={allUserGroups}
                      adminGroups={adminGroups}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="w-full md:w-72 shrink-0 md:sticky md:top-4">
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Crown className="h-5 w-5 text-purple-500" />
                Hall of Fame
              </h2>
              {championsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : champions.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Crown className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No champions yet. The glory awaits.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2" data-testid="list-gw-champions">
                  {champions.map((c, idx) => (
                    <Card key={c.id} className="hover:shadow-sm transition-shadow" data-testid={`card-gw-champion-${c.id}`}>
                      <CardContent className="py-2.5 px-3 flex items-center gap-2.5">
                        <span className="text-base font-bold text-muted-foreground w-6 text-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                          <Shield className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm truncate block" data-testid={`text-gw-champion-name-${c.id}`}>
                            {c.groupName ?? `Guild ${c.groupId}`}
                          </span>
                          <Link href={`/guild-wars/${c.tournamentId}`} data-testid={`link-gw-champion-tournament-${c.id}`}>
                            <p className="text-xs text-muted-foreground truncate hover:underline cursor-pointer">
                              {c.tournamentName}
                            </p>
                          </Link>
                          <p className="text-[10px] text-muted-foreground/70" data-testid={`text-gw-champion-date-${c.id}`}>
                            {new Date(c.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Crown className="h-3.5 w-3.5 text-purple-500 shrink-0" data-testid={`badge-gw-champion-${c.id}`} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </motion.div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
