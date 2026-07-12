import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Settings2, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LetterPoolConfig,
  LetterDodgeConfig,
  LetterPositionConfig,
  WordLengthConfig,
  LetterHuntConfig,
  LetterFrequencyConfig,
  ProgressiveRevealConfig,
  AnagramSolverConfig,
  WordScrambleConfig,
  DefinitionMatchConfig,
  WordRootsConfig,
  LetterBalanceConfig,
  SurvivalModeToggle,
} from "@/components/game-config";

const LP_QUIZ_MIN_WORDS = 10;
const WL_MIN_WORDS = 10;

export const SEASON_CONFIGURABLE_GAME_SLUGS: string[] = [
  "letter-pool", "letter-dodge", "word-length", "letter-position",
  "letter-hunt", "letter-frequency", "letter-balance", "progressive-reveal",
  "anagram-solver", "word-scramble", "definition-match", "word-roots",
];

export const SEASON_CONFIGURABLE_GAME_NAMES: Record<string, string> = {
  "letter-pool": "Letter Pool",
  "letter-dodge": "Letter Dodge",
  "word-length": "Length Challenge",
  "letter-position": "Position Master",
  "letter-hunt": "Letter Hunt",
  "letter-frequency": "Letter Frequency",
  "letter-balance": "Letter Balance",
  "progressive-reveal": "Progressive Reveal",
  "anagram-solver": "Anagram Solver",
  "word-scramble": "Word Scramble",
  "definition-match": "Definition Match",
  "word-roots": "Word Roots",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  seasonId: number;
}

export function SeasonRoundConfigDialog({ open, onOpenChange, groupId, seasonId }: Props) {
  const { toast } = useToast();
  const [slug, setSlug] = useState<string>("");
  const [quizParams, setQuizParams] = useState<Record<string, any>>({});

  const lpLetter = quizParams.letter as string | undefined;
  const lpPosition = quizParams.position as number | undefined;
  const { data: lpCountData, isFetching: lpCountFetching } = useQuery<{ count: number }>({
    queryKey: ["/api/games/letter-position/validate", lpLetter, lpPosition],
    queryFn: async () => {
      const res = await fetch(`/api/games/letter-position/validate?letter=${lpLetter}&position=${lpPosition}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: slug === "letter-position" && !!lpLetter && !!lpPosition && open,
    staleTime: Infinity,
  });

  const wlQuizLength = quizParams.length as number | undefined;
  const wlQuizStartsWith = quizParams.startsWith as string | undefined;
  const wlQuizEndsWith = quizParams.endsWith as string | undefined;
  const wlQuizContains = quizParams.contains as string | undefined;
  const wlQuizQs = new URLSearchParams({
    ...(wlQuizLength ? { length: String(wlQuizLength) } : {}),
    ...(wlQuizStartsWith ? { startsWith: wlQuizStartsWith } : {}),
    ...(wlQuizEndsWith ? { endsWith: wlQuizEndsWith } : {}),
    ...(wlQuizContains ? { contains: wlQuizContains } : {}),
  });
  const { data: wlQuizCountData, isFetching: wlQuizCountFetching } = useQuery<{ count: number; ok: boolean }>({
    queryKey: ["/api/games/word-length/validate", wlQuizLength, wlQuizStartsWith, wlQuizEndsWith, wlQuizContains],
    queryFn: async () => {
      const res = await fetch(`/api/games/word-length/validate?${wlQuizQs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: slug === "word-length" && !!wlQuizLength && open,
    staleTime: Infinity,
  });

  const createRoundMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${groupId}/seasons/${seasonId}/rounds/configured`, {
      gameSlug: slug,
      params: slug === "letter-position"
        ? { ...quizParams, mode: 1 }
        : slug === "word-roots"
        ? { wrSeed: quizParams.wrSeed }
        : quizParams,
    }),
    onSuccess: () => {
      toast({ title: "Round configured!", description: "Members can now play today's season round." });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "seasons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds"] });
      handleOpenChange(false);
    },
    onError: (err: any) => {
      let message = "Could not configure round.";
      const raw = typeof err?.message === "string" ? err.message : "";
      const jsonPart = raw.slice(raw.indexOf(":") + 1).trim();
      try {
        const data = JSON.parse(jsonPart);
        if (data?.error) message = data.error;
      } catch {
        if (jsonPart) message = jsonPart;
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const resetState = () => {
    setSlug("");
    setQuizParams({});
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) resetState();
  };

  const selectSlug = (v: string) => {
    setSlug(v);
    setQuizParams({});
  };

  const canSubmit = (() => {
    if (!slug) return false;
    if (slug === "letter-position") {
      return !!(lpLetter && lpPosition && !lpCountFetching && lpCountData !== undefined && lpCountData.count >= LP_QUIZ_MIN_WORDS);
    }
    if (slug === "word-length") {
      if (!wlQuizLength || wlQuizCountFetching || !wlQuizCountData || !wlQuizCountData.ok) return false;
      if (!quizParams.survival && wlQuizCountData.ok && (quizParams.wordCount ?? 20) > wlQuizCountData.count) return false;
      return true;
    }
    if (["letter-hunt", "letter-frequency"].includes(slug) && !quizParams.survival && quizParams.wordCount !== undefined && quizParams.wordCount < 1) return false;
    if (slug === "letter-balance") {
      if (quizParams.category === undefined && quizParams.vowels === undefined && quizParams.consonants === undefined) return false;
      if (quizParams.category === "locked_balance" && (!quizParams.level || !quizParams.consonantCount)) return false;
    }
    if (["definition-match", "progressive-reveal", "anagram-solver", "word-scramble"].includes(slug)) {
      return Array.isArray(quizParams.words) && quizParams.words.length > 0;
    }
    return true;
  })();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configure Season Round
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto max-h-[65vh] pr-1">
          <p className="text-sm text-muted-foreground">
            Pick a game and configure it exactly how you want. It replaces today's automatic round for this season.
          </p>
          <div>
            <label className="text-sm font-medium">Game</label>
            <Select value={slug} onValueChange={selectSlug}>
              <SelectTrigger className="mt-1" data-testid="select-season-round-game">
                <SelectValue placeholder="Choose a game to configure" />
              </SelectTrigger>
              <SelectContent>
                {SEASON_CONFIGURABLE_GAME_SLUGS.map(s => (
                  <SelectItem key={s} value={s} data-testid={`option-season-round-game-${s}`}>
                    {SEASON_CONFIGURABLE_GAME_NAMES[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {slug === "letter-pool" && (
            <LetterPoolConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "letter-dodge" && (
            <LetterDodgeConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "letter-position" && (
            <LetterPositionConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "word-length" && (
            <WordLengthConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "letter-hunt" && (
            <LetterHuntConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "letter-frequency" && (
            <LetterFrequencyConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "letter-balance" && (
            <LetterBalanceConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "progressive-reveal" && (
            <ProgressiveRevealConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "anagram-solver" && (
            <AnagramSolverConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "word-scramble" && (
            <WordScrambleConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "definition-match" && (
            <DefinitionMatchConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {slug === "word-roots" && (
            <WordRootsConfig params={quizParams} setParams={setQuizParams} dialogType="season" open={open} />
          )}

          {(slug === "word-length" || slug === "letter-hunt" || slug === "letter-position" || slug === "letter-frequency" || slug === "letter-dodge" || slug === "letter-balance") && (
            <SurvivalModeToggle params={quizParams} setParams={setQuizParams} dialogType="season" />
          )}

          {slug && (
            <Button
              className="w-full gap-2"
              onClick={() => createRoundMutation.mutate()}
              disabled={!canSubmit || createRoundMutation.isPending}
              data-testid="button-season-round-submit"
            >
              {createRoundMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
              Configure Round
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
