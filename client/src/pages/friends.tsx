import { PageSEO } from "@/components/page-seo";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, Redirect, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, UserPlus, Search, Check, X, Trash2, Swords, Gamepad2, Clock, Loader2, Share2 } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import type { Game, FriendChallenge, DuelChallenge } from "@shared/schema";
import { SEEDED_GAME_SLUGS, DUEL_GAME_SLUGS, DUEL_TURN_SLUGS, DUEL_RACE_SLUGS } from "@shared/schema";
import { formatDuelVariation } from "@/lib/duel-variation";

type EnrichedDuelChallenge = DuelChallenge & {
  challengerName: string | null;
  challengerAvatarUrl: string | null;
};


interface FriendEntry {
  id: number;
  friendUser: { id: number; username: string; name: string; avatarUrl: string | null };
}

interface FriendRequest {
  id: number;
  requesterUser: { id: number; username: string; name: string; avatarUrl: string | null };
  createdAt: string;
}

interface SearchResult {
  id: number;
  username: string;
  name: string;
  avatarUrl: string | null;
}

const VALID_TABS = ["friends", "requests", "challenges", "duels"] as const;
type TabValue = typeof VALID_TABS[number];

function getTabFromSearch(): TabValue {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return (VALID_TABS as readonly string[]).includes(tab ?? "") ? (tab as TabValue) : "friends";
}

export default function Friends() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const latestQueryRef = useRef("");
  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromSearch);

  useEffect(() => {
    setActiveTab(getTabFromSearch());
  }, [location]);

  const [friendSort, setFriendSort] = useState<"az" | "za">("az");
  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [challengeFriendId, setChallengeFriendId] = useState<number | null>(null);
  const [challengeGameSlug, setChallengeGameSlug] = useState("");
  const [challengeMessage, setChallengeMessage] = useState("");
  const [dismissedChallengeIds, setDismissedChallengeIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("dismissedChallengeIds");
      if (stored) {
        return new Set<number>(JSON.parse(stored) as number[]);
      }
    } catch {
      // ignore parse errors
    }
    return new Set<number>();
  });

  const [duelDialogOpen, setDuelDialogOpen] = useState(false);
  const [duelFriendId, setDuelFriendId] = useState<number | null>(null);
  const [duelGameSlug, setDuelGameSlug] = useState("");
  const [duelFormat, setDuelFormat] = useState<"turn" | "race">("turn");
  const [duelRaceTarget, setDuelRaceTarget] = useState(15);
  const [duelRaceTimeLimit, setDuelRaceTimeLimit] = useState(300);

  const [dismissedDuelChallengeIds, setDismissedDuelChallengeIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("dismissedDuelChallengeIds");
      if (stored) {
        return new Set<number>(JSON.parse(stored) as number[]);
      }
    } catch {
      // ignore parse errors
    }
    return new Set<number>();
  });

  const { data: friends = [], isLoading: friendsLoading } = useQuery<FriendEntry[]>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const { data: requests = [] } = useQuery<FriendRequest[]>({
    queryKey: ["/api/friends/requests"],
    enabled: isAuthenticated,
  });

  const { data: challenges = [], isSuccess: challengesLoaded } = useQuery<FriendChallenge[]>({
    queryKey: ["/api/challenges"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!challengesLoaded) return;
    const knownIds = new Set(challenges.map((c) => c.id));
    setDismissedChallengeIds((prev) => {
      const next = new Set<number>([...prev].filter((id) => knownIds.has(id)));
      if (next.size === prev.size) return prev;
      try { localStorage.setItem("dismissedChallengeIds", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [challenges, challengesLoaded]);

  const { data: incomingDuels = [], isSuccess: incomingDuelsLoaded } = useQuery<EnrichedDuelChallenge[]>({
    queryKey: ["/api/duels/challenges/incoming"],
    queryFn: async () => {
      const res = await fetch("/api/duels/challenges?type=incoming", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json() as EnrichedDuelChallenge[];
      return data.filter((d) => d.status === "pending");
    },
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!incomingDuelsLoaded) return;
    const knownIds = new Set(incomingDuels.map((d) => d.id));
    setDismissedDuelChallengeIds((prev) => {
      const next = new Set<number>([...prev].filter((id) => knownIds.has(id)));
      if (next.size === prev.size) return prev;
      try { localStorage.setItem("dismissedDuelChallengeIds", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [incomingDuels, incomingDuelsLoaded]);

  const acceptDuelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/duels/challenges/${id}/accept`, {});
      return res.json() as Promise<{ roomCode: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/duels/challenges/incoming"] });
      navigate(`/duel/${data.roomCode}`);
    },
    onError: () => toast({ title: "Error", description: "Could not accept duel.", variant: "destructive" }),
  });

  const createDuelChallengeMutation = useMutation({
    mutationFn: async () => {
      if (!duelFriendId || !duelGameSlug) throw new Error("Missing fields");
      const body: Record<string, unknown> = {
        challengeeId: duelFriendId,
        gameSlug: duelGameSlug,
        format: duelFormat,
      };
      if (duelFormat === "race") {
        body.raceTarget = duelRaceTarget;
        body.raceTimeLimit = duelRaceTimeLimit;
      }
      const res = await apiRequest("POST", "/api/duels/challenges", body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to send duel" }));
        throw new Error(err.error ?? "Failed to send duel");
      }
      return res.json() as Promise<{ roomCode: string }>;
    },
    onSuccess: (data) => {
      toast({ title: "Duel challenge sent!", description: "Waiting for your friend to accept." });
      setDuelDialogOpen(false);
      setDuelGameSlug("");
      setDuelFormat("turn");
      queryClient.invalidateQueries({ queryKey: ["/api/duels/challenges"] });
      navigate(`/duel/${data.roomCode}`);
    },
    onError: (err: Error) => toast({ title: "Could not send duel", description: err.message, variant: "destructive" }),
  });

  const declineDuelMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/duels/challenges/${id}/decline`, {}),
    onSuccess: () => {
      toast({ title: "Duel declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/duels/challenges/incoming"] });
    },
    onError: () => toast({ title: "Error", description: "Could not decline duel.", variant: "destructive" }),
  });

  const { data: games = [] } = useQuery<Game[]>({ queryKey: ["/api/games"] });

  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Search failed" }));
        throw new Error(err.error || "Search failed");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      if (variables === latestQueryRef.current) {
        setSearchResults(data);
      }
    },
    onError: (err: Error) => toast({ title: "Search failed", description: err.message, variant: "destructive" }),
  });

  const sendRequestMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("POST", "/api/friends/request", { userId }),
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      setSearchResults([]);
      setSearchQuery("");
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/friends/${id}/accept`),
    onSuccess: () => {
      toast({ title: "Friend request accepted!" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/friends/${id}/decline`),
    onSuccess: () => {
      toast({ title: "Request declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
  });

  const cancelChallengeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/challenges/${id}/cancel`),
    onSuccess: () => {
      toast({ title: "Challenge cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/unread-count"] });
    },
    onError: () => toast({ title: "Error", description: "Could not cancel challenge.", variant: "destructive" }),
  });

  const declineChallengeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/challenges/${id}/decline`),
    onSuccess: () => {
      toast({ title: "Challenge declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/unread-count"] });
    },
    onError: () => toast({ title: "Error", description: "Could not decline challenge.", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/friends/${id}`),
    onSuccess: () => {
      toast({ title: "Friend removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
  });

  const unseenCompleted = challenges.filter(
    (c) => c.status === "completed" && c.senderId === user?.id && !c.senderViewed
  );

  const unseenCompletedIds = unseenCompleted.map((c) => c.id).join(",");
  useEffect(() => {
    if (activeTab === "challenges" && unseenCompleted.length > 0) {
      Promise.all(
        unseenCompleted.map((c) =>
          apiRequest("POST", `/api/challenges/${c.id}/viewed`, {})
        )
      ).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
        queryClient.invalidateQueries({ queryKey: ["/api/challenges/unread-count"] });
      }).catch(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
        queryClient.invalidateQueries({ queryKey: ["/api/challenges/unread-count"] });
      });
    }
  }, [activeTab, unseenCompletedIds]);

  useEffect(() => {
    latestQueryRef.current = searchQuery;
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchMutation.mutate(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  const gameMap = new Map(games.map((g) => [g.slug, g]));
  const seededGames = games.filter((g) => SEEDED_GAME_SLUGS.has(g.slug));

  const pendingForMe = challenges.filter((c) => c.status === "pending" && c.receiverId === user?.id);
  const pendingBySender = challenges.filter((c) => c.status === "pending" && c.senderId === user?.id);

  const handleStartChallenge = () => {
    if (!challengeGameSlug || challengeFriendId == null) return;
    const seed = Math.floor(Math.random() * 1000000);
    const msgParam = challengeMessage ? `&msg=${encodeURIComponent(challengeMessage)}` : "";
    setChallengeDialogOpen(false);
    setChallengeGameSlug("");
    setChallengeMessage("");
    navigate(`/game/${challengeGameSlug}?challenge-new=${challengeFriendId}&seed=${seed}${msgParam}`);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <PageSEO title="Friends" description="Connect with friends, send word game challenges, and see how your vocabulary stacks up." path="/friends" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-friends-title">Friends</h1>
          </div>
          <p className="text-muted-foreground">Manage friends and challenges</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Add Friend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by username or display name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
                data-testid="input-search-friends"
              />
              <div className="absolute right-3">
                {searchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" data-testid="icon-search-loading" />
                ) : searchQuery.length > 0 ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-search-result-${u.id}`}>
                      <Link href={`/u/${u.username}`}>
                      <span className="font-medium hover:underline cursor-pointer flex items-center gap-2">
                        <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="h-6 w-6 text-[9px]" />
                        <span>{u.name}<span className="block text-xs font-normal text-muted-foreground">@{u.username}</span></span>
                      </span>
                    </Link>
                    <Button size="sm" onClick={() => sendRequestMutation.mutate(u.id)} disabled={sendRequestMutation.isPending} data-testid={`button-add-${u.id}`}>
                      <UserPlus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {searchMutation.isSuccess && searchQuery.length >= 2 && !searchMutation.isPending && searchResults.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground text-center" data-testid="text-no-search-results">
                No users found for "{searchQuery}"
              </p>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="friends" data-testid="tab-friends">
              Friends {friends.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{friends.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests">
              Requests {requests.length > 0 && <Badge variant="destructive" className="ml-1 text-xs">{requests.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="challenges" data-testid="tab-challenges">
              Challenges {pendingForMe.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{pendingForMe.length}</Badge>
              )}{pendingBySender.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{pendingBySender.length} sent</Badge>
              )}{unseenCompleted.length > 0 && (
                <Badge className="ml-1 text-xs bg-primary text-primary-foreground">NEW</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="duels" data-testid="tab-duels">
              Duels {incomingDuels.filter((d) => !dismissedDuelChallengeIds.has(d.id)).length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{incomingDuels.filter((d) => !dismissedDuelChallengeIds.has(d.id)).length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends">
            <Card>
              <CardContent className="pt-6">
                {friendsLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-friends">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No friends yet. Search for players above!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-end pb-1">
                      <div className="flex rounded-md border overflow-hidden text-xs">
                        <button
                          onClick={() => setFriendSort("az")}
                          className={`px-2.5 py-1 transition-colors ${friendSort === "az" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                          data-testid="button-sort-az"
                        >
                          A → Z
                        </button>
                        <button
                          onClick={() => setFriendSort("za")}
                          className={`px-2.5 py-1 border-l transition-colors ${friendSort === "za" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                          data-testid="button-sort-za"
                        >
                          Z → A
                        </button>
                      </div>
                    </div>
                    {[...friends].sort((a, b) => {
                      const cmp = a.friendUser.username.localeCompare(b.friendUser.username);
                      return friendSort === "za" ? -cmp : cmp;
                    }).map((f) => (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`row-friend-${f.friendUser.id}`}>
                        <Link href={`/u/${f.friendUser.username}`}>
                          <span className="font-medium hover:underline cursor-pointer flex items-center gap-2">
                            <UserAvatar name={f.friendUser.name} avatarUrl={f.friendUser.avatarUrl} className="h-8 w-8 text-xs" />
                            <span>{f.friendUser.name}<span className="block text-xs font-normal text-muted-foreground">@{f.friendUser.username}</span></span>
                          </span>
                        </Link>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setChallengeFriendId(f.friendUser.id);
                              setChallengeDialogOpen(true);
                            }}
                            data-testid={`button-challenge-${f.friendUser.id}`}
                          >
                            <Swords className="h-4 w-4 mr-1" /> Challenge
                          </Button>
                          <Button
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-700 text-white gap-1"
                            onClick={() => {
                              setDuelFriendId(f.friendUser.id);
                              setDuelGameSlug("");
                              setDuelFormat("turn");
                              setDuelRaceTarget(15);
                              setDuelRaceTimeLimit(300);
                              setDuelDialogOpen(true);
                            }}
                            data-testid={`button-duel-${f.friendUser.id}`}
                          >
                            <Swords className="h-4 w-4" /> Duel
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeMutation.mutate(f.id)} data-testid={`button-remove-${f.friendUser.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card>
              <CardContent className="pt-6">
                {requests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-requests">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No pending friend requests</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {requests.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`row-request-${r.id}`}>
                        <Link href={`/u/${r.requesterUser.username}`}>
                          <span className="font-medium hover:underline cursor-pointer flex items-center gap-2">
                            <UserAvatar name={r.requesterUser.name} avatarUrl={r.requesterUser.avatarUrl} className="h-8 w-8 text-xs" />
                            <span>{r.requesterUser.name}<span className="block text-xs font-normal text-muted-foreground">@{r.requesterUser.username}</span></span>
                          </span>
                        </Link>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => acceptMutation.mutate(r.id)} data-testid={`button-accept-${r.id}`}>
                            <Check className="h-4 w-4 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => declineMutation.mutate(r.id)} data-testid={`button-decline-${r.id}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="duels">
            <Card>
              <CardContent className="pt-6">
                {(() => {
                  const visibleDuels = incomingDuels.filter((d) => !dismissedDuelChallengeIds.has(d.id));
                  return visibleDuels.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-duels">
                    <Swords className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No incoming duel challenges.</p>
                    <p className="text-sm mt-1">Go to Word Chain and press "Duel a Friend" to challenge someone!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleDuels.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20 p-4"
                        data-testid={`row-duel-${d.id}`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={d.challengerName ?? "?"}
                              avatarUrl={d.challengerAvatarUrl ?? null}
                              className="h-10 w-10 text-sm shrink-0"
                              data-testid={`avatar-challenger-${d.id}`}
                            />
                            <div>
                              <p className="font-semibold text-sm flex items-center gap-1.5">
                                <Swords className="h-4 w-4 text-violet-500" />
                                <span data-testid={`text-challenger-name-${d.id}`}>{d.challengerName ?? "Someone"}</span> challenged you!
                              </p>
                              <p className="text-xs text-muted-foreground" data-testid={`text-duel-game-${d.id}`}>
                                {d.gameSlug ? d.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "Word Chain"} Duel · Waiting for your response
                              </p>
                              {(() => {
                                const variation = formatDuelVariation(d.gameSlug ?? "", d.startWord);
                                return variation ? (
                                  <p className="text-xs text-violet-600 dark:text-violet-400 font-medium" data-testid={`text-duel-variation-${d.id}`}>
                                    Variation: {variation}
                                  </p>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => setDismissedDuelChallengeIds((prev) => {
                                const next = new Set([...prev, d.id]);
                                try { localStorage.setItem("dismissedDuelChallengeIds", JSON.stringify([...next])); } catch {}
                                return next;
                              })}
                              data-testid={`button-dismiss-duel-${d.id}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1 bg-violet-600 hover:bg-violet-700 text-white"
                              onClick={() => acceptDuelMutation.mutate(d.id)}
                              disabled={acceptDuelMutation.isPending || declineDuelMutation.isPending}
                              data-testid={`button-accept-duel-${d.id}`}
                            >
                              {acceptDuelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => declineDuelMutation.mutate(d.id)}
                              disabled={acceptDuelMutation.isPending || declineDuelMutation.isPending}
                              data-testid={`button-decline-duel-${d.id}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="challenges">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" /> Player Challenges
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {(() => {
                  const visibleChallenges = challenges.filter((c) => !dismissedChallengeIds.has(c.id));
                  return visibleChallenges.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-challenges">
                    <Swords className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No challenges yet. Open any game and challenge a player!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleChallenges.map((c) => {
                      const game = gameMap.get(c.gameSlug);
                      const isSender = c.senderId === user?.id;
                      const isPending = c.status === "pending";
                      const isCompleted = c.status === "completed";
                      const isDeclined = c.status === "declined";
                      const isCancelled = c.status === "cancelled";
                      const isNew = isCompleted && isSender && !c.senderViewed;

                      let myScore = isSender ? c.senderScore : (c.receiverScore ?? null);
                      let theirScore = isSender ? (c.receiverScore ?? null) : c.senderScore;

                      let won: boolean | null = null;
                      let isTied = false;
                      if (isCompleted && c.receiverScore !== null) {
                        isTied = c.senderScore === c.receiverScore;
                        won = isTied ? null : (isSender && c.senderScore > c.receiverScore) ||
                              (!isSender && c.receiverScore > c.senderScore);
                      }

                      return (
                        <div
                          key={c.id}
                          className={`rounded-lg border p-4 transition-colors ${isNew ? "border-primary/50 bg-primary/5" : "bg-muted/40 border-transparent"}`}
                          data-testid={`row-challenge-${c.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Gamepad2 className="h-4 w-4 text-primary shrink-0" />
                                <span className="font-medium">{game?.name || c.gameSlug}</span>
                                {isNew && (
                                  <Badge className="text-xs bg-primary text-primary-foreground">NEW</Badge>
                                )}
                                {isPending && !isSender && (
                                  <Badge variant="secondary" className="text-xs">Pending</Badge>
                                )}
                                {isPending && isSender && !c.receiverViewed && (
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700" data-testid={`badge-waiting-${c.id}`}>
                                    Not opened yet
                                  </Badge>
                                )}
                                {isPending && isSender && c.receiverViewed && (
                                  <Badge variant="secondary" className="text-xs" data-testid={`badge-seen-${c.id}`}>Seen</Badge>
                                )}
                                {isDeclined && (
                                  <Badge variant="outline" className="text-xs text-red-500 border-red-200">Declined</Badge>
                                )}
                                {isCancelled && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">Cancelled</Badge>
                                )}
                                {isCompleted && (won !== null || isTied) && (
                                  <Badge
                                    className={`text-xs ${isTied ? "bg-blue-500 text-white" : won ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}
                                  >
                                    {isTied ? "Tied" : won ? "Won" : "Lost"}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {(() => {
                                  const opponentId = isSender ? c.receiverId : c.senderId;
                                  const opponentAvatar = isSender ? c.receiverAvatarUrl : c.senderAvatarUrl;
                                  const opponentName = isSender ? c.receiverName : c.senderName;
                                  return (
                                    <Link href={`/profile/${opponentId}`}>
                                      <UserAvatar name={opponentName ?? "?"} avatarUrl={opponentAvatar ?? null} className="h-4 w-4 text-[8px] cursor-pointer" />
                                    </Link>
                                  );
                                })()}
                                <p className="text-xs text-muted-foreground">
                                  {isSender ? "You challenged " : ""}
                                  <Link href={`/profile/${isSender ? c.receiverId : c.senderId}`}>
                                    <span className="font-medium text-foreground hover:underline cursor-pointer">
                                      {isSender ? (c.receiverName ?? "a friend") : (c.senderName ?? "A friend")}
                                    </span>
                                  </Link>
                                  {!isSender ? " challenged you" : ""}
                                  {c.message && ` — "${c.message}"`}
                                  {c.seed != null && " · Shared puzzle"}
                                  {" · "}{formatDate(c.createdAt)}
                                </p>
                              </div>

                              <div className="flex gap-4 mt-2">
                                {myScore !== null && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Your score</p>
                                    <p className="font-bold text-base">{myScore}</p>
                                  </div>
                                )}
                                {theirScore !== null && isCompleted && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Their score</p>
                                    <p className="font-bold text-base">{theirScore}</p>
                                  </div>
                                )}
                                {isPending && isSender && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Waiting for response</p>
                                    <p className="font-bold text-base">{c.senderScore} pts sent</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5 shrink-0">
                              {!isSender && isPending && (
                                <>
                                  <Link href={`/game/${c.gameSlug}?challenge=${c.id}`}>
                                    <Button size="sm" data-testid={`button-play-challenge-${c.id}`}>
                                      <Gamepad2 className="h-4 w-4 mr-1" /> Play
                                    </Button>
                                  </Link>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-red-500"
                                    onClick={() => declineChallengeMutation.mutate(c.id)}
                                    disabled={declineChallengeMutation.isPending}
                                    data-testid={`button-decline-challenge-${c.id}`}
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" /> Decline
                                  </Button>
                                </>
                              )}
                              {isSender && isPending && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      const url = `${window.location.origin}/share/challenge/${c.id}`;
                                      navigator.clipboard.writeText(url).then(() => {
                                        toast({ title: "Invite link copied!", description: "Share it on WhatsApp, Twitter, or anywhere." });
                                      }).catch(() => {
                                        toast({ title: "Copy failed", description: "Please copy the link manually.", variant: "destructive" });
                                      });
                                    }}
                                    data-testid={`button-share-challenge-${c.id}`}
                                  >
                                    <Share2 className="h-3.5 w-3.5 mr-1" /> Share
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-red-500"
                                    onClick={() => cancelChallengeMutation.mutate(c.id)}
                                    disabled={cancelChallengeMutation.isPending}
                                    data-testid={`button-cancel-challenge-${c.id}`}
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                                  </Button>
                                </>
                              )}
                              {(isDeclined || isCancelled) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() => setDismissedChallengeIds((prev) => {
                                    const next = new Set([...prev, c.id]);
                                    try { localStorage.setItem("dismissedChallengeIds", JSON.stringify([...next])); } catch {}
                                    return next;
                                  })}
                                  data-testid={`button-dismiss-challenge-${c.id}`}
                                >
                                  <X className="h-3.5 w-3.5 mr-1" /> Dismiss
                                </Button>
                              )}
                              {isCompleted && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const opponentId = isSender ? c.receiverId : c.senderId;
                                    setChallengeFriendId(opponentId);
                                    setChallengeGameSlug(c.gameSlug);
                                    setChallengeMessage("");
                                    setChallengeDialogOpen(true);
                                  }}
                                  data-testid={`button-challenge-back-${c.id}`}
                                >
                                  <Swords className="h-3.5 w-3.5 mr-1" /> Challenge Back
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={duelDialogOpen} onOpenChange={setDuelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-violet-500" /> Send a Duel Challenge
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Game</label>
                <Select value={duelGameSlug} onValueChange={(v) => {
                  setDuelGameSlug(v);
                  if (DUEL_TURN_SLUGS.has(v) && !DUEL_RACE_SLUGS.has(v)) setDuelFormat("turn");
                  else if (DUEL_RACE_SLUGS.has(v) && !DUEL_TURN_SLUGS.has(v)) setDuelFormat("race");
                }}>
                  <SelectTrigger data-testid="select-duel-game">
                    <SelectValue placeholder="Select a game" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.filter((g) => DUEL_GAME_SLUGS.has(g.slug)).map((g) => (
                      <SelectItem key={g.slug} value={g.slug}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {duelGameSlug && DUEL_TURN_SLUGS.has(duelGameSlug) && DUEL_RACE_SLUGS.has(duelGameSlug) && (
                <div>
                  <label className="text-sm font-medium">Format</label>
                  <div className="flex gap-2 mt-1.5">
                    {DUEL_TURN_SLUGS.has(duelGameSlug) && (
                      <Button
                        type="button"
                        size="sm"
                        variant={duelFormat === "turn" ? "default" : "outline"}
                        onClick={() => setDuelFormat("turn")}
                        data-testid="button-format-turn"
                      >
                        Turn-Based
                      </Button>
                    )}
                    {DUEL_RACE_SLUGS.has(duelGameSlug) && (
                      <Button
                        type="button"
                        size="sm"
                        variant={duelFormat === "race" ? "default" : "outline"}
                        onClick={() => setDuelFormat("race")}
                        data-testid="button-format-race"
                      >
                        Race
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {duelFormat === "race" && (
                <>
                  <div>
                    <label className="text-sm font-medium">Target (words to win)</label>
                    <Select value={String(duelRaceTarget)} onValueChange={(v) => setDuelRaceTarget(Number(v))}>
                      <SelectTrigger data-testid="select-race-target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 15, 20, 25].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} words</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Time limit</label>
                    <Select value={String(duelRaceTimeLimit)} onValueChange={(v) => setDuelRaceTimeLimit(Number(v))}>
                      <SelectTrigger data-testid="select-race-time-limit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[{ v: 180, label: "3 min" }, { v: 300, label: "5 min" }, { v: 600, label: "10 min" }].map(({ v, label }) => (
                          <SelectItem key={v} value={String(v)}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Button
                className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => createDuelChallengeMutation.mutate()}
                disabled={!duelGameSlug || createDuelChallengeMutation.isPending}
                data-testid="button-send-duel"
              >
                {createDuelChallengeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Swords className="h-4 w-4" />
                )}
                Send Duel Challenge
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send a Challenge</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pick a game and optional message. You'll play first — your score is automatically sent when you finish.
              </p>
              <div>
                <label className="text-sm font-medium">Game</label>
                <Select value={challengeGameSlug} onValueChange={setChallengeGameSlug}>
                  <SelectTrigger data-testid="select-challenge-game">
                    <SelectValue placeholder="Select a game" />
                  </SelectTrigger>
                  <SelectContent>
                    {seededGames.map((g) => (
                      <SelectItem key={g.slug} value={g.slug}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Message (optional)</label>
                <Input
                  value={challengeMessage}
                  onChange={(e) => setChallengeMessage(e.target.value)}
                  placeholder="Beat this!"
                  maxLength={200}
                  data-testid="input-challenge-message"
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleStartChallenge}
                disabled={!challengeGameSlug}
                data-testid="button-send-challenge"
              >
                <Swords className="h-4 w-4" /> Play &amp; Send Challenge
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
