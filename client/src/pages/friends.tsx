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
import { Users, UserPlus, Search, Check, X, Trash2, Swords, Gamepad2, Clock, User, Loader2 } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import type { Game, FriendChallenge } from "@shared/schema";
import { SEEDED_GAME_SLUGS } from "@shared/schema";


interface FriendEntry {
  id: number;
  friendUser: { id: number; name: string; avatarUrl: string | null };
}

interface FriendRequest {
  id: number;
  requesterUser: { id: number; name: string; avatarUrl: string | null };
  createdAt: string;
}

interface SearchResult {
  id: number;
  name: string;
  avatarUrl: string | null;
}

const VALID_TABS = ["friends", "requests", "challenges"] as const;
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

  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [challengeFriendId, setChallengeFriendId] = useState<number | null>(null);
  const [challengeGameSlug, setChallengeGameSlug] = useState("");
  const [challengeMessage, setChallengeMessage] = useState("");

  const { data: friends = [], isLoading: friendsLoading } = useQuery<FriendEntry[]>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const { data: requests = [] } = useQuery<FriendRequest[]>({
    queryKey: ["/api/friends/requests"],
    enabled: isAuthenticated,
  });

  const { data: challenges = [] } = useQuery<FriendChallenge[]>({
    queryKey: ["/api/challenges"],
    enabled: isAuthenticated,
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
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  const gameMap = new Map(games.map((g) => [g.slug, g]));
  const seededGames = games.filter((g) => SEEDED_GAME_SLUGS.has(g.slug));

  const pendingForMe = challenges.filter((c) => c.status === "pending" && c.receiverId === user?.id);

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
                placeholder="Search by name..."
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
                    <Link href={`/profile/${u.id}`}>
                      <span className="font-medium hover:underline cursor-pointer flex items-center gap-2">
                        <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="h-6 w-6 text-[9px]" />
                        {u.name}
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends" data-testid="tab-friends">
              Friends {friends.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{friends.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests">
              Requests {requests.length > 0 && <Badge variant="destructive" className="ml-1 text-xs">{requests.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="challenges" data-testid="tab-challenges">
              Challenges {pendingForMe.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{pendingForMe.length}</Badge>
              )}{unseenCompleted.length > 0 && (
                <Badge className="ml-1 text-xs bg-primary text-primary-foreground">NEW</Badge>
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
                    {friends.map((f) => (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`row-friend-${f.friendUser.id}`}>
                        <Link href={`/profile/${f.friendUser.id}`}>
                          <span className="font-medium hover:underline cursor-pointer flex items-center gap-2">
                            <UserAvatar name={f.friendUser.name} avatarUrl={f.friendUser.avatarUrl} className="h-8 w-8 text-xs" />
                            {f.friendUser.name}
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
                        <Link href={`/profile/${r.requesterUser.id}`}>
                          <span className="font-medium hover:underline cursor-pointer flex items-center gap-2">
                            <UserAvatar name={r.requesterUser.name} avatarUrl={r.requesterUser.avatarUrl} className="h-8 w-8 text-xs" />
                            {r.requesterUser.name}
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

          <TabsContent value="challenges">
            <Card>
              <CardContent className="pt-6">
                {challenges.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-challenges">
                    <Swords className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No challenges yet. Challenge a friend from the Friends tab!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {challenges.map((c) => {
                      const game = gameMap.get(c.gameSlug);
                      const isSender = c.senderId === user?.id;
                      const isPending = c.status === "pending";
                      const isCompleted = c.status === "completed";
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
                                {isPending && (
                                  <Badge variant="secondary" className="text-xs">Pending</Badge>
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
                                      {opponentAvatar
                                        ? <img src={opponentAvatar} className="h-4 w-4 rounded-full shrink-0 cursor-pointer" alt={opponentName ?? "opponent"} />
                                        : <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
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

                            {!isSender && isPending && (
                              <Link href={`/game/${c.gameSlug}?challenge=${c.id}`}>
                                <Button size="sm" data-testid={`button-play-challenge-${c.id}`}>
                                  <Gamepad2 className="h-4 w-4 mr-1" /> Play
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
