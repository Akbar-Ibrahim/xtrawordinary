import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Trophy, Play, Plus, Copy, Crown, Shield, UserX, Globe, Lock, Swords, X, ChevronDown, ChevronUp, Clock } from "lucide-react";
import type { Group, GroupMember, GroupRound, GroupRoundScore } from "@shared/schema";

const GAME_SLUGS = [
  "word-ladder", "anagram-solver", "word-scramble", "definition-match",
  "letter-pool", "word-maker", "word-length", "letter-position",
  "letter-hunt", "letter-balance", "letter-frequency", "no-repeats",
  "word-sweep", "word-roots",
];

const GAME_NAMES: Record<string, string> = {
  "word-ladder": "Word Ladder", "anagram-solver": "Anagram Solver",
  "word-scramble": "Word Scramble", "definition-match": "Definition Match",
  "letter-pool": "Letter Pool", "word-maker": "Word Maker",
  "word-length": "Length Challenge", "letter-position": "Position Master",
  "letter-hunt": "Letter Hunt", "letter-balance": "Letter Balance",
  "letter-frequency": "Letter Frequency", "no-repeats": "No Repeats",
  "word-sweep": "Word Sweep", "word-roots": "Word Roots",
};

interface GroupDetailResponse {
  group: Group;
  membership: GroupMember | null;
}

interface LeaderboardEntry {
  userId: number;
  name: string;
  avatarUrl: string | null;
  totalScore: number;
  roundsPlayed: number;
}

interface MemberWithUser extends GroupMember {
  user: { id: number; name: string; avatarUrl: string | null };
}

type RoundScoreEntry = GroupRoundScore & { user: { id: number; name: string; avatarUrl: string | null } };

function RoundScoresPanel({ groupId, roundId }: { groupId: number; roundId: number }) {
  const { data, isLoading } = useQuery<RoundScoreEntry[]>({
    queryKey: ["/api/groups", groupId, "rounds", roundId, "scores"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/rounds/${roundId}/scores`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load scores");
      return res.json();
    },
  });

  if (isLoading) return <div className="py-2 px-3"><Skeleton className="h-10 w-full" /></div>;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-3">No scores submitted for this round.</p>;
  }

  return (
    <div className="space-y-1 pt-1">
      {data.map((entry, i) => (
        <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40" data-testid={`round-score-${roundId}-${entry.userId}`}>
          <span className={`text-sm font-bold w-5 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
            {i + 1}
          </span>
          <Avatar className="h-7 w-7">
            <AvatarImage src={entry.user.avatarUrl || undefined} />
            <AvatarFallback className="text-xs">{entry.user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="flex-1 text-sm font-medium truncate">{entry.user.name}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {entry.durationMs != null
              ? `${Math.floor(entry.durationMs / 60000)}:${String(Math.floor((entry.durationMs % 60000) / 1000)).padStart(2, "0")}`
              : new Date(entry.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="font-bold text-sm">{entry.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [createRoundOpen, setCreateRoundOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("random");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expandedRoundId, setExpandedRoundId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<GroupDetailResponse>({
    queryKey: ["/api/groups", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load group");
      return res.json();
    },
    enabled: !isNaN(groupId),
  });

  const { data: rounds, isLoading: roundsLoading } = useQuery<GroupRound[]>({
    queryKey: ["/api/groups", groupId, "rounds"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/rounds`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load rounds");
      return res.json();
    },
    enabled: !isNaN(groupId),
  });

  const { data: leaderboard, isLoading: lbLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/groups", groupId, "leaderboard"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/leaderboard`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load leaderboard");
      return res.json();
    },
    enabled: !isNaN(groupId),
  });

  const { data: members, isLoading: membersLoading } = useQuery<MemberWithUser[]>({
    queryKey: ["/api/groups", groupId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load members");
      return res.json();
    },
    enabled: !isNaN(groupId),
  });

  const createRoundMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/groups/${groupId}/rounds`, {
        gameSlug: selectedSlug === "random" ? undefined : selectedSlug,
      }),
    onSuccess: async (res) => {
      const round: GroupRound = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds"] });
      setCreateRoundOpen(false);
      navigate(`/groups/${groupId}/rounds/${round.id}/play`);
    },
    onError: () => toast({ title: "Failed to create round", variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/groups/${groupId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      navigate("/groups");
    },
    onError: () => toast({ title: "Failed to leave group", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/groups/${groupId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      navigate("/groups");
    },
    onError: () => toast({ title: "Failed to delete group", variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => apiRequest("DELETE", `/api/groups/${groupId}/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] }),
    onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) =>
      apiRequest("PATCH", `/api/groups/${groupId}/members/${userId}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] }),
    onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
  });

  function copyInviteCode() {
    if (!data?.group.inviteCode) return;
    navigator.clipboard.writeText(data.group.inviteCode);
    toast({ title: "Invite code copied!" });
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link href="/groups">
          <Button variant="ghost" className="gap-2 mb-6"><ArrowLeft className="h-4 w-4" />Groups</Button>
        </Link>
        <p className="text-muted-foreground text-center py-12">Group not found or you don't have access.</p>
      </div>
    );
  }

  const { group, membership } = data;
  const isAdmin = membership?.role === "owner" || membership?.role === "admin";
  const isOwner = membership?.role === "owner";
  const activeRound = rounds?.find(r => r.status === "active");
  const pastRounds = rounds?.filter(r => r.status !== "active") || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link href="/groups">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back-groups">
          <ArrowLeft className="h-4 w-4" />
          Groups
        </Button>
      </Link>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{group.name}</h1>
                  {group.description && <p className="text-muted-foreground text-sm mt-0.5">{group.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {group.isPublic ? <><Globe className="h-3 w-3 mr-1" />Public</> : <><Lock className="h-3 w-3 mr-1" />Private</>}
                    </Badge>
                    {membership && (
                      <Badge variant="secondary" className="text-xs capitalize">{membership.role}</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {membership && !isOwner && (
                  <Button variant="outline" size="sm" onClick={() => setLeaveConfirmOpen(true)} data-testid="button-leave-group">
                    <X className="h-4 w-4 mr-1.5" />Leave
                  </Button>
                )}
                {isOwner && (
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setDeleteConfirmOpen(true)} data-testid="button-delete-group">
                    Delete
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={copyInviteCode} data-testid="button-copy-invite">
                  <Copy className="h-4 w-4 mr-1.5" />
                  {group.inviteCode}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="rounds">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="rounds" className="flex-1" data-testid="tab-rounds">Rounds</TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1" data-testid="tab-leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="members" className="flex-1" data-testid="tab-members">Members</TabsTrigger>
          </TabsList>

          <TabsContent value="rounds">
            <div className="space-y-4">
              {activeRound ? (
                <Card className="border-primary/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Swords className="h-4 w-4 text-primary" />
                        Active Round
                      </CardTitle>
                      <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Live</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium mb-3">{GAME_NAMES[activeRound.gameSlug] || activeRound.gameSlug}</p>
                    {activeRound.closesAt && (
                      <p className="text-sm text-muted-foreground mb-3">
                        Closes: {new Date(activeRound.closesAt).toLocaleDateString()}
                      </p>
                    )}
                    <Link href={`/groups/${groupId}/rounds/${activeRound.id}/play`}>
                      <Button className="w-full gap-2" data-testid="button-play-round">
                        <Play className="h-4 w-4" />
                        Play Round
                      </Button>
                    </Link>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={async () => {
                          await apiRequest("PATCH", `/api/groups/${groupId}/rounds/${activeRound.id}/close`);
                          queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds"] });
                        }}
                        data-testid="button-close-round"
                      >
                        Close Round
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : isAdmin ? (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground mb-4">No active round. Start one!</p>
                    <Button onClick={() => setCreateRoundOpen(true)} data-testid="button-start-round">
                      <Plus className="h-4 w-4 mr-2" />
                      Start New Round
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">No active round. Ask an admin to start one!</p>
                  </CardContent>
                </Card>
              )}

              {pastRounds.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Past Rounds</h3>
                  <div className="space-y-2">
                    {pastRounds.map(round => {
                      const isExpanded = expandedRoundId === round.id;
                      return (
                        <Collapsible
                          key={round.id}
                          open={isExpanded}
                          onOpenChange={() => setExpandedRoundId(isExpanded ? null : round.id)}
                        >
                          <Card data-testid={`card-round-${round.id}`}>
                            <CollapsibleTrigger asChild>
                              <CardContent className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-xl">
                                <div>
                                  <p className="font-medium">{GAME_NAMES[round.gameSlug] || round.gameSlug}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(round.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">Closed</Badge>
                                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </div>
                              </CardContent>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-4 pb-4 border-t pt-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Round Results</p>
                                <RoundScoresPanel groupId={groupId} roundId={round.id} />
                              </div>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="leaderboard">
            {lbLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
            ) : !leaderboard || leaderboard.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No scores yet. Play a round to get on the board!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <Card key={entry.userId} data-testid={`card-lb-${entry.userId}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <span className={`text-xl font-bold w-8 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={entry.avatarUrl || undefined} />
                        <AvatarFallback>{entry.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">{entry.roundsPlayed} round{entry.roundsPlayed !== 1 ? "s" : ""} played</p>
                      </div>
                      <p className="font-bold text-lg">{entry.totalScore.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members">
            {membersLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
            ) : (
              <div className="space-y-2">
                {members?.map(member => (
                  <Card key={member.id} data-testid={`card-member-${member.userId}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.user.avatarUrl || undefined} />
                        <AvatarFallback>{member.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{member.user.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {member.role === "owner" && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                          {member.role === "admin" && <Shield className="h-3.5 w-3.5 text-blue-500" />}
                          <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                        </div>
                      </div>
                      {isOwner && member.userId !== user?.id && (
                        <div className="flex items-center gap-2">
                          {member.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => changeRoleMutation.mutate({ userId: member.userId, role: member.role === "admin" ? "member" : "admin" })}
                              data-testid={`button-role-${member.userId}`}
                            >
                              {member.role === "admin" ? "Demote" : "Make Admin"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeMemberMutation.mutate(member.userId)}
                            data-testid={`button-remove-${member.userId}`}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      <Dialog open={createRoundOpen} onOpenChange={setCreateRoundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Round</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Game</label>
              <Select value={selectedSlug} onValueChange={setSelectedSlug}>
                <SelectTrigger data-testid="select-game-slug">
                  <SelectValue placeholder="Pick a game" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Random Game</SelectItem>
                  {GAME_SLUGS.map(slug => (
                    <SelectItem key={slug} value={slug}>{GAME_NAMES[slug] || slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateRoundOpen(false)}>Cancel</Button>
            <Button onClick={() => createRoundMutation.mutate()} disabled={createRoundMutation.isPending} data-testid="button-create-round-submit">
              {createRoundMutation.isPending ? "Creating..." : "Start Round"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Leave Group?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Are you sure you want to leave <strong>{group.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} data-testid="button-confirm-leave">
              Leave Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Group?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">This will permanently delete <strong>{group.name}</strong> and all its rounds and scores. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
