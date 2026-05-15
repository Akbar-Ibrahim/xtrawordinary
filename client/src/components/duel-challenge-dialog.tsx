import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Swords } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import { DUEL_TURN_SLUGS, DUEL_RACE_SLUGS } from "@shared/schema";

interface Props {
  gameSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuelChallengeDialog({ gameSlug, open, onOpenChange }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [duelTab, setDuelTab] = useState<"targeted" | "open">("targeted");
  const [duelSearch, setDuelSearch] = useState("");
  const [duelSearchInput, setDuelSearchInput] = useState("");
  const [duelSearchId, setDuelSearchId] = useState<number | null>(null);
  const [duelFormat, setDuelFormat] = useState<"turn" | "race">("turn");
  const [duelRaceTarget, setDuelRaceTarget] = useState(15);
  const [duelRaceTimeLimit, setDuelRaceTimeLimit] = useState(300);
  const [duelWordLength, setDuelWordLength] = useState<4 | 5 | 6>(5);

  useEffect(() => {
    setDuelSearchId(null);
    if (!duelSearchInput.trim()) {
      setDuelSearch("");
      return;
    }
    const timer = setTimeout(() => {
      setDuelSearch(duelSearchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [duelSearchInput]);

  const isLadderRushDuel = gameSlug === "ladder-rush" || gameSlug === "ladder-rush-double";
  const duelGameSlug = isLadderRushDuel
    ? (gameSlug === "ladder-rush-double" ? `ladder-rush-double-${duelWordLength}` : `ladder-rush-${duelWordLength}`)
    : gameSlug;

  const { data: duelUserResults = [], isFetching: duelSearchFetching } = useQuery<{ id: number; name: string; avatarUrl: string | null }[]>({
    queryKey: ["/api/users/search", duelSearch],
    queryFn: async () => {
      if (!duelSearch.trim()) return [];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(duelSearch.trim())}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!duelSearch.trim() && open,
    staleTime: 10000,
  });

  const createDuelChallengeMutation = useMutation({
    mutationFn: async (challengeeId: number | null) => {
      const body: Record<string, unknown> = { gameSlug: duelGameSlug, format: duelFormat };
      if (challengeeId !== null) body.challengeeId = challengeeId;
      if (duelFormat === "race") {
        body.raceTarget = duelRaceTarget;
        body.raceTimeLimit = duelRaceTimeLimit;
      }
      const res = await apiRequest("POST", "/api/duels/challenges", body);
      return res.json() as Promise<{ id: number; status: string; roomCode: string | null }>;
    },
    onSuccess: (data) => {
      if (data.roomCode) {
        onOpenChange(false);
        navigate(`/duel/${data.roomCode}`);
      } else {
        toast({ title: "Error", description: "Could not create duel room.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Could not send duel challenge.", variant: "destructive" });
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    const defaultFmt = DUEL_RACE_SLUGS.has(gameSlug) && !DUEL_TURN_SLUGS.has(gameSlug) ? "race" : "turn";
    if (nextOpen) {
      setDuelTab("targeted");
      setDuelFormat(defaultFmt);
    } else {
      setDuelSearch("");
      setDuelSearchInput("");
      setDuelSearchId(null);
      setDuelTab("targeted");
      setDuelFormat(defaultFmt);
      setDuelRaceTarget(15);
      setDuelRaceTimeLimit(300);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="dialog-duel-friend">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-violet-500" />
            Duel a Player
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2 border-b pb-2">
            <button
              className={`text-sm font-medium px-3 py-1 rounded-md transition-colors ${duelTab === "targeted" ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setDuelTab("targeted")}
              data-testid="tab-duel-targeted"
            >
              Challenge a Player
            </button>
            <button
              className={`text-sm font-medium px-3 py-1 rounded-md transition-colors ${duelTab === "open" ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setDuelTab("open")}
              data-testid="tab-duel-open"
            >
              Open Challenge
            </button>
          </div>

          {/* Format toggle — only shown for games that support BOTH formats */}
          {gameSlug && DUEL_TURN_SLUGS.has(gameSlug) && DUEL_RACE_SLUGS.has(gameSlug) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Format</p>
              <div className="flex gap-2">
                <button
                  className={`flex-1 text-sm font-medium px-3 py-2 rounded-md border transition-colors ${duelFormat === "turn" ? "bg-violet-100 dark:bg-violet-900/30 border-violet-400 text-violet-700 dark:text-violet-300" : "border-border text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setDuelFormat("turn")}
                  data-testid="button-format-turn"
                >
                  ⚔️ Turn-Based
                </button>
                <button
                  className={`flex-1 text-sm font-medium px-3 py-2 rounded-md border transition-colors ${duelFormat === "race" ? "bg-violet-100 dark:bg-violet-900/30 border-violet-400 text-violet-700 dark:text-violet-300" : "border-border text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setDuelFormat("race")}
                  data-testid="button-format-race"
                >
                  ⚡ Race
                </button>
              </div>
            </div>
          )}
          {/* Word-length picker — only shown for Ladder Rush games */}
          {isLadderRushDuel && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Word Length</p>
              <div className="flex gap-2">
                {([4, 5, 6] as const).map((len) => (
                  <button
                    key={len}
                    className={`flex-1 text-sm font-medium px-3 py-2 rounded-md border transition-colors ${duelWordLength === len ? "bg-violet-100 dark:bg-violet-900/30 border-violet-400 text-violet-700 dark:text-violet-300" : "border-border text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setDuelWordLength(len)}
                    data-testid={`button-word-length-${len}`}
                  >
                    {len} letters {len === 4 ? "(Easy)" : len === 5 ? "(Medium)" : "(Hard)"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Turn description */}
          {duelFormat === "turn" && (
            <p className="text-xs text-muted-foreground">Players alternate turns. First to run out of lives loses.</p>
          )}
          {/* Race target/time pickers */}
          {duelFormat === "race" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Both players submit simultaneously. First to reach the target wins!</p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-xs font-medium mb-1">Target words</p>
                  <div className="flex gap-1 flex-wrap">
                    {[5, 10, 15, 20, 25].map((n) => (
                      <button
                        key={n}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${duelRaceTarget === n ? "bg-violet-600 text-white border-violet-600" : "border-border hover:bg-muted"}`}
                        onClick={() => setDuelRaceTarget(n)}
                        data-testid={`button-race-target-${n}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Time limit</p>
                  <div className="flex gap-1 flex-wrap">
                    {[{ v: 180, l: "3m" }, { v: 300, l: "5m" }, { v: 600, l: "10m" }].map(({ v, l }) => (
                      <button
                        key={v}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${duelRaceTimeLimit === v ? "bg-violet-600 text-white border-violet-600" : "border-border hover:bg-muted"}`}
                        onClick={() => setDuelRaceTimeLimit(v)}
                        data-testid={`button-race-time-${v}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {duelTab === "targeted" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Search by username to challenge any player directly.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Search username…"
                  value={duelSearchInput}
                  onChange={(e) => setDuelSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setDuelSearch(duelSearchInput); setDuelSearchId(null); } }}
                  data-testid="input-duel-search"
                />
                <Button variant="outline" size="sm" onClick={() => { setDuelSearch(duelSearchInput); setDuelSearchId(null); }} disabled={!duelSearchInput.trim()}>
                  {duelSearchFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
              </div>
              {duelSearch && duelUserResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-1">
                  {duelUserResults.map((u) => (
                    <button
                      key={u.id}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm hover:bg-muted transition-colors ${duelSearchId === u.id ? "bg-violet-100 dark:bg-violet-900/30" : ""}`}
                      onClick={() => setDuelSearchId(u.id)}
                      data-testid={`option-duel-user-${u.id}`}
                    >
                      <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="h-6 w-6" />
                      {u.name}
                      {duelSearchId === u.id && <span className="ml-auto text-violet-600 text-xs">Selected</span>}
                    </button>
                  ))}
                </div>
              )}
              {duelSearch && !duelSearchFetching && duelUserResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">No users found for "{duelSearch}"</p>
              )}
              <Button
                className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                disabled={!duelSearchId || createDuelChallengeMutation.isPending}
                onClick={() => { if (duelSearchId !== null) createDuelChallengeMutation.mutate(duelSearchId); }}
                data-testid="button-send-duel"
              >
                {createDuelChallengeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                Send Challenge
              </Button>
            </div>
          )}

          {duelTab === "open" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Post an open challenge visible in the Duel Lobby — anyone can join!
              </p>
              <Button
                className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                disabled={createDuelChallengeMutation.isPending}
                onClick={() => createDuelChallengeMutation.mutate(null)}
                data-testid="button-post-open-duel"
              >
                {createDuelChallengeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                Post Open Challenge
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
