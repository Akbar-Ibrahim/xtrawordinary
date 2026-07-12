import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { Group, GroupRound, GroupActivityEntry, GroupSeason } from "@shared/schema";
import { PlayerChallengeDialog } from "@/components/player-challenge-dialog";
import {
  DUEL_GAME_SLUGS_LIST,
  TEAM_RACE_GAME_SLUGS_LIST,
} from "./group-detail/constants";
import type {
  GroupDetailResponse,
  LeaderboardEntry,
  MemberWithUser,
  EnrichedHuddleChallenge,
  EnrichedTeamRaceChallenge,
  GuildWarsStats,
} from "./group-detail/types";
import { GroupHeaderCard } from "./group-detail/GroupHeaderCard";
import { RoundsTab } from "./group-detail/RoundsTab";
import { LeaderboardTab } from "./group-detail/LeaderboardTab";
import { MembersTab } from "./group-detail/MembersTab";
import { ActivityTab } from "./group-detail/ActivityTab";
import { SeasonTab } from "./group-detail/SeasonTab";
import { GuildWarsGroupTab } from "./group-detail/GuildWarsGroupTab";
import { CreateRoundDialog } from "./group-detail/CreateRoundDialog";
import { EditGroupDialog } from "./group-detail/EditGroupDialog";
import { HuddleChallengeDialog } from "./group-detail/HuddleChallengeDialog";
import { TeamRaceChallengeDialog } from "./group-detail/TeamRaceChallengeDialog";
import { ConfirmDialogs } from "./group-detail/ConfirmDialogs";

const GROUP_TABS = ["rounds", "leaderboard", "members", "activity", "season", "guild-wars"] as const;
type GroupTab = typeof GROUP_TABS[number];

function getGroupTabFromSearch(): GroupTab {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return (GROUP_TABS as readonly string[]).includes(tab ?? "") ? (tab as GroupTab) : "rounds";
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const groupId = parseInt(id);
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<GroupTab>(getGroupTabFromSearch);

  useEffect(() => {
    setActiveTab(getGroupTabFromSearch());
  }, [location]);

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

  const [challengeTarget, setChallengeTarget] = useState<{ id: number; name: string; avatarUrl: string | null } | null>(null);

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

  const { data: seasons } = useQuery<GroupSeason[]>({
    queryKey: ["/api/groups", groupId, "seasons"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/seasons`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load seasons");
      return res.json();
    },
    enabled: !isNaN(groupId),
  });
  const hasActiveSeason = (seasons || []).some((s) => s.status === "active");

  const { data: guildWarsStats } = useQuery<GuildWarsStats>({
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

  const { data: huddles } = useQuery<EnrichedHuddleChallenge[]>({
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

  function resetCreateRoundState() {
    setCreateRoundOpen(false);
    setClosesAt("");
    setRoundLetterCount(2);
    setRoundLetters(["any", "any"]);
    setRoundFreqEnabled(false);
    setRoundLbMode("random");
    setRoundLbLevel(undefined);
    setRoundLbConsonantCount(undefined);
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
        <GroupHeaderCard
          group={group}
          membership={membership}
          isAdmin={isAdmin}
          isOwner={isOwner}
          onEdit={() => openEditDialog(group)}
          onBattle={() => setHuddleOpen(true)}
          onTeamRace={() => setTrOpen(true)}
          onLeave={() => setLeaveConfirmOpen(true)}
          onDelete={() => setDeleteConfirmOpen(true)}
          onCopyInvite={copyInviteCode}
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as GroupTab)}>
          <TabsList className="w-full mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="rounds" className="flex-1" data-testid="tab-rounds">Rounds</TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1" data-testid="tab-leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="members" className="flex-1" data-testid="tab-members">Members</TabsTrigger>
            <TabsTrigger value="activity" className="flex-1" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="season" className="flex-1" data-testid="tab-season">Season</TabsTrigger>
            <TabsTrigger value="guild-wars" className="flex-1" data-testid="tab-guild-wars">Guild Wars</TabsTrigger>
          </TabsList>

          <RoundsTab
            groupId={groupId}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            currentUserName={user?.name}
            huddles={huddles}
            teamRaces={teamRaces}
            activeRound={activeRound}
            pastRounds={pastRounds}
            expandedRoundId={expandedRoundId}
            setExpandedRoundId={setExpandedRoundId}
            onStartRound={() => setCreateRoundOpen(true)}
            hasActiveSeason={hasActiveSeason}
            acceptHuddleMutation={acceptHuddleMutation}
            declineHuddleMutation={declineHuddleMutation}
            cancelHuddleMutation={cancelHuddleMutation}
            acceptTRMutation={acceptTRMutation}
            declineTRMutation={declineTRMutation}
            cancelTRMutation={cancelTRMutation}
          />

          <LeaderboardTab leaderboard={leaderboard} lbLoading={lbLoading} guildWarsStats={guildWarsStats} />

          <MembersTab
            members={members}
            membersLoading={membersLoading}
            currentUserId={user?.id}
            isAdmin={isAdmin}
            isOwner={isOwner}
            onChallenge={(target) => setChallengeTarget(target)}
            changeRoleMutation={changeRoleMutation}
            removeMemberMutation={removeMemberMutation}
          />

          <ActivityTab activity={activity} activityLoading={activityLoading} />

          <TabsContent value="season">
            <SeasonTab groupId={groupId} isAdmin={isAdmin} isPremium={!!user?.isPremium} />
          </TabsContent>

          <GuildWarsGroupTab groupId={groupId} />
        </Tabs>
      </motion.div>

      <CreateRoundDialog
        open={createRoundOpen}
        onOpenChange={(v) => {
          setCreateRoundOpen(v);
          if (!v) {
            setClosesAt("");
            setRoundLetterCount(2);
            setRoundLetters(["any", "any"]);
            setRoundFreqEnabled(false);
          }
        }}
        selectedSlug={selectedSlug}
        setSelectedSlug={setSelectedSlug}
        closesAt={closesAt}
        setClosesAt={setClosesAt}
        roundLetterCount={roundLetterCount}
        setRoundLetterCount={setRoundLetterCount}
        roundLetters={roundLetters}
        setRoundLetters={setRoundLetters}
        roundFreqEnabled={roundFreqEnabled}
        setRoundFreqEnabled={setRoundFreqEnabled}
        roundLbMode={roundLbMode}
        setRoundLbMode={setRoundLbMode}
        roundLbLevel={roundLbLevel}
        setRoundLbLevel={setRoundLbLevel}
        roundLbConsonantCount={roundLbConsonantCount}
        setRoundLbConsonantCount={setRoundLbConsonantCount}
        createRoundMutation={createRoundMutation}
        onCancel={resetCreateRoundState}
      />

      <EditGroupDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editName={editName}
        setEditName={setEditName}
        editDesc={editDesc}
        setEditDesc={setEditDesc}
        editPublic={editPublic}
        setEditPublic={setEditPublic}
        editTags={editTags}
        toggleEditTag={toggleEditTag}
        editAnnouncement={editAnnouncement}
        setEditAnnouncement={setEditAnnouncement}
        editMutation={editMutation}
      />

      <ConfirmDialogs
        groupName={group.name}
        leaveConfirmOpen={leaveConfirmOpen}
        setLeaveConfirmOpen={setLeaveConfirmOpen}
        leaveMutation={leaveMutation}
        deleteConfirmOpen={deleteConfirmOpen}
        setDeleteConfirmOpen={setDeleteConfirmOpen}
        deleteMutation={deleteMutation}
      />

      <HuddleChallengeDialog
        open={huddleOpen}
        onOpenChange={(v) => { setHuddleOpen(v); if (!v) { setHuddleTargetGroupId(null); setHuddleGroupSearch(""); } }}
        groupId={groupId}
        publicGroups={publicGroups}
        huddleGroupSearch={huddleGroupSearch}
        setHuddleGroupSearch={setHuddleGroupSearch}
        huddleTargetGroupId={huddleTargetGroupId}
        setHuddleTargetGroupId={setHuddleTargetGroupId}
        huddleGameSlug={huddleGameSlug}
        setHuddleGameSlug={setHuddleGameSlug}
        huddleFormat={huddleFormat}
        setHuddleFormat={setHuddleFormat}
        huddleRaceTarget={huddleRaceTarget}
        setHuddleRaceTarget={setHuddleRaceTarget}
        huddleRaceTimeLimit={huddleRaceTimeLimit}
        setHuddleRaceTimeLimit={setHuddleRaceTimeLimit}
        createHuddleMutation={createHuddleMutation}
        onCancel={() => { setHuddleOpen(false); setHuddleTargetGroupId(null); setHuddleGroupSearch(""); }}
      />

      <TeamRaceChallengeDialog
        open={trOpen}
        onOpenChange={(v) => { setTrOpen(v); if (!v) { setTrTargetGroupId(null); setTrGroupSearch(""); } }}
        groupId={groupId}
        publicGroups={publicGroups}
        trGroupSearch={trGroupSearch}
        setTrGroupSearch={setTrGroupSearch}
        trTargetGroupId={trTargetGroupId}
        setTrTargetGroupId={setTrTargetGroupId}
        trGameSlug={trGameSlug}
        setTrGameSlug={setTrGameSlug}
        trRaceTarget={trRaceTarget}
        setTrRaceTarget={setTrRaceTarget}
        trRaceTimeLimit={trRaceTimeLimit}
        setTrRaceTimeLimit={setTrRaceTimeLimit}
        createTeamRaceMutation={createTeamRaceMutation}
        onCancel={() => { setTrOpen(false); setTrTargetGroupId(null); setTrGroupSearch(""); }}
      />

      {challengeTarget && (
        <PlayerChallengeDialog
          targetUser={challengeTarget}
          open={!!challengeTarget}
          onOpenChange={(open) => { if (!open) setChallengeTarget(null); }}
        />
      )}
    </div>
  );
}
