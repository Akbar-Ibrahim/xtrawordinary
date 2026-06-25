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
import { getLettersForCount, LETTER_FREQUENCY_CHALLENGE_COUNTS } from "@/components/games/letter-frequency";
import type { Game, QuizSession } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [dmWord, setDmWord] = useState("");
  const [dmPos, setDmPos] = useState("noun");
  const [dmDefs, setDmDefs] = useState(["", "", ""]);
  const [dmEditIndex, setDmEditIndex] = useState<number | null>(null);
  const [dmReview, setDmReview] = useState(false);
  const [prWord, setPrWord] = useState("");
  const [lpWord, setLpWord] = useState("");
  const [lpHint, setLpHint] = useState("");
  const [lpCategory, setLpCategory] = useState("");
  const [asWord, setAsWord] = useState("");
  const [wsWord, setWsWord] = useState("");
  const [wsCategory, setWsCategory] = useState("");
  const [wrSeed, setWrSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000));

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

  const prWordKey = (open && slug === "progressive-reveal" && prWord.trim().length >= 2) ? prWord.trim().toUpperCase() : "";
  const { data: prWordValid, isFetching: prWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", prWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(prWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!prWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const lpWordKey = (open && slug === "letter-pool" && lpWord.trim().length >= 2) ? lpWord.trim().toUpperCase() : "";
  const { data: lpWordValid, isFetching: lpWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", lpWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(lpWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!lpWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const asWordKey = (open && slug === "anagram-solver" && asWord.trim().length >= 2) ? asWord.trim().toUpperCase() : "";
  const { data: asWordValid, isFetching: asWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", asWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(asWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!asWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const wsWordKey = (open && slug === "word-scramble" && wsWord.trim().length >= 2) ? wsWord.trim().toUpperCase() : "";
  const { data: wsWordValid, isFetching: wsWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", wsWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(wsWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!wsWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const wrPreviewEnabled = open && slug === "word-roots";
  const { data: wrPreviewPuzzles, isFetching: wrPreviewFetching } = useQuery<Array<{ canonicalWord: string; derivatives: string[] }>>({
    queryKey: ["/api/games/word-roots/puzzles", wrSeed],
    queryFn: async () => {
      const r = await fetch(`/api/games/word-roots/puzzles?seed=${wrSeed}`, { credentials: "include" });
      return r.json();
    },
    enabled: wrPreviewEnabled,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  const dmWordKey = (open && slug === "definition-match" && dmWord.trim().length >= 2) ? dmWord.trim().toUpperCase() : "";
  const { data: dmWordValid, isFetching: dmWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", dmWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(dmWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!dmWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
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
        ? { wrSeed }
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
      setDmWord("");
      setDmPos("noun");
      setDmDefs(["", "", ""]);
      setDmEditIndex(null);
      setDmReview(false);
      setPrWord("");
      setLpWord("");
      setLpHint("");
      setLpCategory("");
      setAsWord("");
      setWsWord("");
      setWsCategory("");
      setLbMode("count");
      setWrSeed(Math.floor(Math.random() * 1_000_000));
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
            {slug === "letter-pool" && (() => {
              const lpEntries: Array<{ word: string; hint: string; category: string; letterPool: string[] }> = Array.isArray(quizParams.words) ? quizParams.words : [];
              const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
              const addLpWord = () => {
                const w = lpWord.trim().toUpperCase();
                if (!w || !lpHint.trim() || lpEntries.some(e => e.word === w)) return;
                const wordLetters = new Set(w.split(""));
                const letterPool = ALPHABET.filter(l => !wordLetters.has(l));
                setQuizParams(p => ({ ...p, words: [...lpEntries, { word: w, hint: lpHint.trim(), category: lpCategory.trim() || "Custom", letterPool }] }));
                setLpWord(""); setLpHint(""); setLpCategory("");
              };
              return (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Pool Mode</label>
                    <div className="flex gap-2 mt-1">
                      {(["with-pool", "without-pool"] as const).map(v => (
                        <Button key={v} type="button" size="sm" variant={quizParams.variant === v ? "default" : "outline"} onClick={() => setQuizParams(p => ({ ...p, variant: v }))} data-testid={`button-quiz-pool-${v}`}>
                          {v === "with-pool" ? "With Pool" : "Without Pool"}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Words to Guess <span className="text-muted-foreground font-normal">(optional)</span></label>
                      <span className="text-xs text-muted-foreground">{lpEntries.length}/20</span>
                    </div>
                    {lpEntries.length > 0 && (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {lpEntries.map((entry, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5" data-testid={`lp-entry-${i}`}>
                            <span className="text-sm font-mono font-bold tracking-wider flex-1">{entry.word}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{entry.hint}</span>
                            <button type="button" onClick={() => setQuizParams(p => ({ ...p, words: lpEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive shrink-0" data-testid={`button-lp-remove-${i}`}>
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {lpEntries.length < 20 && (
                      <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1 w-32 shrink-0">
                          <Input placeholder="WORD" value={lpWord} onChange={e => setLpWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())} className="flex-1 font-mono uppercase tracking-wider" maxLength={20} data-testid="input-lp-word" />
                          <span className="w-5 shrink-0 flex items-center justify-center">
                            {lpWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                            {!lpWordValidating && lpWordValid !== undefined && lpWord.trim().length >= 2 && (
                              lpWordValid.exists
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </span>
                        </div>
                          <Input placeholder="Hint / clue for players" value={lpHint} onChange={e => setLpHint(e.target.value)} className="flex-1" maxLength={100} data-testid="input-lp-hint" />
                        </div>
                        <div className="flex gap-2">
                          <Input placeholder="Category (optional, e.g. Animals)" value={lpCategory} onChange={e => setLpCategory(e.target.value)} className="flex-1" maxLength={50} data-testid="input-lp-category" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLpWord(); } }} />
                          <Button type="button" size="sm" disabled={!lpWord.trim() || !lpHint.trim() || lpEntries.some(e => e.word === lpWord.trim().toUpperCase())} onClick={addLpWord} data-testid="button-lp-add">Add</Button>
                        </div>
                      </div>
                    )}
                    {lpEntries.length === 0 && (
                      <p className="text-xs text-muted-foreground">Leave empty to use random words, or add specific words for your quiz.</p>
                    )}
                  </div>
                </div>
              );
            })()}
            {slug === "letter-dodge" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Difficulty (forbidden letters)</label>
                  <Select
                    value={quizParams.difficulty !== undefined ? String(quizParams.difficulty) : "auto"}
                    onValueChange={(v) => {
                      if (v === "auto") {
                        setQuizParams(p => { const n = { ...p }; delete n.difficulty; delete n.letters; return n; });
                      } else if (v === "advanced") {
                        setQuizParams(p => ({ ...p, difficulty: "advanced" as const, letters: undefined }));
                      } else if (v === "savant") {
                        setQuizParams(p => ({ ...p, difficulty: "savant" as const, letters: undefined }));
                      } else {
                        const c = Number(v) as 1 | 2 | 3 | 4 | 5;
                        setQuizParams(p => ({ ...p, difficulty: c, letters: Array(c).fill("any") }));
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-quiz-dodge-difficulty">
                      <SelectValue placeholder="Auto (seed-based)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (seed-based)</SelectItem>
                      <SelectItem value="1">Easy — 1 forbidden letter</SelectItem>
                      <SelectItem value="2">Medium — 2 forbidden letters</SelectItem>
                      <SelectItem value="3">Hard — 3 forbidden letters</SelectItem>
                      <SelectItem value="4">Expert — 4 forbidden letters</SelectItem>
                      <SelectItem value="5">Master — 5 forbidden letters</SelectItem>
                      <SelectItem value="savant">Savant — 6–12 forbidden letters</SelectItem>
                      <SelectItem value="advanced">Advanced — random count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {typeof quizParams.difficulty === "number" && (
                  <div>
                    <label className="text-sm font-medium">Pin Forbidden Letters (optional)</label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {Array.from({ length: quizParams.difficulty }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                          <Select
                            value={(quizParams.letters?.[i]) || "any"}
                            onValueChange={(v) => setQuizParams(p => {
                              const letters = [...(p.letters ?? Array(p.difficulty as number).fill("any"))];
                              letters[i] = v;
                              return { ...p, letters };
                            })}
                          >
                            <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-quiz-dodge-letter-${i}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Each slot can be "Any" or a letter all players must avoid.</p>
                  </div>
                )}
                {!quizParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to submit</label>
                      <Input
                        type="number" min={1} max={50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-quiz-dodge-word-count"
                        value={quizParams.wordCount ?? ""}
                        onChange={(e) => setQuizParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Time limit</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[60, 90, 120, 180, 300].map(t => (
                          <Button key={t} type="button" size="sm"
                            variant={(quizParams.timeLimit ?? 90) === t ? "default" : "outline"}
                            onClick={() => setQuizParams(p => ({ ...p, timeLimit: t }))}
                            data-testid={`button-quiz-dodge-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {slug === "letter-position" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Letter</label>
                  <Select
                    value={quizParams.letter ?? ""}
                    onValueChange={(v) => setQuizParams(p => ({ ...p, letter: v || undefined }))}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-quiz-lp-letter">
                      <SelectValue placeholder="Pick a letter (A–Z)" />
                    </SelectTrigger>
                    <SelectContent>
                      {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Position (1 = first letter)</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {([1, 2, 3, 4, 5, 6, 7, 8] as const).map(p => (
                      <Button
                        key={p}
                        type="button"
                        size="sm"
                        variant={quizParams.position === p ? "default" : "outline"}
                        onClick={() => setQuizParams(prev => ({ ...prev, position: p }))}
                        data-testid={`button-quiz-lp-pos-${p}`}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
                {lpLetter && lpPosition && (
                  <p className={`text-xs ${lpCountFetching ? "text-muted-foreground" : (lpCountData?.count ?? LP_QUIZ_MIN_WORDS) < LP_QUIZ_MIN_WORDS ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-lp-word-count">
                    {lpCountFetching
                      ? "Checking…"
                      : lpCountData === undefined
                        ? ""
                        : lpCountData.count < LP_QUIZ_MIN_WORDS
                          ? `Only ${lpCountData.count} word${lpCountData.count !== 1 ? "s" : ""} match — need at least ${LP_QUIZ_MIN_WORDS}. Try a different letter or position.`
                          : `${lpCountData.count} words match`}
                  </p>
                )}
                {!quizParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to find</label>
                      <Input
                        type="number" min={1} max={50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-quiz-lp-word-count"
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
                            data-testid={`button-quiz-lp-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {slug === "word-length" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Exact Word Length (3–12)</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {Array.from({ length: 10 }, (_, i) => i + 3).map(n => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={quizParams.length === n ? "default" : "outline"}
                        onClick={() => setQuizParams(p => ({ ...p, length: n }))}
                        data-testid={`button-quiz-wl-length-${n}`}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
                {quizParams.length && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-medium">Starts with</label>
                        <Select
                          value={quizParams.startsWith ?? "any"}
                          onValueChange={(v) => setQuizParams(p => ({ ...p, startsWith: v === "any" ? undefined : v }))}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-quiz-wl-starts"><SelectValue placeholder="Any" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Ends with</label>
                        <Select
                          value={quizParams.endsWith ?? "any"}
                          onValueChange={(v) => setQuizParams(p => ({ ...p, endsWith: v === "any" ? undefined : v }))}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-quiz-wl-ends"><SelectValue placeholder="Any" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Contains</label>
                        <Select
                          value={quizParams.contains ?? "any"}
                          onValueChange={(v) => setQuizParams(p => ({ ...p, contains: v === "any" ? undefined : v }))}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-quiz-wl-contains"><SelectValue placeholder="Any" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className={`text-xs ${wlQuizCountFetching ? "text-muted-foreground" : !wlQuizCountData ? "" : !wlQuizCountData.ok ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-wl-quiz-word-count">
                      {wlQuizCountFetching ? "Checking…" : !wlQuizCountData ? "" : !wlQuizCountData.ok ? `Only ${wlQuizCountData.count} matching words — need at least ${WL_MIN_WORDS}. Adjust filters.` : `${wlQuizCountData.count} words match ✓`}
                    </p>
                  </>
                )}
                {!quizParams.survival && (
                  <>
                    <div>
                      <label className="text-xs font-medium">Words to find (Classic)</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          min={1}
                          max={wlQuizCountData?.count ?? undefined}
                          value={quizParams.wordCount ?? 20}
                          onChange={(e) => {
                            const v = Math.max(1, parseInt(e.target.value) || 1);
                            setQuizParams(p => ({ ...p, wordCount: v }));
                          }}
                          className="w-24 h-8 rounded-md border border-input bg-background px-2 text-sm"
                          data-testid="input-quiz-wl-word-count"
                        />
                        {wlQuizCountData?.ok && (quizParams.wordCount ?? 20) > wlQuizCountData.count && (
                          <p className="text-xs text-destructive" data-testid="text-wl-word-count-error">
                            Max {wlQuizCountData.count} for this filter
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Time limit (Classic)</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[60, 90, 120, 180, 300].map(t => (
                          <Button
                            key={t}
                            type="button"
                            size="sm"
                            variant={(quizParams.timeLimit ?? 120) === t ? "default" : "outline"}
                            onClick={() => setQuizParams(p => ({ ...p, timeLimit: t }))}
                            data-testid={`button-quiz-wl-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {slug === "letter-hunt" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Letter Count</label>
                  <Select
                    value={quizParams.challenge !== undefined ? String(quizParams.challenge) : "auto"}
                    onValueChange={(v) => {
                      if (v === "auto") {
                        setQuizParams(p => { const n = { ...p }; delete n.challenge; delete n.letters; return n; });
                      } else {
                        const c = Number(v);
                        setQuizParams(p => ({ ...p, challenge: c, letters: Array(c + 1).fill("any") }));
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-quiz-hunt-challenge">
                      <SelectValue placeholder="Auto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)} data-testid={`select-quiz-hunt-challenge-${n}`}>{n + 1} letters</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {typeof quizParams.challenge === "number" && (
                  <div>
                    <label className="text-sm font-medium">Pin Letters (optional)</label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {Array.from({ length: quizParams.challenge + 1 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                          <Select
                            value={(quizParams.letters?.[i]) || "any"}
                            onValueChange={(v) => setQuizParams(p => {
                              const letters = [...(p.letters ?? Array(p.challenge + 1).fill("any"))];
                              letters[i] = v;
                              return { ...p, letters };
                            })}
                          >
                            <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-quiz-hunt-letter-${i}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Each slot can be "Any" or a specific letter.</p>
                  </div>
                )}
                {!quizParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to find</label>
                      <Input
                        type="number" min={1} max={50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-quiz-hunt-word-count"
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
                            data-testid={`button-quiz-hunt-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {slug === "letter-frequency" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Frequency Challenge</label>
                  <Select
                    value={quizParams.challenge !== undefined ? String(quizParams.challenge) : "0"}
                    onValueChange={(v) => {
                      const c = v === "multi" ? "multi" : Number(v);
                      setQuizParams(p => ({
                        ...p,
                        challenge: c === 0 ? undefined : c,
                        letter: c === "multi" ? undefined : p.letter,
                        letters: c !== "multi" ? undefined : (p.letters ?? ["any", "any"]),
                        letterCounts: c !== "multi" ? undefined : (p.letterCounts ?? [2, 2]),
                      }));
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-quiz-freq-challenge">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Auto</SelectItem>
                      <SelectItem value="1">Challenge 1 (exactly 2×)</SelectItem>
                      <SelectItem value="2">Challenge 2 (exactly 3×)</SelectItem>
                      <SelectItem value="3">Challenge 3 (exactly 4×)</SelectItem>
                      <SelectItem value="4">Challenge 4 (5× or more)</SelectItem>
                      <SelectItem value="multi">Multi-Letter (2+ letters)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {quizParams.challenge === "multi" && (
                  <div>
                    <label className="text-sm font-medium">Pin Letters (optional)</label>
                    <div className="flex gap-1 mt-1 mb-2">
                      {[2, 3].map(n => (
                        <Button
                          key={n}
                          type="button"
                          size="sm"
                          variant={(quizParams.letters?.length ?? 2) === n ? "default" : "outline"}
                          onClick={() => setQuizParams(p => {
                            const cur: string[] = p.letters ?? Array(2).fill("any");
                            const curCounts: number[] = p.letterCounts ?? Array(2).fill(2);
                            const next = n > cur.length
                              ? [...cur, ...Array(n - cur.length).fill("any")]
                              : cur.slice(0, n);
                            const nextCounts = n > curCounts.length
                              ? [...curCounts, ...Array(n - curCounts.length).fill(2)]
                              : curCounts.slice(0, n);
                            return { ...p, letters: next, letterCounts: nextCounts };
                          })}
                          data-testid={`button-quiz-freq-multi-count-${n}`}
                        >
                          {n} letters
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {Array.from({ length: quizParams.letters?.length ?? 2 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                          <Select
                            value={(quizParams.letters?.[i]) || "any"}
                            onValueChange={(v) => setQuizParams(p => {
                              const letters = [...(p.letters ?? Array(2).fill("any"))];
                              letters[i] = v;
                              return { ...p, letters };
                            })}
                          >
                            <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-quiz-freq-multi-${i}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {"ABCDEFGHILMNOPRSTUWY".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map(cnt => (
                              <Button
                                key={cnt}
                                type="button"
                                size="sm"
                                variant={(quizParams.letterCounts?.[i] ?? 2) === cnt ? "default" : "outline"}
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => setQuizParams(p => {
                                  const counts = [...(p.letterCounts ?? Array(p.letters?.length ?? 2).fill(2))];
                                  counts[i] = cnt;
                                  return { ...p, letterCounts: counts };
                                })}
                                data-testid={`button-quiz-freq-multi-lcount-${i}-${cnt}`}
                              >
                                {cnt}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Each slot: pick a letter (or Any) and its required count.</p>
                  </div>
                )}
                {quizParams.challenge && quizParams.challenge !== "multi" && (
                  <div>
                    <label className="text-sm font-medium">Specific Letter (optional)</label>
                    {(() => {
                      const c = quizParams.challenge;
                      const validLetters = (typeof c === "number" && c >= 1 && c <= 4)
                        ? getLettersForCount(LETTER_FREQUENCY_CHALLENGE_COUNTS[c as 1 | 2 | 3 | 4])
                        : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
                      return (
                        <Select
                          value={quizParams.letter ?? "any"}
                          onValueChange={(v) => setQuizParams(p => ({ ...p, letter: v === "any" ? undefined : v }))}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-quiz-freq-letter">
                            <SelectValue placeholder="Any compatible letter" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any compatible letter</SelectItem>
                            {validLetters.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                )}
                {!quizParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to find</label>
                      <Input
                        type="number" min={1} max={50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-quiz-freq-word-count"
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
                            data-testid={`button-quiz-freq-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
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
            {slug === "progressive-reveal" && (() => {
              const prEntries: Array<{ word: string; subcategory: string }> = Array.isArray(quizParams.words) ? quizParams.words : [];
              const addPrWord = () => {
                const w = prWord.trim().toUpperCase();
                if (!w || prEntries.some(e => e.word === w)) return;
                setQuizParams(p => ({ ...p, words: [...prEntries, { word: w, subcategory: "Custom" }] }));
                setPrWord("");
              };
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Words to Guess</label>
                    <span className="text-xs text-muted-foreground">{prEntries.length}/20</span>
                  </div>
                  {prEntries.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {prEntries.map((entry, i) => (
                        <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`pr-entry-${i}`}>
                          <span className="text-sm font-mono font-bold tracking-wider">{entry.word}</span>
                          <button
                            type="button"
                            onClick={() => setQuizParams(p => ({ ...p, words: prEntries.filter((_, j) => j !== i) }))}
                            className="text-muted-foreground hover:text-destructive ml-1"
                            data-testid={`button-pr-remove-${i}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {prEntries.length < 20 && (
                    <div className="flex gap-2">
                      <div className="flex flex-1 items-center gap-1">
                        <Input
                          placeholder="Enter a word (e.g. ELOQUENT)"
                          value={prWord}
                          onChange={e => setPrWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPrWord(); } }}
                          className="flex-1 font-mono uppercase tracking-wider"
                          maxLength={20}
                          data-testid="input-pr-word"
                        />
                        <span className="w-5 shrink-0 flex items-center justify-center">
                          {prWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                          {!prWordValidating && prWordValid !== undefined && prWord.trim().length >= 2 && (
                            prWordValid.exists
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </span>
                      </div>
                      <Button type="button" size="sm" disabled={!prWord.trim() || prEntries.some(e => e.word === prWord.trim().toUpperCase())} onClick={addPrWord} data-testid="button-pr-add">
                        Add
                      </Button>
                    </div>
                  )}
                  {prEntries.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word so players know what to guess.</p>
                  )}
                </div>
              );
            })()}
            {slug === "anagram-solver" && (() => {
              const asEntries: Array<{ original: string; anagrams: string[] }> = Array.isArray(quizParams.words) ? quizParams.words : [];
              const addAsWord = () => {
                const w = asWord.trim().toUpperCase();
                if (!w || asEntries.some(e => e.original === w)) return;
                setQuizParams(p => ({ ...p, words: [...asEntries, { original: w, anagrams: [w] }] }));
                setAsWord("");
              };
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Words to Unscramble</label>
                    <span className="text-xs text-muted-foreground">{asEntries.length}/20</span>
                  </div>
                  {asEntries.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {asEntries.map((entry, i) => (
                        <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`as-entry-${i}`}>
                          <span className="text-sm font-mono font-bold tracking-wider">{entry.original}</span>
                          <button type="button" onClick={() => setQuizParams(p => ({ ...p, words: asEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive" data-testid={`button-as-remove-${i}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {asEntries.length < 20 && (
                    <div className="flex gap-2 items-center">
                      <div className="flex flex-1 items-center gap-1">
                        <Input
                          placeholder="Enter a word (e.g. PLANET)"
                          value={asWord}
                          onChange={e => setAsWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAsWord(); } }}
                          className="flex-1 font-mono uppercase tracking-wider"
                          maxLength={20}
                          data-testid="input-as-word"
                        />
                        <span className="w-5 shrink-0 flex items-center justify-center">
                          {asWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                          {!asWordValidating && asWordValid !== undefined && asWord.trim().length >= 2 && (
                            asWordValid.exists
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </span>
                      </div>
                      <Button type="button" size="sm" disabled={!asWord.trim() || asEntries.some(e => e.original === asWord.trim().toUpperCase())} onClick={addAsWord} data-testid="button-as-add">Add</Button>
                    </div>
                  )}
                  {asEntries.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word. Players will see the letters scrambled and must type the answer.</p>
                  )}
                </div>
              );
            })()}
            {slug === "word-scramble" && (() => {
              const wsEntries: Array<{ word: string; category: string }> = Array.isArray(quizParams.words) ? quizParams.words : [];
              const addWsWord = () => {
                const w = wsWord.trim().toUpperCase();
                if (!w || wsEntries.some(e => e.word === w)) return;
                setQuizParams(p => ({ ...p, words: [...wsEntries, { word: w, category: wsCategory.trim() || "Custom" }] }));
                setWsWord("");
                setWsCategory("");
              };
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Words to Unscramble</label>
                    <span className="text-xs text-muted-foreground">{wsEntries.length}/20</span>
                  </div>
                  {wsEntries.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {wsEntries.map((entry, i) => (
                        <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`ws-entry-${i}`}>
                          <span className="text-sm font-mono font-bold tracking-wider">{entry.word}</span>
                          {entry.category !== "Custom" && <span className="text-xs text-muted-foreground">({entry.category})</span>}
                          <button type="button" onClick={() => setQuizParams(p => ({ ...p, words: wsEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive" data-testid={`button-ws-remove-${i}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {wsEntries.length < 20 && (
                    <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                      <div className="flex gap-2 items-center">
                        <div className="flex flex-1 items-center gap-1">
                          <Input
                            placeholder="WORD"
                            value={wsWord}
                            onChange={e => setWsWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addWsWord(); } }}
                            className="w-32 shrink-0 font-mono uppercase tracking-wider"
                            maxLength={20}
                            data-testid="input-ws-word"
                          />
                          <span className="w-5 shrink-0 flex items-center justify-center">
                            {wsWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                            {!wsWordValidating && wsWordValid !== undefined && wsWord.trim().length >= 2 && (
                              wsWordValid.exists
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </span>
                        </div>
                        <Input placeholder="Category (optional, e.g. Animals)" value={wsCategory} onChange={e => setWsCategory(e.target.value)} className="flex-1" maxLength={50} data-testid="input-ws-category" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addWsWord(); } }} />
                        <Button type="button" size="sm" disabled={!wsWord.trim() || wsEntries.some(e => e.word === wsWord.trim().toUpperCase())} onClick={addWsWord} data-testid="button-ws-add">Add</Button>
                      </div>
                    </div>
                  )}
                  {wsEntries.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word. Players will see the letters scrambled and must type the answer.</p>
                  )}
                </div>
              );
            })()}
            {slug === "definition-match" && (() => {
              const dmEntries: Array<{ word: string; partOfSpeech: string; definitions: [string, string, string] }> = Array.isArray(quizParams.words) ? quizParams.words : [];
              const isEditing = dmEditIndex !== null;
              const canSave = dmWord.trim().length > 0 && dmDefs[0].trim().length > 0 && dmDefs[1].trim().length > 0 && dmDefs[2].trim().length > 0;
              const saveEntry = () => {
                if (!canSave) return;
                const entry = { word: dmWord.trim().toUpperCase(), partOfSpeech: dmPos, definitions: [dmDefs[0].trim(), dmDefs[1].trim(), dmDefs[2].trim()] as [string, string, string] };
                if (isEditing) {
                  setQuizParams(p => {
                    const words = [...(Array.isArray(p.words) ? p.words : [])];
                    words[dmEditIndex!] = entry;
                    return { ...p, words };
                  });
                  setDmEditIndex(null);
                } else {
                  setQuizParams(p => ({ ...p, words: [...dmEntries, entry] }));
                }
                setDmWord("");
                setDmDefs(["", "", ""]);
              };
              const startEdit = (i: number) => {
                const e = dmEntries[i];
                setDmWord(e.word);
                setDmPos(e.partOfSpeech);
                setDmDefs([e.definitions[0], e.definitions[1], e.definitions[2]]);
                setDmEditIndex(i);
              };
              const cancelEdit = () => { setDmEditIndex(null); setDmWord(""); setDmDefs(["", "", ""]); };
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Word Entries</label>
                    <span className="text-xs text-muted-foreground">{dmEntries.length}/20</span>
                  </div>
                  {dmEntries.length > 0 && (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {dmEntries.map((entry, i) => (
                        <div key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 transition-colors ${dmEditIndex === i ? "border-primary bg-primary/5" : "bg-muted/30"}`} data-testid={`dm-entry-${i}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold uppercase tracking-wide">{entry.word}</p>
                            <p className="text-xs text-muted-foreground">{entry.partOfSpeech} · 3 clues</p>
                          </div>
                          {dmEditIndex === i ? (
                            <span className="text-xs text-primary font-medium self-center px-1">editing…</span>
                          ) : (
                            <>
                              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-primary" onClick={() => startEdit(i)} data-testid={`button-dm-edit-${i}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setQuizParams(p => ({ ...p, words: dmEntries.filter((_, j) => j !== i) }))} data-testid={`button-dm-remove-${i}`}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {(dmEntries.length < 20 || isEditing) && (
                    <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {isEditing ? `Editing: ${dmEntries[dmEditIndex!]?.word ?? ""}` : "Add a word entry"}
                      </p>
                      <div className="flex gap-2">
                        <div className="flex flex-1 items-center gap-1">
                          <Input
                            placeholder="WORD"
                            value={dmWord}
                            onChange={e => setDmWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
                            className="flex-1 font-mono uppercase tracking-wider"
                            data-testid="input-dm-word"
                          />
                          <span className="w-5 shrink-0 flex items-center justify-center">
                            {dmWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                            {!dmWordValidating && dmWordValid !== undefined && dmWord.trim().length >= 2 && (
                              dmWordValid.exists
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </span>
                        </div>
                        <Select value={dmPos} onValueChange={setDmPos}>
                          <SelectTrigger className="w-32 shrink-0" data-testid="select-dm-pos">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["noun", "verb", "adjective", "adverb", "phrase"].map(p => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {[0, 1, 2].map(i => (
                        <div key={i} className="relative">
                          <input
                            placeholder={i === 0 ? "Clue 1 — cryptic / abstract" : i === 1 ? "Clue 2 — more specific" : "Clue 3 — most obvious"}
                            value={dmDefs[i]}
                            onChange={e => setDmDefs(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                            className={`w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${i === 0 ? "" : i === 1 ? "border-amber-200 dark:border-amber-800" : "border-emerald-200 dark:border-emerald-800"}`}
                            data-testid={`input-dm-def-${i}`}
                          />
                          <span className={`absolute right-2 top-2 text-[10px] font-semibold px-1 rounded ${i === 0 ? "text-primary/60" : i === 1 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {i === 0 ? "C1" : i === 1 ? "C2" : "C3"}
                          </span>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="flex-1" disabled={!canSave} onClick={saveEntry} data-testid="button-dm-add-entry">
                          {isEditing ? "Save Changes" : "Add Entry"}
                        </Button>
                        {isEditing && (
                          <Button type="button" size="sm" variant="outline" onClick={cancelEdit} data-testid="button-dm-cancel-edit">
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {dmEntries.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word entry to create this quiz.</p>
                  )}
                </div>
              );
            })()}
            {slug === "word-roots" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Puzzle Set Preview</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setWrSeed(Math.floor(Math.random() * 1_000_000))}
                    disabled={wrPreviewFetching}
                    className="gap-1.5 h-7 text-xs"
                    data-testid="button-wr-reroll"
                  >
                    {wrPreviewFetching
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RefreshCw className="h-3 w-3" />}
                    Re-roll
                  </Button>
                </div>
                <div className="rounded-lg border bg-muted/10 p-3 space-y-2 min-h-[120px]">
                  {wrPreviewFetching ? (
                    <div className="flex items-center justify-center h-20">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : wrPreviewPuzzles ? (
                    wrPreviewPuzzles.map((p, i) => (
                      <div key={i} className="flex flex-col gap-0.5" data-testid={`wr-preview-${i}`}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                          <span className="font-mono font-bold tracking-wider text-sm">{p.canonicalWord}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-6">
                          {p.derivatives.map((d, j) => (
                            <span key={j} className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono text-muted-foreground">{d}</span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center pt-6">Loading preview…</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Players see the derivative clues (badges), not the canonical word. Re-roll to get a different set of 5 puzzles.</p>
              </div>
            )}
            {(slug === "word-length" || slug === "letter-hunt" || slug === "letter-position" || slug === "letter-frequency" || slug === "letter-dodge" || slug === "letter-balance") && (
              <div>
                <label className="text-sm font-medium">Mode</label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={!quizParams.survival ? "default" : "outline"}
                    onClick={() => setQuizParams(p => { const n = { ...p }; delete n.survival; return n; })}
                    data-testid="button-quiz-mode-classic"
                  >
                    Classic
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={quizParams.survival ? "default" : "outline"}
                    onClick={() => setQuizParams(({ wordCount: _wc, timeLimit: _tl, ...rest }) => ({ ...rest, survival: true }))}
                    data-testid="button-quiz-mode-survival"
                  >
                    Survival (8s/word)
                  </Button>
                </div>
              </div>
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
