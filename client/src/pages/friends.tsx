import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, UserPlus, Search, Check, X, Trash2, Swords, Trophy, Gamepad2, Clock, User } from "lucide-react";
import { motion } from "framer-motion";
import type { Game, FriendChallenge } from "@shared/schema";

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

export default function Friends() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [challengeFriendId, setChallengeFriendId] = useState<number | null>(null);
  const [challengeGameSlug, setChallengeGameSlug] = useState("");
  const [challengeScore, setChallengeScore] = useState("");
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
    onSuccess: (data) => setSearchResults(data),
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

  const createChallengeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/challenges", {
      friendId: challengeFriendId,
      gameSlug: challengeGameSlug,
      score: parseInt(challengeScore),
      message: challengeMessage || undefined,
    }),
    onSuccess: () => {
      toast({ title: "Challenge sent!" });
      setChallengeDialogOpen(false);
      setChallengeGameSlug("");
      setChallengeScore("");
      setChallengeMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSearch = () => {
    if (searchQuery.length >= 2) searchMutation.mutate(searchQuery);
  };

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  const gameMap = new Map(games.map(g => [g.slug, g]));

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
            <div className="flex gap-2">
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                data-testid="input-search-friends"
              />
              <Button onClick={handleSearch} disabled={searchQuery.length < 2} data-testid="button-search-friends">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-search-result-${u.id}`}>
                    <Link href={`/profile/${u.id}`}>
                      <span className="font-medium hover:underline cursor-pointer flex items-center gap-2">
                        {u.avatarUrl ? <img src={u.avatarUrl} className="h-6 w-6 rounded-full" /> : <User className="h-4 w-4" />}
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
          </CardContent>
        </Card>

        <Tabs defaultValue="friends">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends" data-testid="tab-friends">
              Friends {friends.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{friends.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests">
              Requests {requests.length > 0 && <Badge variant="destructive" className="ml-1 text-xs">{requests.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="challenges" data-testid="tab-challenges">
              Challenges {challenges.filter(c => c.status === "pending" && c.receiverId === user?.id).length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{challenges.filter(c => c.status === "pending" && c.receiverId === user?.id).length}</Badge>
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
                            {f.friendUser.avatarUrl ? <img src={f.friendUser.avatarUrl} className="h-8 w-8 rounded-full" /> : <User className="h-5 w-5 text-muted-foreground" />}
                            {f.friendUser.name}
                          </span>
                        </Link>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setChallengeFriendId(f.friendUser.id); setChallengeDialogOpen(true); }} data-testid={`button-challenge-${f.friendUser.id}`}>
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
                            {r.requesterUser.avatarUrl ? <img src={r.requesterUser.avatarUrl} className="h-8 w-8 rounded-full" /> : <User className="h-5 w-5 text-muted-foreground" />}
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
                  <div className="space-y-2">
                    {challenges.map((c) => {
                      const game = gameMap.get(c.gameSlug);
                      const isSender = c.senderId === user?.id;
                      const isPending = c.status === "pending";
                      return (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`row-challenge-${c.id}`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <Gamepad2 className="h-4 w-4 text-primary" />
                              <span className="font-medium">{game?.name || c.gameSlug}</span>
                              <Badge variant={isPending ? "secondary" : "default"} className="text-xs">
                                {isPending ? "Pending" : "Completed"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {isSender ? "You challenged" : "Challenged by"} a friend
                              {c.message && ` — "${c.message}"`}
                            </p>
                            <div className="flex gap-3 mt-1 text-sm">
                              <span>Sender: <strong>{c.senderScore} pts</strong></span>
                              {c.receiverScore !== null && <span>Receiver: <strong>{c.receiverScore} pts</strong></span>}
                              {c.status === "completed" && c.receiverScore !== null && (
                                <Badge variant={
                                  (isSender && c.senderScore >= c.receiverScore) || (!isSender && c.receiverScore >= c.senderScore)
                                    ? "default" : "secondary"
                                } className="text-xs">
                                  {(isSender && c.senderScore >= c.receiverScore) || (!isSender && c.receiverScore >= c.senderScore) ? "Won" : "Lost"}
                                </Badge>
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
              <div>
                <label className="text-sm font-medium">Game</label>
                <Select value={challengeGameSlug} onValueChange={setChallengeGameSlug}>
                  <SelectTrigger data-testid="select-challenge-game">
                    <SelectValue placeholder="Select a game" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((g) => (
                      <SelectItem key={g.slug} value={g.slug}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Your Score</label>
                <Input type="number" value={challengeScore} onChange={(e) => setChallengeScore(e.target.value)} placeholder="Enter your score" data-testid="input-challenge-score" />
              </div>
              <div>
                <label className="text-sm font-medium">Message (optional)</label>
                <Input value={challengeMessage} onChange={(e) => setChallengeMessage(e.target.value)} placeholder="Beat this!" data-testid="input-challenge-message" />
              </div>
              <Button
                className="w-full"
                onClick={() => createChallengeMutation.mutate()}
                disabled={!challengeGameSlug || !challengeScore || createChallengeMutation.isPending}
                data-testid="button-send-challenge"
              >
                <Swords className="h-4 w-4 mr-2" /> Send Challenge
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
