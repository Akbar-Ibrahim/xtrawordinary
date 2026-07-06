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
  const [lbMode, setLbMode] = useState<"count" | "structural">("count");

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
    setLbMode("count");
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) resetState();
  };

  const selectSlug = (v: string) => {
    setSlug(v);
    setQuizParams({});
    setLbMode("count");
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

          {slug === "letter-balance" && (() => {
            const isStructural = lbMode === "structural";
            const structuralCats = [
              { id: "consonant_count", name: "Consonant Count", levelType: "count", levels: [2,3,4,5,6,7,"advanced"] as (number | "advanced")[] },
              { id: "vowel_count", name: "Vowel Count", levelType: "count", levels: [2,3,4,5,6,7,"advanced"] as (number | "advanced")[] },
              { id: "start_end_vowel", name: "Start & End Vowels", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
              { id: "start_end_consonant", name: "Start & End Consonants", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
              { id: "start_vowel_end_consonant", name: "Start Vowel, End Consonant", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
              { id: "start_consonant_end_vowel", name: "Start Consonant, End Vowel", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
              { id: "locked_balance", name: "Locked Balance", levelType: "length", levels: [] as number[] },
            ];
            const selectedCat = structuralCats.find(c => c.id === quizParams.category);
            return (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Mode</label>
                  <div className="flex gap-2 mt-1">
                    <Button type="button" size="sm" variant={!isStructural ? "default" : "outline"} onClick={() => { setLbMode("count"); setQuizParams(p => { const n = { ...p }; delete n.category; delete n.level; delete n.consonantCount; return n; }); }} data-testid="button-season-lb-mode-count">
                      Vowel/Consonant Count
                    </Button>
                    <Button type="button" size="sm" variant={isStructural ? "default" : "outline"} onClick={() => { setLbMode("structural"); setQuizParams(p => { const n = { ...p }; delete n.vowels; delete n.consonants; return n; }); }} data-testid="button-season-lb-mode-structural">
                      Structural
                    </Button>
                  </div>
                </div>
                {!isStructural ? (
                  <>
                    <div>
                      <label className="text-sm font-medium">Vowels</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[0,1,2,3,4,5,6].map(v => (
                          <Button key={v} type="button" size="sm" variant={quizParams.vowels === v ? "default" : "outline"} onClick={() => setQuizParams(p => ({ ...p, vowels: v }))} data-testid={`button-season-lb-vowels-${v}`}>{v}</Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Consonants</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[0,1,2,3,4,5,6,7,8].map(c => (
                          <Button key={c} type="button" size="sm" variant={quizParams.consonants === c ? "default" : "outline"} onClick={() => setQuizParams(p => ({ ...p, consonants: c }))} data-testid={`button-season-lb-consonants-${c}`}>{c}</Button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <Select value={quizParams.category ?? ""} onValueChange={(v) => setQuizParams(p => ({ ...p, category: v, level: undefined, consonantCount: undefined }))}>
                        <SelectTrigger className="mt-1" data-testid="select-season-lb-category"><SelectValue placeholder="Pick a category" /></SelectTrigger>
                        <SelectContent>
                          {structuralCats.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {quizParams.category === "locked_balance" ? (
                      <>
                        <div>
                          <label className="text-sm font-medium">Word length</label>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {[4,5,6,7,8,9,10].map(lv => (
                              <Button key={lv} type="button" size="sm"
                                variant={quizParams.level === lv ? "default" : "outline"}
                                onClick={() => setQuizParams(p => ({ ...p, level: lv, consonantCount: undefined }))}
                                data-testid={`button-season-lb-level-${lv}`}
                              >
                                {lv}
                              </Button>
                            ))}
                          </div>
                        </div>
                        {quizParams.level !== undefined && (
                          <div>
                            <label className="text-sm font-medium">Consonant count <span className="text-xs font-normal text-muted-foreground">(vowels = {quizParams.level} − count)</span></label>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {Array.from({ length: quizParams.level - 1 }, (_, i) => i + 1).map(c => {
                                const v = quizParams.level - c;
                                return (
                                  <Button key={c} type="button" size="sm"
                                    variant={quizParams.consonantCount === c ? "default" : "outline"}
                                    onClick={() => setQuizParams(p => ({ ...p, consonantCount: c }))}
                                    data-testid={`button-season-lb-consonant-${c}`}
                                    title={`${c}C / ${v}V`}
                                  >
                                    {c}C/{v}V
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {(!quizParams.level || !quizParams.consonantCount) && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {!quizParams.level ? "Pick a word length." : "Pick a consonant count."}
                          </p>
                        )}
                      </>
                    ) : selectedCat ? (
                      <div>
                        <label className="text-sm font-medium">
                          Level <span className="text-xs font-normal text-muted-foreground">({selectedCat.levelType === "length" ? "word length" : "count"})</span>
                        </label>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {selectedCat.levels.map(lv => (
                            <Button
                              key={String(lv)}
                              type="button"
                              size="sm"
                              variant={quizParams.level === lv ? "default" : "outline"}
                              className={lv === "advanced" ? "bg-gradient-to-r from-primary to-accent text-primary-foreground border-0" : ""}
                              onClick={() => setQuizParams(p => ({ ...p, level: lv }))}
                              data-testid={`button-season-lb-level-${lv}`}
                            >
                              {lv === "advanced" ? "Advanced" : lv}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {!quizParams.category && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Pick a category to configure this round.</p>
                    )}
                  </>
                )}
                {!quizParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to find</label>
                      <Input
                        type="number" min={1} max={50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-season-lb-word-count"
                        value={quizParams.wordCount ?? ""}
                        onChange={(e) => setQuizParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Time limit</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[60, 90, 120, 180, 300].map(t => (
                          <Button key={t} type="button" size="sm"
                            variant={(quizParams.timeLimit ?? 120) === t ? "default" : "outline"}
                            onClick={() => setQuizParams(p => ({ ...p, timeLimit: t }))}
                            data-testid={`button-season-lb-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

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
