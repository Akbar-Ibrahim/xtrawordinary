import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Swords, Loader2, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import { DUEL_GAME_SLUGS } from "@shared/schema";

interface OpenChallenge {
  id: number;
  challengerId: number;
  challengerName: string | null;
  challengerAvatarUrl: string | null;
  gameSlug: string;
  message: string | null;
  roomCode: string | null;
  createdAt: string;
}

const GAME_LABELS: Record<string, string> = {
  "word-chain": "Word Chain",
  "letter-hunt": "Letter Hunt",
  "word-length": "Word Length",
  "letter-frequency": "Letter Frequency",
  "letter-position": "Letter Position",
  "letter-balance": "Letter Balance",
};

export default function DuelLobby() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [joiningId, setJoiningId] = useState<number | null>(null);

  const { data: openChallenges = [], isLoading, refetch, isFetching } = useQuery<OpenChallenge[]>({
    queryKey: ["/api/duels/open", gameFilter],
    queryFn: async () => {
      const params = gameFilter !== "all" ? `?gameSlug=${gameFilter}` : "";
      const res = await fetch(`/api/duels/open${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  const joinMutation = useMutation({
    mutationFn: async (challengeId: number) => {
      const res = await apiRequest("PATCH", `/api/duels/challenges/${challengeId}/accept`, {});
      return res.json() as Promise<{ roomCode: string | null }>;
    },
    onSuccess: (data) => {
      if (data.roomCode) {
        navigate(`/duel/${data.roomCode}`);
      } else {
        toast({ title: "Error", description: "Could not join room.", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Could not join", description: err?.message ?? "The challenge may have been taken.", variant: "destructive" });
      refetch();
    },
    onSettled: () => setJoiningId(null),
  });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <Swords className="h-12 w-12 mx-auto mb-4 text-violet-500" />
        <h1 className="text-2xl font-bold mb-2">Duel Lobby</h1>
        <p className="text-muted-foreground">Sign in to join open duels or post your own challenge.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Swords className="h-7 w-7 text-violet-500" />
          <div>
            <h1 className="text-2xl font-bold">Duel Lobby</h1>
            <p className="text-sm text-muted-foreground">Join an open challenge or post one from any duel game page.</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-lobby">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mb-4">
        <Select value={gameFilter} onValueChange={setGameFilter}>
          <SelectTrigger className="w-48" data-testid="select-lobby-filter">
            <SelectValue placeholder="All games" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All games</SelectItem>
            {Array.from(DUEL_GAME_SLUGS).map((slug) => (
              <SelectItem key={slug} value={slug}>{GAME_LABELS[slug] ?? slug}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : openChallenges.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No open challenges right now.</p>
          <p className="text-sm mt-1">Go to a duel-enabled game page and post an open challenge to start one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {openChallenges.map((c) => {
            const isJoining = joiningId === c.id && joinMutation.isPending;
            return (
              <Card key={c.id} data-testid={`card-open-challenge-${c.id}`} className="border border-violet-200 dark:border-violet-900">
                <CardContent className="flex items-center gap-4 py-4">
                  <UserAvatar name={c.challengerName ?? "?"} avatarUrl={c.challengerAvatarUrl} className="h-10 w-10 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.challengerName ?? "Unknown player"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {GAME_LABELS[c.gameSlug] ?? c.gameSlug}
                      </Badge>
                      {c.message && (
                        <span className="text-xs text-muted-foreground truncate">"{c.message}"</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                    disabled={isJoining || c.challengerId === user?.id}
                    onClick={() => {
                      setJoiningId(c.id);
                      joinMutation.mutate(c.id);
                    }}
                    data-testid={`button-join-duel-${c.id}`}
                  >
                    {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                    {c.challengerId === user?.id ? "Your challenge" : "Join"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
