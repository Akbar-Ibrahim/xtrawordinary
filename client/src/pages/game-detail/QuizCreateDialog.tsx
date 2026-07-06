import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  GraduationCap,
  Copy,
  CheckCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Pencil,
  Play,
  Trophy,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import type { Game, QuizSession } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  game: Game;
  navigate: (to: string, opts?: any) => void;
}

export function QuizCreateDialog({ open, onOpenChange, slug, game, navigate }: Props) {
  const { toast } = useToast();
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizClosesAt, setQuizClosesAt] = useState("");
  const [quizParams, setQuizParams] = useState<Record<string, any>>({});
  const [createdQuiz, setCreatedQuiz] = useState<QuizSession | null>(null);
  const [quizLinkCopied, setQuizLinkCopied] = useState(false);
  const [lbMode, setLbMode] = useState<"count" | "structural">("count");
  const [dmReview, setDmReview] = useState(false);

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

  const createQuizMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/quiz-sessions", {
      gameSlug: slug,
      title: quizTitle.trim(),
      description: quizDescription.trim() || null,
      closesAt: quizClosesAt ? new Date(quizClosesAt).toISOString() : null,
      params: slug === "letter-position"
        ? { ...quizParams, mode: 1 }
        : slug === "word-roots"
        ? { wrSeed: quizParams.wrSeed }
        : (Object.keys(quizParams).length > 0 ? quizParams : null),
    }),
    onSuccess: async (res: any) => {
      const data: QuizSession = await res.json();
      setCreatedQuiz(data);
      setQuizTitle("");
      setQuizDescription("");
    },
    onError: () => toast({ title: "Error", description: "Could not create quiz session.", variant: "destructive" }),
  });

  const handleCopyQuizLink = () => {
    if (!createdQuiz) return;
    const link = `${window.location.origin}/quiz/${createdQuiz.shareCode}`;
    navigator.clipboard.writeText(link);
    setQuizLinkCopied(true);
    setTimeout(() => setQuizLinkCopied(false), 2000);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setCreatedQuiz(null);
      setQuizParams({});
      setQuizClosesAt("");
      setQuizTitle("");
      setQuizDescription("");
      setDmReview(false);
      setLbMode("count");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Create Quiz Session
          </DialogTitle>
        </DialogHeader>
        {!createdQuiz ? (
          <div className="space-y-4 overflow-y-auto max-h-[65vh] pr-1">
            {dmReview && slug === "definition-match" ? (() => {
              const dmReviewEntries: Array<{ word: string; partOfSpeech: string; definitions: [string, string, string] }> = Array.isArray(quizParams.words) ? quizParams.words : [];
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setDmReview(false)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0" data-testid="button-dm-review-back">
                      ← Back
                    </button>
                    <span className="text-sm font-semibold mx-auto">Review your quiz</span>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-0.5">
                    <p className="font-semibold text-sm">{quizTitle || "Untitled Quiz"}</p>
                    {quizDescription && <p className="text-xs text-muted-foreground">{quizDescription}</p>}
                    <p className="text-xs text-muted-foreground">{dmReviewEntries.length} word{dmReviewEntries.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {dmReviewEntries.map((entry, idx) => (
                      <div key={idx} className="rounded-lg border p-3 space-y-1.5" data-testid={`dm-review-entry-${idx}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold uppercase tracking-wide">{entry.word}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{entry.partOfSpeech}</span>
                        </div>
                        <div className="space-y-1">
                          {entry.definitions.map((def: string, di: number) => (
                            <div key={di} className={`text-xs px-2 py-1 rounded ${di === 0 ? "bg-primary/5 text-primary" : di === 1 ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"}`}>
                              <span className="font-semibold mr-1">C{di + 1}:</span>{def}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full gap-2" onClick={() => createQuizMutation.mutate()} disabled={createQuizMutation.isPending} data-testid="button-dm-confirm-create">
                    {createQuizMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                    Create Session
                  </Button>
                </div>
              );
            })() : (
            <>
            <p className="text-sm text-muted-foreground">
              Create a shareable quiz in <strong>{game.name}</strong>. Anyone with the link can play and submit their score.
            </p>
            <div>
              <label className="text-sm font-medium">Quiz title or name</label>
              <Input
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="e.g. Friday Quiz Night"
                maxLength={200}
                data-testid="input-quiz-title"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Textarea
                value={quizDescription}
                onChange={(e) => setQuizDescription(e.target.value)}
                placeholder="Add any instructions or context for players…"
                maxLength={500}
                rows={3}
                data-testid="input-quiz-description"
                className="mt-1 resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">{quizDescription.length}/500</p>
            </div>
            <div>
              <label className="text-sm font-medium">Close Date (optional)</label>
              <Input
                type="datetime-local"
                value={quizClosesAt}
                onChange={(e) => setQuizClosesAt(e.target.value)}
                data-testid="input-quiz-closes-at"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave empty to keep accepting submissions indefinitely.</p>
            </div>
            {slug === "letter-pool" && (
              <LetterPoolConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
            )}
            {slug === "letter-dodge" && (
              <LetterDodgeConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
            )}
            {slug === "letter-position" && (
              <LetterPositionConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
            )}
            {slug === "word-length" && (
              <WordLengthConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
            )}
            {slug === "letter-hunt" && (
              <LetterHuntConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
            )}
            {slug === "letter-frequency" && (
              <LetterFrequencyConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
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
                    <label className="text-sm font-medium">Challenge type</label>
                    <div className="flex gap-2 mt-1">
                      <Button type="button" size="sm"
                        variant={!isStructural ? "default" : "outline"}
                        onClick={() => { setLbMode("count"); setQuizParams(({ category: _c, level: _l, consonantCount: _cc, ...rest }) => rest); }}
                        data-testid="button-lb-mode-count"
                      >
                        Count-based
                      </Button>
                      <Button type="button" size="sm"
                        variant={isStructural ? "default" : "outline"}
                        onClick={() => { setLbMode("structural"); setQuizParams(({ vowels: _v, consonants: _co, length: _l, ...rest }) => rest); }}
                        data-testid="button-lb-mode-structural"
                      >
                        Structural
                      </Button>
                    </div>
                  </div>
                  {!isStructural ? (
                    <>
                      <p className="text-xs text-muted-foreground">Set vowel and/or consonant counts (at least one required). Length is optional.</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs font-medium">Vowels</label>
                          <Input
                            type="number" min={1} max={7} placeholder="Any"
                            className="mt-1 h-8 text-sm"
                            data-testid="input-quiz-lb-vowels"
                            value={quizParams.vowels ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? undefined : Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                              setQuizParams(p => {
                                const consonants = p.consonants;
                                if (v !== undefined && consonants !== undefined) return { ...p, vowels: v, length: v + consonants };
                                if (v === undefined) return { ...p, vowels: v, length: undefined };
                                return { ...p, vowels: v };
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Consonants</label>
                          <Input
                            type="number" min={1} max={7} placeholder="Any"
                            className="mt-1 h-8 text-sm"
                            data-testid="input-quiz-lb-consonants"
                            value={quizParams.consonants ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? undefined : Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                              setQuizParams(p => {
                                const vowels = p.vowels;
                                if (v !== undefined && vowels !== undefined) return { ...p, consonants: v, length: vowels + v };
                                if (v === undefined) return { ...p, consonants: v, length: undefined };
                                return { ...p, consonants: v };
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">
                            {quizParams.vowels !== undefined && quizParams.consonants !== undefined ? "Length (auto)" : "Length (opt.)"}
                          </label>
                          <Input
                            type="number" min={3} max={15} placeholder="Any"
                            className="mt-1 h-8 text-sm"
                            data-testid="input-quiz-lb-length"
                            disabled={quizParams.vowels !== undefined && quizParams.consonants !== undefined}
                            value={quizParams.length ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? undefined : Math.min(15, Math.max(3, parseInt(e.target.value) || 3));
                              setQuizParams(p => ({ ...p, length: v }));
                            }}
                          />
                        </div>
                      </div>
                      {quizParams.vowels === undefined && quizParams.consonants === undefined && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Set at least vowels or consonants to configure this quiz.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium">Category</label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {structuralCats.map(cat => (
                            <Button
                              key={cat.id}
                              type="button"
                              size="sm"
                              variant={quizParams.category === cat.id ? "default" : "outline"}
                              className="justify-start text-left h-auto py-1.5 px-2.5 text-xs"
                              onClick={() => cat.id === "locked_balance"
                                ? setQuizParams(p => ({ ...p, category: cat.id, level: undefined, consonantCount: undefined }))
                                : setQuizParams(p => ({ ...p, category: cat.id, level: cat.levels[0], consonantCount: undefined }))
                              }
                              data-testid={`button-lb-cat-${cat.id}`}
                            >
                              {cat.name}
                            </Button>
                          ))}
                        </div>
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
                                  data-testid={`button-lb-level-${lv}`}
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
                                      data-testid={`button-lb-consonant-${c}`}
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
                                data-testid={`button-lb-level-${lv}`}
                              >
                                {lv === "advanced" ? "Advanced" : lv}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {!quizParams.category && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Pick a category to configure this quiz.</p>
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
                          data-testid="input-quiz-lb-word-count"
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
                              data-testid={`button-quiz-lb-time-${t}`}
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
              <ProgressiveRevealConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
            )}
            {slug === "anagram-solver" && (
              <AnagramSolverConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
            )}
            {slug === "word-scramble" && (
              <WordScrambleConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
            )}
            {slug === "definition-match" && (
              <DefinitionMatchConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
            )}
            {slug === "word-roots" && (
              <WordRootsConfig params={quizParams} setParams={setQuizParams} dialogType="quiz" open={open} />
            )}
            {(slug === "word-length" || slug === "letter-hunt" || slug === "letter-position" || slug === "letter-frequency" || slug === "letter-dodge" || slug === "letter-balance") && (
              <SurvivalModeToggle params={quizParams} setParams={setQuizParams} dialogType="quiz" />
            )}
            <Button
              className="w-full gap-2"
              onClick={() => slug === "definition-match" ? setDmReview(true) : createQuizMutation.mutate()}
              disabled={
                !quizTitle.trim() ||
                (slug !== "definition-match" && createQuizMutation.isPending) ||
                (slug === "letter-position" && (
                  !lpLetter || !lpPosition ||
                  lpCountFetching ||
                  lpCountData === undefined ||
                  lpCountData.count < LP_QUIZ_MIN_WORDS
                )) ||
                (slug === "word-length" && (!wlQuizLength || wlQuizCountFetching || !wlQuizCountData || !wlQuizCountData.ok)) ||
                (slug === "word-length" && !quizParams.survival && wlQuizCountData?.ok && (quizParams.wordCount ?? 20) > wlQuizCountData.count) ||
                (["letter-hunt", "letter-position", "letter-frequency"].includes(slug) && !quizParams.survival && quizParams.wordCount !== undefined && quizParams.wordCount < 1) ||
                (slug === "letter-balance" && quizParams.category === undefined && quizParams.vowels === undefined && quizParams.consonants === undefined) ||
                (slug === "letter-balance" && quizParams.category === "locked_balance" && (!quizParams.level || !quizParams.consonantCount)) ||
                (slug === "definition-match" && (!Array.isArray(quizParams.words) || quizParams.words.length === 0)) ||
                (slug === "progressive-reveal" && (!Array.isArray(quizParams.words) || quizParams.words.length === 0)) ||
                (slug === "anagram-solver" && (!Array.isArray(quizParams.words) || quizParams.words.length === 0)) ||
                (slug === "word-scramble" && (!Array.isArray(quizParams.words) || quizParams.words.length === 0))
              }
              data-testid="button-create-quiz-submit"
            >
              {createQuizMutation.isPending && slug !== "definition-match" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
              {slug === "definition-match" ? "Review & Create →" : "Create Session"}
            </Button>
            </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-700 dark:text-green-300">Quiz session created!</p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">{createdQuiz.title}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Share Link</label>
              <div className="flex gap-2 mt-1">
                <Input
                  readOnly
                  value={`${window.location.origin}/quiz/${createdQuiz.shareCode}`}
                  className="text-sm font-mono"
                  data-testid="text-quiz-link"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyQuizLink}
                  data-testid="button-copy-quiz-link"
                >
                  {quizLinkCopied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => { onOpenChange(false); navigate(`/quiz/${createdQuiz!.shareCode}`); }}
              data-testid="button-play-quiz"
            >
              <Play className="h-4 w-4" />
              Play Quiz
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => navigate(`/quiz/${createdQuiz!.shareCode}/results`)}
              data-testid="button-view-quiz-results"
            >
              <Trophy className="h-4 w-4" />
              View Results Dashboard
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
