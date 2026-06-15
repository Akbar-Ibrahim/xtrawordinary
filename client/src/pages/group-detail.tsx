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
import { UserAvatar } from "@/components/user-avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Trophy, Play, Plus, Copy, Crown, Shield, UserX, Globe, Lock, Swords, X, ChevronDown, ChevronUp, Clock, Megaphone, Star, Edit2, Activity as ActivityIcon, Search, Zap } from "lucide-react";
import type { Group, GroupMember, GroupRound, GroupRoundScore, GroupScoreReaction, GroupActivityEntry, HuddleChallenge } from "@shared/schema";

const ALLOWED_EMOJIS = ["🔥", "❤️", "😂", "👏"];

const DUEL_TURN_SLUGS = new Set([
  "word-chain", "letter-hunt", "word-length", "letter-frequency",
  "letter-position", "letter-balance",
]);
const DUEL_RACE_SLUGS = new Set([
  "letter-hunt", "word-length", "letter-frequency", "letter-position", "letter-balance",
  "word-scramble", "no-repeats", "anagram-solver", "word-stack",
  "letter-pool", "word-maker", "word-split", "definition-match",
]);
const DUEL_GAME_SLUGS_LIST = Array.from(new Set([...Array.from(DUEL_TURN_SLUGS), ...Array.from(DUEL_RACE_SLUGS)]));
const DUEL_GAME_NAMES: Record<string, string> = {
  "word-chain": "Word Chain", "letter-hunt": "Letter Hunt", "word-length": "Length Challenge",
  "letter-frequency": "Letter Frequency", "letter-position": "Position Master",
  "letter-balance": "Letter Balance", "word-scramble": "Word Scramble",
  "no-repeats": "No Repeats", "anagram-solver": "Anagram Solver",
  "word-stack": "Word Stack", "letter-pool": "Letter Pool", "word-maker": "Word Maker",
  "word-split": "Word Split", "definition-match": "Definition Match",
};

const TEAM_RACE_GAME_SLUGS_LIST = [
  "no-repeats", "anagram-solver", "word-maker", "definition-match",
  "letter-hunt", "letter-frequency", "word-length", "letter-dodge", "word-roots",
];
const TEAM_RACE_GAME_NAMES: Record<string, string> = {
  "no-repeats": "No Repeats", "anagram-solver": "Anagram Solver", "word-maker": "Word Maker",
  "definition-match": "Definition Match", "letter-hunt": "Letter Hunt",
  "letter-frequency": "Letter Frequency", "word-length": "Length Challenge",
  "letter-dodge": "Letter Dodge", "word-roots": "Word Roots",
};

interface EnrichedHuddleChallenge extends HuddleChallenge {
  challengerGroupName: string;
  challengeeGroupName: string;
  challengerAdminName: string;
  challengeeAdminName: string | null;
}

interface EnrichedTeamRaceChallenge {
  id: number;
  challengerGroupId: number;
  challengeeGroupId: number;
  challengerAdminId: number;
  challengeeAdminId: number | null;
  challengerGroupName: string;
  challengeeGroupName: string;
  gameSlug: string;
  raceTarget: number;
  raceTimeLimit: number;
  status: string;
  roomCode: string | null;
  winnerGroupId: number | null;
  createdAt: string;
  expiresAt: string | null;
}

const GAME_SLUGS = [
  "word-ladder", "anagram-solver", "word-scramble", "definition-match",
  "letter-pool", "word-maker", "word-length", "letter-position",
  "letter-hunt", "letter-dodge", "letter-balance", "letter-frequency", "no-repeats",
  "word-sweep", "word-roots", "shell-words", "deep-shell-words",
];

const GAME_NAMES: Record<string, string> = {
  "word-ladder": "Word Ladder", "anagram-solver": "Anagram Solver",
  "word-scramble": "Word Scramble", "definition-match": "Definition Match",
  "letter-pool": "Letter Pool", "word-maker": "Word Maker",
  "word-length": "Length Challenge", "letter-position": "Position Master",
  "letter-hunt": "Letter Hunt", "letter-dodge": "Letter Dodge",
  "letter-balance": "Letter Balance",
  "letter-frequency": "Letter Frequency", "no-repeats": "No Repeats",
  "word-sweep": "Word Sweep", "word-roots": "Word Roots",
  "shell-words": "Shell Words", "deep-shell-words": "Deep Shell Words",
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

function GuildWarsGroupTab({ groupId }: { groupId: number }) {
  const { data: entries = [], isLoading } = useQuery<Array<{
    registration: { id: number; tournamentId: number; groupId: number; createdAt: string };
    tournament: { id: number; name: string; status: string; registrationDeadline: string; roundDeadlineHours: number };
  }>>({
    queryKey: ["/api/groups", groupId, "guild-wars"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/guild-wars`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const statusColor = (s: string) => ({
    registration: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    active: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    completed: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    cancelled: "",
  }[s] ?? "");

  const statusLabel = (s: string) => ({
    registration: "Registration Open",
    active: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  }[s] ?? s);

  return (
    <TabsContent value="guild-wars">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5" />
            Guild Wars Tournaments
          </h3>
          <Link href="/guild-wars">
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7" data-testid="button-browse-gw">
              Browse Tournaments
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        ) : entries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">This guild hasn't entered any Guild Wars tournaments yet.</p>
              <Link href="/guild-wars">
                <Button className="mt-4" variant="outline" size="sm" data-testid="button-join-gw">
                  Find a Tournament
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="list-group-gw-tournaments">
            {entries.map(({ registration, tournament }) => (
              <Card key={registration.id} className="hover:shadow-sm transition-shadow" data-testid={`card-group-gw-${tournament.id}`}>
                <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
                      <Swords className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" data-testid={`text-group-gw-name-${tournament.id}`}>
                        {tournament.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Registered {new Date(registration.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs ${statusColor(tournament.status)}`} data-testid={`badge-group-gw-status-${tournament.id}`}>
                      {statusLabel(tournament.status)}
                    </Badge>
                    <Link href={`/guild-wars/${tournament.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" data-testid={`link-group-gw-bracket-${tournament.id}`}>
                        Bracket
                        <Shield className="h-3 w-3 ml-0.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TabsContent>
  );
}

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
            <Link href={`/profile/${entry.userId}`}>
              <UserAvatar name={entry.user.name} avatarUrl={entry.user.avatarUrl} className="h-7 w-7 cursor-pointer" />
            </Link>
            <Link href={`/profile/${entry.userId}`} className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate hover:underline cursor-pointer">{entry.user.name}</span>
            </Link>
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
  round_closed: (m) => `${m.name || "An admin"} closed a ${GAME_NAMES[m.gameSlug] || m.gameSlug || ""} round`,
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

function getLfLettersSummary(round: GroupRound): string | null {
  if (round.gameSlug !== "letter-frequency" || !round.gameConfig) return null;
  try {
    const cfg = JSON.parse(round.gameConfig);
    const letters: string[] = cfg.initialLetters ?? cfg.letters ?? [];
    if (!Array.isArray(letters) || letters.length === 0) return null;
    const pinned = letters.filter((l: string) => l !== "any");
    if (pinned.length === 0) return null;
    const anyCount = letters.filter((l: string) => l === "any").length;
    const base = pinned.join(", ");
    return anyCount > 0 ? `${base} + ${anyCount} random` : base;
  } catch {
    return null;
  }
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
  const [roundLetterCount, setRoundLetterCount] = useState<2 | 3 | 4>(2);
  const [roundLetters, setRoundLetters] = useState<string[]>(["any", "any"]);
  const [roundFreqEnabled, setRoundFreqEnabled] = useState(false);
  const [roundLbMode, setRoundLbMode] = useState<"random" | "locked">("random");
  const [roundLbLevel, setRoundLbLevel] = useState<number | undefined>(undefined);
  const [roundLbConsonantCount, setRoundLbConsonantCount] = useState<number | undefined>(undefined);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expandedRoundId, setExpandedRoundId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPublic, setEditPublic] = useState(false);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editAnnouncement, setEditAnnouncement] = useState("");

  const [huddleOpen, setHuddleOpen] = useState(false);
  const [huddleGroupSearch, setHuddleGroupSearch] = useState("");
  const [huddleTargetGroupId, setHuddleTargetGroupId] = useState<number | null>(null);
  const [huddleGameSlug, setHuddleGameSlug] = useState(DUEL_GAME_SLUGS_LIST[0]);
  const [huddleFormat, setHuddleFormat] = useState<"turn" | "race">("turn");
  const [huddleRaceTarget, setHuddleRaceTarget] = useState(15);
  const [huddleRaceTimeLimit, setHuddleRaceTimeLimit] = useState(300);

  // Team Race dialog state
  const [trOpen, setTrOpen] = useState(false);
  const [trGroupSearch, setTrGroupSearch] = useState("");
  const [trTargetGroupId, setTrTargetGroupId] = useState<number | null>(null);
  const [trGameSlug, setTrGameSlug] = useState(TEAM_RACE_GAME_SLUGS_LIST[0]);
  const [trRaceTarget, setTrRaceTarget] = useState(20);
  const [trRaceTimeLimit, setTrRaceTimeLimit] = useState(300);

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

  const { data: guildWarsStats } = useQuery<{
    tournamentsEntered: number;
    matchWins: number;
    matchLosses: number;
    championshipsWon: number;
    activeTournament: { id: number; name: string } | null;
    recentChampionships: { tournamentId: number; tournamentName: string }[];
  }>({
    queryKey: ["/api/groups", groupId, "guild-wars-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/guild-wars-stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load guild wars stats");
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

  const { data: huddles, isLoading: huddlesLoading } = useQuery<EnrichedHuddleChallenge[]>({
    queryKey: ["/api/groups", groupId, "huddles"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/huddles`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isNaN(groupId),
    refetchInterval: 10000,
  });

  const { data: teamRaces } = useQuery<EnrichedTeamRaceChallenge[]>({
    queryKey: ["/api/groups", groupId, "team-races"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/team-races`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isNaN(groupId),
    refetchInterval: 10000,
  });

  const { data: publicGroups } = useQuery<Group[]>({
    queryKey: ["/api/groups/browse"],
    queryFn: async () => {
      const res = await fetch("/api/groups/browse", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: huddleOpen || trOpen,
    staleTime: 60000,
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
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        gameSlug: selectedSlug === "random" ? undefined : selectedSlug,
        closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
      };
      if (selectedSlug === "letter-frequency" && roundFreqEnabled) {
        body.gameConfig = { initialLetters: roundLetters };
      }
      if (selectedSlug === "letter-balance" && roundLbMode === "locked" && roundLbLevel !== undefined && roundLbConsonantCount !== undefined) {
        body.gameConfig = { category: "locked_balance", level: roundLbLevel, consonantCount: roundLbConsonantCount };
      }
      return apiRequest("POST", `/api/groups/${groupId}/rounds`, body);
    },
    onSuccess: async (res) => {
      const round: GroupRound = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "activity"] });
      setCreateRoundOpen(false);
      setClosesAt("");
      setRoundLetterCount(2);
      setRoundLetters(["any", "any"]);
      setRoundFreqEnabled(false);
      setRoundLbMode("random");
      setRoundLbLevel(undefined);
      setRoundLbConsonantCount(undefined);
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

  const createHuddleMutation = useMutation({
    mutationFn: async () => {
      if (!huddleTargetGroupId) throw new Error("Pick a group first");
      return apiRequest("POST", "/api/huddles", {
        challengerGroupId: groupId,
        challengeeGroupId: huddleTargetGroupId,
        gameSlug: huddleGameSlug,
        format: huddleFormat,
        raceTarget: huddleRaceTarget,
        raceTimeLimit: huddleRaceTimeLimit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "huddles"] });
      setHuddleOpen(false);
      setHuddleTargetGroupId(null);
      setHuddleGroupSearch("");
      toast({ title: "Huddle challenge sent!" });
    },
    onError: async (err: any) => {
      let msg = "Failed to send challenge";
      try { const body = await err.response?.json(); if (body?.error) msg = body.error; } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  const acceptHuddleMutation = useMutation({
    mutationFn: async (huddleId: number) => apiRequest("PATCH", `/api/huddles/${huddleId}/accept`),
    onSuccess: async (res) => {
      const body = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "huddles"] });
      toast({ title: "Challenge accepted! Heading to the arena..." });
      if (body.roomCode) navigate(`/duel/${body.roomCode}`);
    },
    onError: () => toast({ title: "Failed to accept challenge", variant: "destructive" }),
  });

  const declineHuddleMutation = useMutation({
    mutationFn: async (huddleId: number) => apiRequest("PATCH", `/api/huddles/${huddleId}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "huddles"] });
      toast({ title: "Challenge declined" });
    },
    onError: () => toast({ title: "Failed to decline challenge", variant: "destructive" }),
  });

  const cancelHuddleMutation = useMutation({
    mutationFn: async (huddleId: number) => apiRequest("PATCH", `/api/huddles/${huddleId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "huddles"] });
      toast({ title: "Challenge cancelled" });
    },
    onError: () => toast({ title: "Failed to cancel challenge", variant: "destructive" }),
  });

  // Team Race mutations
  const createTeamRaceMutation = useMutation({
    mutationFn: async () => {
      if (!trTargetGroupId) throw new Error("Pick a group first");
      return apiRequest("POST", "/api/team-races", {
        challengerGroupId: groupId,
        challengeeGroupId: trTargetGroupId,
        gameSlug: trGameSlug,
        raceTarget: trRaceTarget,
        raceTimeLimit: trRaceTimeLimit,
      });
    },
    onSuccess: async (res) => {
      const body = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "team-races"] });
      setTrOpen(false);
      setTrTargetGroupId(null);
      setTrGroupSearch("");
      toast({ title: "Team Race challenge sent!" });
      if (body.roomCode) navigate(`/team-race/${body.roomCode}`);
    },
    onError: async (err: any) => {
      let msg = "Failed to send Team Race challenge";
      try { const body = await err.response?.json(); if (body?.error) msg = body.error; } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  const acceptTRMutation = useMutation({
    mutationFn: async (trId: number) => apiRequest("PATCH", `/api/team-races/${trId}/accept`),
    onSuccess: async (res) => {
      const body = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "team-races"] });
      toast({ title: "Team Race accepted! Heading to the room..." });
      if (body.roomCode) navigate(`/team-race/${body.roomCode}`);
    },
    onError: () => toast({ title: "Failed to accept Team Race", variant: "destructive" }),
  });

  const declineTRMutation = useMutation({
    mutationFn: async (trId: number) => apiRequest("PATCH", `/api/team-races/${trId}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "team-races"] });
      toast({ title: "Team Race declined" });
    },
    onError: () => toast({ title: "Failed to decline Team Race", variant: "destructive" }),
  });

  const cancelTRMutation = useMutation({
    mutationFn: async (trId: number) => apiRequest("PATCH", `/api/team-races/${trId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "team-races"] });
      toast({ title: "Team Race cancelled" });
    },
    onError: () => toast({ title: "Failed to cancel Team Race", variant: "destructive" }),
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
    const url = `${window.location.origin}/groups?code=${data.group.inviteCode}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Invite link copied!" });
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
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setHuddleOpen(true)} data-testid="button-huddle-challenge">
                    <Zap className="h-4 w-4 mr-1.5" />Battle
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setTrOpen(true)} data-testid="button-team-race-challenge">
                    <Users className="h-4 w-4 mr-1.5" />Team Race
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
          <TabsList className="w-full mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="rounds" className="flex-1" data-testid="tab-rounds">Rounds</TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1" data-testid="tab-leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="members" className="flex-1" data-testid="tab-members">Members</TabsTrigger>
            <TabsTrigger value="activity" className="flex-1" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="guild-wars" className="flex-1" data-testid="tab-guild-wars">Guild Wars</TabsTrigger>
          </TabsList>

          <TabsContent value="rounds">
            <div className="space-y-4">
              {/* Huddle Battles Section */}
              {(() => {
                const pendingIncoming = (huddles || []).filter(h => h.status === "pending" && h.challengeeGroupId === groupId);
                const pendingOutgoing = (huddles || []).filter(h => h.status === "pending" && h.challengerGroupId === groupId);
                const pastBattles = (huddles || []).filter(h => h.status !== "pending");
                if (!isAdmin && pendingIncoming.length === 0 && pendingOutgoing.length === 0 && pastBattles.length === 0) return null;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" />Group Battles
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {pendingIncoming.map(h => (
                        <Card key={h.id} className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20" data-testid={`card-huddle-incoming-${h.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <p className="font-semibold text-sm flex items-center gap-1.5">
                                  <Swords className="h-4 w-4 text-amber-600" />
                                  Challenge from <span className="text-foreground">{h.challengerGroupName}</span>
                                </p>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {DUEL_GAME_NAMES[h.gameSlug] || h.gameSlug} · {h.format === "race" ? "Race" : "Turn-Based"}
                                  {h.format === "race" && ` · ${h.raceTarget} words`}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">Typist will be: <strong>{user?.name}</strong></p>
                              </div>
                              {isAdmin && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => acceptHuddleMutation.mutate(h.id)}
                                    disabled={acceptHuddleMutation.isPending}
                                    data-testid={`button-huddle-accept-${h.id}`}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => declineHuddleMutation.mutate(h.id)}
                                    disabled={declineHuddleMutation.isPending}
                                    data-testid={`button-huddle-decline-${h.id}`}
                                  >
                                    Decline
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {pendingOutgoing.map(h => (
                        <Card key={h.id} className="border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/10" data-testid={`card-huddle-outgoing-${h.id}`}>
                          <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="font-semibold text-sm flex items-center gap-1.5">
                                <Swords className="h-4 w-4 text-blue-500" />
                                Battle sent to <span className="text-foreground">{h.challengeeGroupName}</span>
                              </p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {DUEL_GAME_NAMES[h.gameSlug] || h.gameSlug} · {h.format === "race" ? "Race" : "Turn-Based"}
                              </p>
                              <Badge variant="outline" className="mt-1 text-xs">Awaiting response</Badge>
                            </div>
                            {isAdmin && (
                              <div className="flex gap-2 items-start">
                                {h.roomCode && (
                                  <Link href={`/duel/${h.roomCode}`}>
                                    <Button size="sm" variant="outline" data-testid={`button-huddle-enter-${h.id}`}>
                                      Enter Room
                                    </Button>
                                  </Link>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground"
                                  onClick={() => cancelHuddleMutation.mutate(h.id)}
                                  disabled={cancelHuddleMutation.isPending}
                                  data-testid={`button-huddle-cancel-${h.id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      {pastBattles.slice(0, 5).map(h => {
                        const isChallengerGroup = h.challengerGroupId === groupId;
                        const opponent = isChallengerGroup ? h.challengeeGroupName : h.challengerGroupName;
                        return (
                          <Card key={h.id} className="opacity-80" data-testid={`card-huddle-past-${h.id}`}>
                            <CardContent className="p-3 flex items-center gap-3">
                              <Swords className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">vs {opponent}</p>
                                <p className="text-xs text-muted-foreground">{DUEL_GAME_NAMES[h.gameSlug] || h.gameSlug}</p>
                              </div>
                              <Badge variant="outline" className="text-xs capitalize shrink-0">{h.status}</Badge>
                              {h.roomCode && h.status === "completed" && (
                                <Link href={`/duel/${h.roomCode}`}>
                                  <Button size="sm" variant="ghost" className="text-xs h-7">View</Button>
                                </Link>
                              )}
                              {h.status === "accepted" && h.roomCode && (
                                <Link href={`/duel/${h.roomCode}`}>
                                  <Button size="sm" className="text-xs h-7">Join</Button>
                                </Link>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Team Race Section */}
              {(() => {
                const trList = teamRaces || [];
                const pendingTRIncoming = trList.filter(tr => tr.status === "pending" && tr.challengeeGroupId === groupId);
                const pendingTROutgoing = trList.filter(tr => tr.status === "pending" && tr.challengerGroupId === groupId);
                const pastTRs = trList.filter(tr => tr.status !== "pending");
                if (!isAdmin && pendingTRIncoming.length === 0 && pendingTROutgoing.length === 0 && pastTRs.length === 0) return null;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />Team Races
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {pendingTRIncoming.map(tr => (
                        <Card key={tr.id} className="border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10" data-testid={`card-tr-incoming-${tr.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <p className="font-semibold text-sm flex items-center gap-1.5">
                                  <Users className="h-4 w-4 text-emerald-600" />
                                  Team Race from <span className="text-foreground">{tr.challengerGroupName}</span>
                                </p>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {TEAM_RACE_GAME_NAMES[tr.gameSlug] || tr.gameSlug} · First to {tr.raceTarget} words · {Math.floor(tr.raceTimeLimit / 60)} min
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">All members of your group can join and contribute!</p>
                              </div>
                              {isAdmin && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => acceptTRMutation.mutate(tr.id)}
                                    disabled={acceptTRMutation.isPending}
                                    data-testid={`button-tr-accept-${tr.id}`}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => declineTRMutation.mutate(tr.id)}
                                    disabled={declineTRMutation.isPending}
                                    data-testid={`button-tr-decline-${tr.id}`}
                                  >
                                    Decline
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {pendingTROutgoing.map(tr => (
                        <Card key={tr.id} className="border-violet-500/30 bg-violet-50/10 dark:bg-violet-950/10" data-testid={`card-tr-outgoing-${tr.id}`}>
                          <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="font-semibold text-sm flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-violet-500" />
                                Team Race sent to <span className="text-foreground">{tr.challengeeGroupName}</span>
                              </p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {TEAM_RACE_GAME_NAMES[tr.gameSlug] || tr.gameSlug} · First to {tr.raceTarget} words
                              </p>
                              <Badge variant="outline" className="mt-1 text-xs">Awaiting response</Badge>
                            </div>
                            {isAdmin && (
                              <div className="flex gap-2 items-start">
                                {tr.roomCode && (
                                  <Link href={`/team-race/${tr.roomCode}`}>
                                    <Button size="sm" variant="outline" data-testid={`button-tr-enter-${tr.id}`}>
                                      Enter Room
                                    </Button>
                                  </Link>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground"
                                  onClick={() => cancelTRMutation.mutate(tr.id)}
                                  disabled={cancelTRMutation.isPending}
                                  data-testid={`button-tr-cancel-${tr.id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      {pastTRs.slice(0, 5).map(tr => {
                        const isChallengerGroup = tr.challengerGroupId === groupId;
                        const opponent = isChallengerGroup ? tr.challengeeGroupName : tr.challengerGroupName;
                        const weWon = tr.winnerGroupId === groupId;
                        return (
                          <Card key={tr.id} className="opacity-80" data-testid={`card-tr-past-${tr.id}`}>
                            <CardContent className="p-3 flex items-center gap-3">
                              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">vs {opponent}</p>
                                <p className="text-xs text-muted-foreground">{TEAM_RACE_GAME_NAMES[tr.gameSlug] || tr.gameSlug} · Team Race</p>
                              </div>
                              <Badge variant="outline" className={`text-xs shrink-0 ${tr.status === "completed" && weWon ? "border-emerald-500/50 text-emerald-600" : ""}`}>
                                {tr.status === "completed" ? (tr.winnerGroupId ? (weWon ? "Won" : "Lost") : "Tie") : tr.status}
                              </Badge>
                              {tr.roomCode && (tr.status === "accepted" || tr.status === "completed") && (
                                <Link href={`/team-race/${tr.roomCode}`}>
                                  <Button size="sm" variant="ghost" className="text-xs h-7">
                                    {tr.status === "accepted" ? "Join" : "View"}
                                  </Button>
                                </Link>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

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
                    <p className="font-medium">{GAME_NAMES[activeRound.gameSlug] || activeRound.gameSlug}</p>
                    {(() => { const s = getLfLettersSummary(activeRound); return s ? <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-round-letters-active">Letters: {s}</p> : null; })()}
                    <div className="mb-3" />
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
                                  {(() => { const s = getLfLettersSummary(round); return s ? <p className="text-xs text-primary/70" data-testid={`text-round-letters-${round.id}`}>Letters: {s}</p> : null; })()}
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(round.createdAt).toLocaleDateString()}
                                    {round.closesAt && <> · Closed {new Date(round.closesAt).toLocaleDateString()}</>}
                                  </p>
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
                      <Link href={`/profile/${entry.userId}`}>
                        <UserAvatar name={entry.name} avatarUrl={entry.avatarUrl} className="h-9 w-9 cursor-pointer" />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${entry.userId}`}>
                          <p className="font-semibold truncate hover:underline cursor-pointer">{entry.name}</p>
                        </Link>
                        <p className="text-xs text-muted-foreground">{entry.roundsPlayed} round{entry.roundsPlayed !== 1 ? "s" : ""} played</p>
                      </div>
                      <p className="font-bold text-lg">{entry.totalScore.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* ── Guild Wars Stats ──────────────────────────────────────── */}
            {guildWarsStats && (guildWarsStats.tournamentsEntered > 0 || guildWarsStats.championshipsWon > 0) && (
              <Card className="mt-4 border-purple-300/40 dark:border-purple-700/40" data-testid="card-guild-wars-stats">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <Swords className="h-4 w-4" />
                    Guild Wars Record
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="space-y-0.5">
                      <p className="text-xl font-bold">{guildWarsStats.tournamentsEntered}</p>
                      <p className="text-xs text-muted-foreground">Entered</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{guildWarsStats.matchWins}</p>
                      <p className="text-xs text-muted-foreground">Wins</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xl font-bold text-red-500">{guildWarsStats.matchLosses}</p>
                      <p className="text-xs text-muted-foreground">Losses</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xl font-bold text-amber-500">{guildWarsStats.championshipsWon}</p>
                      <p className="text-xs text-muted-foreground">🏆 Titles</p>
                    </div>
                  </div>
                  {guildWarsStats.activeTournament && (
                    <div className="flex items-center gap-2 pt-1 border-t border-purple-200/40 dark:border-purple-700/30">
                      <span className="text-xs text-muted-foreground">Active:</span>
                      <Link href={`/guild-wars/${guildWarsStats.activeTournament.id}`}>
                        <Badge variant="outline" className="text-xs border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/30" data-testid="badge-active-guild-war">
                          {guildWarsStats.activeTournament.name}
                        </Badge>
                      </Link>
                    </div>
                  )}
                  {guildWarsStats.recentChampionships.length > 0 && (
                    <div className="pt-1 border-t border-purple-200/40 dark:border-purple-700/30">
                      <p className="text-xs text-muted-foreground mb-1.5">Recent titles:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {guildWarsStats.recentChampionships.map((c) => (
                          <Link key={c.tournamentId} href={`/guild-wars/${c.tournamentId}`}>
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 cursor-pointer hover:opacity-80" data-testid={`badge-guild-war-title-${c.tournamentId}`}>
                              🏆 {c.tournamentName}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
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
                      <Link href={`/profile/${member.userId}`}>
                        <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl} className="h-9 w-9 cursor-pointer" />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${member.userId}`}>
                          <p className="font-semibold truncate hover:underline cursor-pointer">{member.user.name}</p>
                        </Link>
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
                    {entry.user?.id ? (
                      <Link href={`/profile/${entry.user.id}`}>
                        <UserAvatar name={entry.user?.name ?? "?"} avatarUrl={entry.user?.avatarUrl} className="h-8 w-8 cursor-pointer" />
                      </Link>
                    ) : (
                      <UserAvatar name={entry.user?.name ?? "?"} avatarUrl={entry.user?.avatarUrl} className="h-8 w-8" />
                    )}
                    <p className="text-sm flex-1">{activityLabel(entry.type, entry.metadata)}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <GuildWarsGroupTab groupId={groupId} />
        </Tabs>
      </motion.div>

      <Dialog open={createRoundOpen} onOpenChange={(v) => {
        setCreateRoundOpen(v);
        if (!v) {
          setClosesAt("");
          setRoundLetterCount(2);
          setRoundLetters(["any", "any"]);
          setRoundFreqEnabled(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Round</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Game</label>
              <Select value={selectedSlug} onValueChange={(v) => {
                setSelectedSlug(v);
                setRoundLetterCount(2);
                setRoundLetters(["any", "any"]);
              }}>
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
            {selectedSlug === "letter-balance" && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <label className="text-sm font-medium">Challenge type</label>
                <div className="flex gap-2">
                  <Button type="button" size="sm"
                    variant={roundLbMode === "random" ? "default" : "outline"}
                    onClick={() => { setRoundLbMode("random"); setRoundLbLevel(undefined); setRoundLbConsonantCount(undefined); }}
                    data-testid="button-round-lb-random"
                  >
                    Random
                  </Button>
                  <Button type="button" size="sm"
                    variant={roundLbMode === "locked" ? "default" : "outline"}
                    onClick={() => setRoundLbMode("locked")}
                    data-testid="button-round-lb-locked"
                  >
                    Locked Balance
                  </Button>
                </div>
                {roundLbMode === "locked" && (
                  <>
                    <div>
                      <label className="text-xs font-medium">Word length</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[4,5,6,7,8,9,10].map(lv => (
                          <Button key={lv} type="button" size="sm"
                            variant={roundLbLevel === lv ? "default" : "outline"}
                            onClick={() => { setRoundLbLevel(lv); setRoundLbConsonantCount(undefined); }}
                            data-testid={`button-round-lb-level-${lv}`}
                          >
                            {lv}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {roundLbLevel !== undefined && (
                      <div>
                        <label className="text-xs font-medium">Consonant count <span className="text-muted-foreground font-normal">(vowels = {roundLbLevel} − count)</span></label>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {Array.from({ length: roundLbLevel - 1 }, (_, i) => i + 1).map(c => {
                            const v = roundLbLevel - c;
                            return (
                              <Button key={c} type="button" size="sm"
                                variant={roundLbConsonantCount === c ? "default" : "outline"}
                                onClick={() => setRoundLbConsonantCount(c)}
                                data-testid={`button-round-lb-consonant-${c}`}
                                title={`${c}C / ${v}V`}
                              >
                                {c}C/{v}V
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {(!roundLbLevel || !roundLbConsonantCount) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {!roundLbLevel ? "Pick a word length." : "Pick a consonant count."}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            {selectedSlug === "letter-frequency" && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Multi-Letter Mode <span className="text-muted-foreground font-normal">(pin letters)</span></label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={roundFreqEnabled}
                    onClick={() => setRoundFreqEnabled(v => !v)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${roundFreqEnabled ? "bg-primary" : "bg-input"}`}
                    data-testid="toggle-round-freq-enabled"
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${roundFreqEnabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>
                {roundFreqEnabled && (
                  <>
                    <div className="flex gap-1">
                      {([2, 3, 4] as const).map(n => (
                        <Button
                          key={n}
                          type="button"
                          size="sm"
                          variant={roundLetterCount === n ? "default" : "outline"}
                          onClick={() => {
                            setRoundLetterCount(n);
                            setRoundLetters(prev => {
                              const next = n > prev.length
                                ? [...prev, ...Array(n - prev.length).fill("any")]
                                : prev.slice(0, n);
                              return next;
                            });
                          }}
                          data-testid={`button-round-freq-multi-count-${n}`}
                        >
                          {n} letters
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {Array.from({ length: roundLetterCount }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                          <Select
                            value={roundLetters[i] || "any"}
                            onValueChange={(v) => setRoundLetters(prev => {
                              const next = [...prev];
                              next[i] = v;
                              return next;
                            })}
                          >
                            <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-round-freq-multi-${i}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {"ABCDEFGHILMNOPRSTUWY".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Each slot can be "Any" or a specific letter. All members will play with the same pinned letters.</p>
                  </>
                )}
                {!roundFreqEnabled && (
                  <p className="text-xs text-muted-foreground">Enable to pin specific letters for all members. Off = each member gets a seeded random challenge.</p>
                )}
              </div>
            )}
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
            <Button variant="outline" onClick={() => { setCreateRoundOpen(false); setClosesAt(""); setRoundLetterCount(2); setRoundLetters(["any", "any"]); setRoundFreqEnabled(false); setRoundLbMode("random"); setRoundLbLevel(undefined); setRoundLbConsonantCount(undefined); }}>Cancel</Button>
            <Button onClick={() => createRoundMutation.mutate()} disabled={createRoundMutation.isPending || (selectedSlug === "letter-balance" && roundLbMode === "locked" && (!roundLbLevel || !roundLbConsonantCount))} data-testid="button-create-round-submit">
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

      {/* Huddle Challenge Dialog */}
      <Dialog open={huddleOpen} onOpenChange={(v) => { setHuddleOpen(v); if (!v) { setHuddleTargetGroupId(null); setHuddleGroupSearch(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Challenge Another Group
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Send a group battle challenge. One admin from each group plays as the typist while the rest cheer them on.</p>

            <div className="space-y-1">
              <label className="text-sm font-medium">Opponent Group</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search groups..."
                  value={huddleGroupSearch}
                  onChange={e => setHuddleGroupSearch(e.target.value)}
                  className="pl-8"
                  data-testid="input-huddle-search"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border mt-1">
                {(() => {
                  const filtered = (publicGroups || [])
                    .filter(g => g.id !== groupId && g.name.toLowerCase().includes(huddleGroupSearch.toLowerCase()));
                  if (!filtered.length) return <p className="text-sm text-muted-foreground text-center py-4">No groups found</p>;
                  return filtered.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setHuddleTargetGroupId(g.id); setHuddleGroupSearch(g.name); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left ${huddleTargetGroupId === g.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                      data-testid={`huddle-group-option-${g.id}`}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{g.name}</span>
                      {huddleTargetGroupId === g.id && <span className="ml-auto text-xs">✓</span>}
                    </button>
                  ));
                })()}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Game</label>
              <Select value={huddleGameSlug} onValueChange={v => {
                setHuddleGameSlug(v);
                if (huddleFormat === "turn" && !DUEL_TURN_SLUGS.has(v)) setHuddleFormat("race");
                if (huddleFormat === "race" && !DUEL_RACE_SLUGS.has(v)) setHuddleFormat("turn");
              }}>
                <SelectTrigger data-testid="select-huddle-game">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DUEL_GAME_SLUGS_LIST.map(slug => (
                    <SelectItem key={slug} value={slug}>{DUEL_GAME_NAMES[slug] || slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Format</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={huddleFormat === "turn" ? "default" : "outline"}
                  onClick={() => setHuddleFormat("turn")}
                  disabled={!DUEL_TURN_SLUGS.has(huddleGameSlug)}
                  data-testid="button-huddle-format-turn"
                >
                  Turn-Based
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={huddleFormat === "race" ? "default" : "outline"}
                  onClick={() => setHuddleFormat("race")}
                  disabled={!DUEL_RACE_SLUGS.has(huddleGameSlug)}
                  data-testid="button-huddle-format-race"
                >
                  Race
                </Button>
              </div>
            </div>

            {huddleFormat === "race" && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Target words (first to reach wins)</label>
                  <div className="flex gap-1 flex-wrap">
                    {[5, 10, 15, 20, 25].map(n => (
                      <Button key={n} type="button" size="sm"
                        variant={huddleRaceTarget === n ? "default" : "outline"}
                        onClick={() => setHuddleRaceTarget(n)}
                        data-testid={`button-huddle-target-${n}`}
                      >{n}</Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Time limit</label>
                  <div className="flex gap-1 flex-wrap">
                    {[{ v: 180, l: "3 min" }, { v: 300, l: "5 min" }, { v: 600, l: "10 min" }].map(({ v, l }) => (
                      <Button key={v} type="button" size="sm"
                        variant={huddleRaceTimeLimit === v ? "default" : "outline"}
                        onClick={() => setHuddleRaceTimeLimit(v)}
                        data-testid={`button-huddle-timelimit-${v}`}
                      >{l}</Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!huddleTargetGroupId && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Select an opponent group to continue.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHuddleOpen(false); setHuddleTargetGroupId(null); setHuddleGroupSearch(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => createHuddleMutation.mutate()}
              disabled={!huddleTargetGroupId || createHuddleMutation.isPending}
              data-testid="button-huddle-send"
            >
              {createHuddleMutation.isPending ? "Sending..." : "Send Challenge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Race Challenge Dialog */}
      <Dialog open={trOpen} onOpenChange={(v) => { setTrOpen(v); if (!v) { setTrTargetGroupId(null); setTrGroupSearch(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Race Challenge
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              All members of both groups play simultaneously. Words are pooled per team — the team that finds the most unique valid words wins!
            </p>

            <div className="space-y-1">
              <label className="text-sm font-medium">Opponent Group</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search public groups..."
                  value={trGroupSearch}
                  onChange={e => setTrGroupSearch(e.target.value)}
                  className="pl-8"
                  data-testid="input-tr-search"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border mt-1">
                {(() => {
                  const filtered = (publicGroups || [])
                    .filter(g => g.id !== groupId && g.name.toLowerCase().includes(trGroupSearch.toLowerCase()));
                  if (!filtered.length) return <p className="text-sm text-muted-foreground text-center py-4">No public groups found</p>;
                  return filtered.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setTrTargetGroupId(g.id); setTrGroupSearch(g.name); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left ${trTargetGroupId === g.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                      data-testid={`tr-group-option-${g.id}`}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{g.name}</span>
                      {trTargetGroupId === g.id && <span className="ml-auto text-xs">✓</span>}
                    </button>
                  ));
                })()}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Game</label>
              <Select value={trGameSlug} onValueChange={setTrGameSlug}>
                <SelectTrigger data-testid="select-tr-game">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_RACE_GAME_SLUGS_LIST.map(slug => (
                    <SelectItem key={slug} value={slug}>{TEAM_RACE_GAME_NAMES[slug] || slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Target words (team that reaches this first wins)</label>
                <div className="flex gap-1 flex-wrap">
                  {[10, 15, 20, 25, 30].map(n => (
                    <Button key={n} type="button" size="sm"
                      variant={trRaceTarget === n ? "default" : "outline"}
                      onClick={() => setTrRaceTarget(n)}
                      data-testid={`button-tr-target-${n}`}
                    >{n}</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Time limit</label>
                <div className="flex gap-1 flex-wrap">
                  {[{ v: 180, l: "3 min" }, { v: 300, l: "5 min" }, { v: 480, l: "8 min" }, { v: 600, l: "10 min" }].map(({ v, l }) => (
                    <Button key={v} type="button" size="sm"
                      variant={trRaceTimeLimit === v ? "default" : "outline"}
                      onClick={() => setTrRaceTimeLimit(v)}
                      data-testid={`button-tr-timelimit-${v}`}
                    >{l}</Button>
                  ))}
                </div>
              </div>
            </div>

            {!trTargetGroupId && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Select an opponent group to continue.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTrOpen(false); setTrTargetGroupId(null); setTrGroupSearch(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => createTeamRaceMutation.mutate()}
              disabled={!trTargetGroupId || createTeamRaceMutation.isPending}
              data-testid="button-tr-send"
            >
              {createTeamRaceMutation.isPending ? "Sending..." : "Send Challenge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
