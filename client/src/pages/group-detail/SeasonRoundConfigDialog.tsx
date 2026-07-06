import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Settings2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { getLettersForCount, LETTER_FREQUENCY_CHALLENGE_COUNTS } from "@/components/games/letter-frequency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [dmWord, setDmWord] = useState("");
  const [dmPos, setDmPos] = useState("noun");
  const [dmDefs, setDmDefs] = useState(["", "", ""]);
  const [dmEditIndex, setDmEditIndex] = useState<number | null>(null);
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

  const createRoundMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${groupId}/seasons/${seasonId}/rounds/configured`, {
      gameSlug: slug,
      params: slug === "letter-position"
        ? { ...quizParams, mode: 1 }
        : slug === "word-roots"
        ? { wrSeed }
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
    setDmWord(""); setDmPos("noun"); setDmDefs(["", "", ""]); setDmEditIndex(null);
    setPrWord(""); setLpWord(""); setLpHint(""); setLpCategory("");
    setAsWord(""); setWsWord(""); setWsCategory("");
    setLbMode("count");
    setWrSeed(Math.floor(Math.random() * 1_000_000));
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) resetState();
  };

  const selectSlug = (v: string) => {
    setSlug(v);
    setQuizParams({});
    setDmWord(""); setDmPos("noun"); setDmDefs(["", "", ""]); setDmEditIndex(null);
    setPrWord(""); setLpWord(""); setLpHint(""); setLpCategory("");
    setAsWord(""); setWsWord(""); setWsCategory("");
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
                      <Button key={v} type="button" size="sm" variant={quizParams.variant === v ? "default" : "outline"} onClick={() => setQuizParams(p => ({ ...p, variant: v }))} data-testid={`button-season-pool-${v}`}>
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
                        <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5" data-testid={`season-lp-entry-${i}`}>
                          <span className="text-sm font-mono font-bold tracking-wider flex-1">{entry.word}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{entry.hint}</span>
                          <button type="button" onClick={() => setQuizParams(p => ({ ...p, words: lpEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive shrink-0" data-testid={`button-season-lp-remove-${i}`}>
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
                        <Input placeholder="WORD" value={lpWord} onChange={e => setLpWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())} className="flex-1 font-mono uppercase tracking-wider" maxLength={20} data-testid="input-season-lp-word" />
                        <span className="w-5 shrink-0 flex items-center justify-center">
                          {lpWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                          {!lpWordValidating && lpWordValid !== undefined && lpWord.trim().length >= 2 && (
                            lpWordValid.exists
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </span>
                      </div>
                        <Input placeholder="Hint / clue for players" value={lpHint} onChange={e => setLpHint(e.target.value)} className="flex-1" maxLength={100} data-testid="input-season-lp-hint" />
                      </div>
                      <div className="flex gap-2">
                        <Input placeholder="Category (optional, e.g. Animals)" value={lpCategory} onChange={e => setLpCategory(e.target.value)} className="flex-1" maxLength={50} data-testid="input-season-lp-category" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLpWord(); } }} />
                        <Button type="button" size="sm" disabled={!lpWord.trim() || !lpHint.trim() || lpEntries.some(e => e.word === lpWord.trim().toUpperCase())} onClick={addLpWord} data-testid="button-season-lp-add">Add</Button>
                      </div>
                    </div>
                  )}
                  {lpEntries.length === 0 && (
                    <p className="text-xs text-muted-foreground">Leave empty to use random words, or add specific words for your round.</p>
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
                  <SelectTrigger className="mt-1" data-testid="select-season-dodge-difficulty">
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
                          <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-season-dodge-letter-${i}`}><SelectValue /></SelectTrigger>
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
                      data-testid="input-season-dodge-word-count"
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
                          data-testid={`button-season-dodge-time-${t}`}
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
                  <SelectTrigger className="mt-1" data-testid="select-season-lp-letter">
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
                      data-testid={`button-season-lp-pos-${p}`}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              {lpLetter && lpPosition && (
                <p className={`text-xs ${lpCountFetching ? "text-muted-foreground" : (lpCountData?.count ?? LP_QUIZ_MIN_WORDS) < LP_QUIZ_MIN_WORDS ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-season-lp-word-count">
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
                      data-testid="input-season-lp-word-count"
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
                          data-testid={`button-season-lp-time-${t}`}
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
                      data-testid={`button-season-wl-length-${n}`}
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
                        <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-season-wl-starts"><SelectValue placeholder="Any" /></SelectTrigger>
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
                        <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-season-wl-ends"><SelectValue placeholder="Any" /></SelectTrigger>
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
                        <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-season-wl-contains"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className={`text-xs ${wlQuizCountFetching ? "text-muted-foreground" : !wlQuizCountData ? "" : !wlQuizCountData.ok ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-season-wl-word-count">
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
                        data-testid="input-season-wl-word-count"
                      />
                      {wlQuizCountData?.ok && (quizParams.wordCount ?? 20) > wlQuizCountData.count && (
                        <p className="text-xs text-destructive" data-testid="text-season-wl-word-count-error">
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
                          data-testid={`button-season-wl-time-${t}`}
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
                  <SelectTrigger className="mt-1" data-testid="select-season-hunt-challenge">
                    <SelectValue placeholder="Auto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)} data-testid={`select-season-hunt-challenge-${n}`}>{n + 1} letters</SelectItem>
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
                          <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-season-hunt-letter-${i}`}><SelectValue /></SelectTrigger>
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
                      data-testid="input-season-hunt-word-count"
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
                          data-testid={`button-season-hunt-time-${t}`}
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
                  <SelectTrigger className="mt-1" data-testid="select-season-freq-challenge">
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
                        data-testid={`button-season-freq-multi-count-${n}`}
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
                          <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-season-freq-multi-${i}`}><SelectValue /></SelectTrigger>
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
                              data-testid={`button-season-freq-multi-lcount-${i}-${cnt}`}
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
                        <SelectTrigger className="mt-1" data-testid="select-season-freq-letter">
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
                      data-testid="input-season-freq-word-count"
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
                          data-testid={`button-season-freq-time-${t}`}
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
                      <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`season-pr-entry-${i}`}>
                        <span className="text-sm font-mono font-bold tracking-wider">{entry.word}</span>
                        <button
                          type="button"
                          onClick={() => setQuizParams(p => ({ ...p, words: prEntries.filter((_, j) => j !== i) }))}
                          className="text-muted-foreground hover:text-destructive ml-1"
                          data-testid={`button-season-pr-remove-${i}`}
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
                        data-testid="input-season-pr-word"
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
                    <Button type="button" size="sm" disabled={!prWord.trim() || prEntries.some(e => e.word === prWord.trim().toUpperCase())} onClick={addPrWord} data-testid="button-season-pr-add">
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
                      <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`season-as-entry-${i}`}>
                        <span className="text-sm font-mono font-bold tracking-wider">{entry.original}</span>
                        <button type="button" onClick={() => setQuizParams(p => ({ ...p, words: asEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive" data-testid={`button-season-as-remove-${i}`}>
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
                        data-testid="input-season-as-word"
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
                    <Button type="button" size="sm" disabled={!asWord.trim() || asEntries.some(e => e.original === asWord.trim().toUpperCase())} onClick={addAsWord} data-testid="button-season-as-add">Add</Button>
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
                      <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`season-ws-entry-${i}`}>
                        <span className="text-sm font-mono font-bold tracking-wider">{entry.word}</span>
                        {entry.category !== "Custom" && <span className="text-xs text-muted-foreground">({entry.category})</span>}
                        <button type="button" onClick={() => setQuizParams(p => ({ ...p, words: wsEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive" data-testid={`button-season-ws-remove-${i}`}>
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
                          data-testid="input-season-ws-word"
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
                      <Input placeholder="Category (optional, e.g. Animals)" value={wsCategory} onChange={e => setWsCategory(e.target.value)} className="flex-1" maxLength={50} data-testid="input-season-ws-category" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addWsWord(); } }} />
                      <Button type="button" size="sm" disabled={!wsWord.trim() || wsEntries.some(e => e.word === wsWord.trim().toUpperCase())} onClick={addWsWord} data-testid="button-season-ws-add">Add</Button>
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
                      <div key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 transition-colors ${dmEditIndex === i ? "border-primary bg-primary/5" : "bg-muted/30"}`} data-testid={`season-dm-entry-${i}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold uppercase tracking-wide">{entry.word}</p>
                          <p className="text-xs text-muted-foreground">{entry.partOfSpeech} · 3 clues</p>
                        </div>
                        {dmEditIndex === i ? (
                          <span className="text-xs text-primary font-medium self-center px-1">editing…</span>
                        ) : (
                          <>
                            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-primary" onClick={() => startEdit(i)} data-testid={`button-season-dm-edit-${i}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setQuizParams(p => ({ ...p, words: dmEntries.filter((_, j) => j !== i) }))} data-testid={`button-season-dm-remove-${i}`}>
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
                          data-testid="input-season-dm-word"
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
                        <SelectTrigger className="w-32 shrink-0" data-testid="select-season-dm-pos">
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
                          data-testid={`input-season-dm-def-${i}`}
                        />
                        <span className={`absolute right-2 top-2 text-[10px] font-semibold px-1 rounded ${i === 0 ? "text-primary/60" : i === 1 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {i === 0 ? "C1" : i === 1 ? "C2" : "C3"}
                        </span>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button type="button" size="sm" className="flex-1" disabled={!canSave} onClick={saveEntry} data-testid="button-season-dm-add-entry">
                        {isEditing ? "Save Changes" : "Add Entry"}
                      </Button>
                      {isEditing && (
                        <Button type="button" size="sm" variant="outline" onClick={cancelEdit} data-testid="button-season-dm-cancel-edit">
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {dmEntries.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word entry to create this round.</p>
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
                  data-testid="button-season-wr-reroll"
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
                    <div key={i} className="flex flex-col gap-0.5" data-testid={`season-wr-preview-${i}`}>
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
                  data-testid="button-season-mode-classic"
                >
                  Classic
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={quizParams.survival ? "default" : "outline"}
                  onClick={() => setQuizParams(({ wordCount: _wc, timeLimit: _tl, ...rest }) => ({ ...rest, survival: true }))}
                  data-testid="button-season-mode-survival"
                >
                  Survival (8s/word)
                </Button>
              </div>
            </div>
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
