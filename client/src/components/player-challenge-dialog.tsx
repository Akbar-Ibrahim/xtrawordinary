import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Swords } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import type { Game } from "@shared/schema";
import { SEEDED_GAME_SLUGS, DUEL_GAME_SLUGS, DUEL_TURN_SLUGS, DUEL_RACE_SLUGS } from "@shared/schema";

interface TargetUser {
  id: number;
  name: string;
  avatarUrl: string | null;
}

interface Props {
  targetUser: TargetUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlayerChallengeDialog({ targetUser, open, onOpenChange }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [tab, setTab] = useState<"challenge" | "duel">("duel");

  const [challengeGameSlug, setChallengeGameSlug] = useState("");
  const [challengeMessage, setChallengeMessage] = useState("");

  const [duelGameSlug, setDuelGameSlug] = useState("");
  const [duelFormat, setDuelFormat] = useState<"turn" | "race">("turn");
  const [duelRaceTarget, setDuelRaceTarget] = useState(15);
  const [duelRaceTimeLimit, setDuelRaceTimeLimit] = useState(300);

  const { data: games = [] } = useQuery<Game[]>({ queryKey: ["/api/games"] });

  const createDuelChallengeMutation = useMutation({
    mutationFn: async () => {
      if (!duelGameSlug) throw new Error("No game selected");
      const body: Record<string, unknown> = {
        challengeeId: targetUser.id,
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
      toast({ title: "Duel challenge sent!", description: "Waiting for your opponent to accept." });
      onOpenChange(false);
      setDuelGameSlug("");
      setDuelFormat("turn");
      queryClient.invalidateQueries({ queryKey: ["/api/duels/challenges"] });
      navigate(`/duel/${data.roomCode}`);
    },
    onError: (err: Error) =>
      toast({ title: "Could not send duel", description: err.message, variant: "destructive" }),
  });

  function handleStartChallenge() {
    if (!challengeGameSlug) return;
    const seed = Math.floor(Math.random() * 1000000);
    const msgParam = challengeMessage ? `&msg=${encodeURIComponent(challengeMessage)}` : "";
    onOpenChange(false);
    setChallengeGameSlug("");
    setChallengeMessage("");
    navigate(`/game/${challengeGameSlug}?challenge-new=${targetUser.id}&seed=${seed}${msgParam}`);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setChallengeGameSlug("");
      setChallengeMessage("");
      setDuelGameSlug("");
      setDuelFormat("turn");
      setDuelRaceTarget(15);
      setDuelRaceTimeLimit(300);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="dialog-player-challenge">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-violet-500" />
            <span>Challenge</span>
            <UserAvatar name={targetUser.name} avatarUrl={targetUser.avatarUrl} className="h-6 w-6 text-[10px]" />
            <span>{targetUser.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b pb-2">
          <button
            className={`text-sm font-medium px-3 py-1 rounded-md transition-colors ${tab === "duel" ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("duel")}
            data-testid="tab-challenge-duel"
          >
            Duel (Live)
          </button>
          <button
            className={`text-sm font-medium px-3 py-1 rounded-md transition-colors ${tab === "challenge" ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("challenge")}
            data-testid="tab-challenge-seeded"
          >
            Challenge (Async)
          </button>
        </div>

        {tab === "duel" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Real-time match — your opponent must accept before you play.
            </p>
            <div>
              <label className="text-sm font-medium">Game</label>
              <Select
                value={duelGameSlug}
                onValueChange={(v) => {
                  setDuelGameSlug(v);
                  if (DUEL_TURN_SLUGS.has(v) && !DUEL_RACE_SLUGS.has(v)) setDuelFormat("turn");
                  else if (DUEL_RACE_SLUGS.has(v) && !DUEL_TURN_SLUGS.has(v)) setDuelFormat("race");
                }}
              >
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
                  <Button
                    type="button"
                    size="sm"
                    variant={duelFormat === "turn" ? "default" : "outline"}
                    onClick={() => setDuelFormat("turn")}
                    data-testid="button-format-turn"
                  >
                    Turn-Based
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={duelFormat === "race" ? "default" : "outline"}
                    onClick={() => setDuelFormat("race")}
                    data-testid="button-format-race"
                  >
                    Race
                  </Button>
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
              data-testid="button-confirm-duel"
            >
              {createDuelChallengeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Swords className="h-4 w-4" />
              )}
              Send Duel Challenge
            </Button>
          </div>
        )}

        {tab === "challenge" && (
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
                  {games.filter((g) => SEEDED_GAME_SLUGS.has(g.slug)).map((g) => (
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
              data-testid="button-confirm-challenge"
            >
              <Swords className="h-4 w-4" /> Play &amp; Send Challenge
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
