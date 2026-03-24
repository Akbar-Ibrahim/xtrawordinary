import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Trophy, Play, Plus, Copy, Crown, Shield, UserX, Globe, Lock, Swords, X, ChevronDown, ChevronUp, Clock, Megaphone, Star, Edit2, Activity as ActivityIcon } from "lucide-react";
import type { Group, GroupMember, GroupRound, GroupRoundScore, GroupScoreReaction, GroupActivityEntry } from "@shared/schema";

const ALLOWED_EMOJIS = ["🔥", "❤️", "😂", "👏"];

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

function ReactionStrip({ groupId, roundId, scoreId, currentUserId }: { groupId: number; roundId: number; scoreId: number; currentUserId: number | undefined }) {
  const { data: allReactions } = useQuery<GroupScoreReaction[]>({
    queryKey: ["/api/groups", groupId, "rounds", roundId, "reactions"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/rounds/${roundId}/reactions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  const addMutation = useMutation({
    mutationFn: async (emoji: string) =>
      apiRequest("POST", `/api/groups/${groupId}/rounds/${roundId}/scores/${scoreId}/reactions`, { emoji }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds", roundId, "reactions"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (emoji: string) =>
      apiRequest("DELETE", `/api/groups/${groupId}/rounds/${roundId}/scores/${scoreId}/reactions/${encodeURIComponent(emoji)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds", roundId, "reactions"] }),
  });

  const scoreReactions = (allReactions || []).filter(r => r.scoreId === scoreId);

  function handleEmoji(emoji: string) {
    if (!currentUserId) return;
    const hasIt = scoreReactions.some(r => r.userId === currentUserId && r.emoji === emoji);
    if (hasIt) removeMutation.mutate(emoji);
    else addMutation.mutate(emoji);
  }

  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {ALLOWED_EMOJIS.map(emoji => {
        const count = scoreReactions.filter(r => r.emoji === emoji).length;
        const isMine = scoreReactions.some(r => r.userId === currentUserId && r.emoji === emoji);
        return (
          <button
            key={emoji}
            onClick={() => handleEmoji(emoji)}
            disabled={!currentUserId}
            className={`inline-flex items-center gap-0.5 text-sm px-1.5 py-0.5 rounded-full border transition-colors ${isMine ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted/70"} disabled:cursor-default`}
            title={emoji}
            data-testid={`reaction-${scoreId}-${emoji}`}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-xs font-medium">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function RoundScoresPanel({ groupId, roundId, currentUserId }: { groupId: number; roundId: number; currentUserId: number | undefined }) {
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
    <div className="space-y-2 pt-1">
      {data.map((entry, i) => (
        <div key={entry.id} className="px-3 py-2 rounded-lg bg-muted/40" data-testid={`round-score-${roundId}-${entry.userId}`}>
          <div className="flex items-center gap-3">
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
          <div className="pl-8">
            <ReactionStrip groupId={groupId} roundId={roundId} scoreId={entry.id} currentUserId={currentUserId} />
          </div>
        </div>
      ))}
    </div>
  );
}

const ACTIVITY_LABELS: Record<string, (m: Record<string, any>) => string> = {
  joined: (m) => `${m.name || "Someone"} joined the group`,
  left: (m) => `${m.name || "Someone"} left the group`,
  round_started: (m) => `${m.name || "An admin"} started a ${GAME_NAMES[m.gameSlug] || m.gameSlug || ""} round`,
  score_submitted: (m) => `${m.name || "Someone"} scored ${m.score?.toLocaleString() || "?"} in ${GAME_NAMES[m.gameSlug] || m.gameSlug || ""}`,
  reaction: (m) => `${m.name || "Someone"} reacted ${m.emoji || ""} to a score`,
};

function activityLabel(type: string, metadata: Record<string, any>): string {
  const fn = ACTIVITY_LABELS[type];
  return fn ? fn(metadata) : type;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ALL_TAGS = ["School", "Office", "Family", "Friends", "Gaming", "Book Club", "Other"];

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [createRoundOpen, setCreateRoundOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("random");
  const [closesAt, setClosesAt] = useState("");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expandedRoundId, setExpandedRoundId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPublic, setEditPublic] = useState(false);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editAnnouncement, setEditAnnouncement] = useState("");

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

  const { data: activity, isLoading: activityLoading } = useQuery<GroupActivityEntry[]>({
    queryKey: ["/api/groups", groupId, "activity"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/activity`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !isNaN(groupId),
  });

  const createRoundMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/groups/${groupId}/rounds`, {
        gameSlug: selectedSlug === "random" ? undefined : selectedSlug,
        closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
      }),
    onSuccess: async (res) => {
      const round: GroupRound = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activity"] });
      setCreateRoundOpen(false);
      setClosesAt("");
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

  const editMutation = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/groups/${groupId}`, {
        name: editName,
        description: editDesc,
        isPublic: editPublic,
        tags: editTags,
        pinnedAnnouncement: editAnnouncement,
      }),
    onSuccess: async (res) => {
      const updated = await res.json();
      queryClient.setQueryData(["/api/groups", groupId], (old: any) => old ? { ...old, group: updated } : old);
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setEditOpen(false);
      toast({ title: "Group updated!" });
    },
    onError: () => toast({ title: "Failed to update group", variant: "destructive" }),
  });

  function openEditDialog(group: Group) {
    setEditName(group.name);
    setEditDesc(group.description || "");
    setEditPublic(group.isPublic);
    setEditTags(group.tags || []);
    setEditAnnouncement(group.pinnedAnnouncement || "");
    setEditOpen(true);
  }

  function copyInviteCode() {
    if (!data?.group.inviteCode) return;
    navigator.clipboard.writeText(data.group.inviteCode);
    toast({ title: "Invite code copied!" });
  }

  function toggleEditTag(tag: string) {
    setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag].slice(0, 3));
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
        <Card className="mb-4">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">{group.name}</h1>
                    {group.isFeatured && <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" title="Featured group" />}
                  </div>
                  {group.description && <p className="text-muted-foreground text-sm mt-0.5">{group.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {group.isPublic ? <><Globe className="h-3 w-3 mr-1" />Public</> : <><Lock className="h-3 w-3 mr-1" />Private</>}
                    </Badge>
                    {membership && (
                      <Badge variant="secondary" className="text-xs capitalize">{membership.role}</Badge>
                    )}
                    {(group.tags || []).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs bg-muted/40">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(group)} data-testid="button-edit-group">
                    <Edit2 className="h-4 w-4 mr-1.5" />Edit
                  </Button>
                )}
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

        {group.pinnedAnnouncement && (
          <Card className="mb-4 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Megaphone className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{group.pinnedAnnouncement}</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="rounds">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="rounds" className="flex-1" data-testid="tab-rounds">Rounds</TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1" data-testid="tab-leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="members" className="flex-1" data-testid="tab-members">Members</TabsTrigger>
            <TabsTrigger value="activity" className="flex-1" data-testid="tab-activity">Activity</TabsTrigger>
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
                                <RoundScoresPanel groupId={groupId} roundId={round.id} currentUserId={user?.id} />
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
                      {isAdmin && member.userId !== user?.id && member.role !== "owner" && (
                        <div className="flex items-center gap-2">
                          {isOwner && (
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
                          {(isOwner || member.role === "member") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => removeMemberMutation.mutate(member.userId)}
                              data-testid={`button-remove-${member.userId}`}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity">
            {activityLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
            ) : !activity || activity.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ActivityIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No activity yet. Join a round to get started!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {activity.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/30 border border-border/40" data-testid={`activity-${entry.id}`}>
                    <Avatar className="h-8 w-8 shrink-0">
                      {entry.user?.avatarUrl && <AvatarImage src={entry.user.avatarUrl} />}
                      <AvatarFallback className="text-xs">{entry.user?.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm flex-1">{activityLabel(entry.type, entry.metadata)}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      <Dialog open={createRoundOpen} onOpenChange={(v) => { setCreateRoundOpen(v); if (!v) setClosesAt(""); }}>
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
            <div className="space-y-1">
              <label className="text-sm font-medium">Closing Time <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={e => setClosesAt(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                data-testid="input-closes-at"
              />
              <p className="text-xs text-muted-foreground">Leave blank to keep the round open indefinitely.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateRoundOpen(false); setClosesAt(""); }}>Cancel</Button>
            <Button onClick={() => createRoundMutation.mutate()} disabled={createRoundMutation.isPending} data-testid="button-create-round-submit">
              {createRoundMutation.isPending ? "Creating..." : "Start Round"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-name">Group Name</Label>
              <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} data-testid="input-edit-desc" />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="edit-public" checked={editPublic} onCheckedChange={setEditPublic} data-testid="switch-edit-public" />
              <Label htmlFor="edit-public" className="cursor-pointer">
                {editPublic ? <span className="flex items-center gap-1"><Globe className="h-4 w-4" />Public</span> : <span className="flex items-center gap-1"><Lock className="h-4 w-4" />Private</span>}
              </Label>
            </div>
            <div className="space-y-2">
              <Label>Tags <span className="text-muted-foreground font-normal text-xs">(up to 3)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleEditTag(tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${editTags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border hover:bg-muted/70"}`}
                    data-testid={`tag-${tag}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-announcement">Pinned Announcement <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Textarea
                id="edit-announcement"
                value={editAnnouncement}
                onChange={e => setEditAnnouncement(e.target.value)}
                placeholder="Share news, reminders, or rules with your group..."
                rows={3}
                data-testid="input-edit-announcement"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending || editName.trim().length < 2}
              data-testid="button-edit-group-submit"
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
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
