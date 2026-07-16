import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Play, Sparkles } from "lucide-react";
import { WordExamplesPanel } from "@/components/word-examples-panel";
import { getLettersForCount, LETTER_FREQUENCY_CHALLENGE_COUNTS } from "@/components/games/letter-frequency";
import type { Game } from "@shared/schema";

const LP_QUIZ_MIN_WORDS = 10;
const WL_MIN_WORDS = 10;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  game: Game;
  onPlay: (params: Record<string, any>) => void;
}

export function CustomPlayDialog({ open, onOpenChange, slug, game, onPlay }: Props) {
  const [customPlayParams, setCustomPlayParams] = useState<Record<string, any>>({});
  const [lbCustomMode, setLbCustomMode] = useState<"count" | "structural">("count");

  const customLpLetter = (customPlayParams.letter as string | undefined)?.toUpperCase() || undefined;
  const customLpPosition = customPlayParams.position ? Number(customPlayParams.position) : undefined;
  const { data: customLpCountData, isFetching: customLpCountFetching } = useQuery<{ count: number }>({
    queryKey: ["/api/games/letter-position/validate", customLpLetter, customLpPosition],
    queryFn: async () => {
      const res = await fetch(`/api/games/letter-position/validate?letter=${customLpLetter}&position=${customLpPosition}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: slug === "letter-position" && !!customLpLetter && !!customLpPosition && open,
    staleTime: Infinity,
  });

  const wlCustomLength = customPlayParams.length as number | undefined;
  const wlCustomStartsWith = customPlayParams.startsWith as string | undefined;
  const wlCustomEndsWith = customPlayParams.endsWith as string | undefined;
  const wlCustomContains = customPlayParams.contains as string | undefined;
  const wlCustomQs = new URLSearchParams({
    ...(wlCustomLength ? { length: String(wlCustomLength) } : {}),
    ...(wlCustomStartsWith ? { startsWith: wlCustomStartsWith } : {}),
    ...(wlCustomEndsWith ? { endsWith: wlCustomEndsWith } : {}),
    ...(wlCustomContains ? { contains: wlCustomContains } : {}),
  });
  const { data: wlCustomCountData, isFetching: wlCustomCountFetching } = useQuery<{ count: number; ok: boolean }>({
    queryKey: ["/api/games/word-length/validate", wlCustomLength, wlCustomStartsWith, wlCustomEndsWith, wlCustomContains],
    queryFn: async () => {
      const res = await fetch(`/api/games/word-length/validate?${wlCustomQs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: slug === "word-length" && !!wlCustomLength && open,
    staleTime: Infinity,
  });

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setCustomPlayParams({});
      setLbCustomMode("count");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Custom Play
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure a custom game variant for <strong>{game.name}</strong>. Scores won't be saved to the leaderboard.
          </p>

          {slug === "letter-position" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Letter</label>
                <Select
                  value={customPlayParams.letter ?? ""}
                  onValueChange={(v) => setCustomPlayParams(p => ({ ...p, letter: v || undefined }))}
                >
                  <SelectTrigger className="mt-1" data-testid="select-custom-lp-letter">
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
                  {([1, 2, 3, 4, 5, 6, 7, 8] as const).map(pos => (
                    <Button
                      key={pos}
                      type="button"
                      size="sm"
                      variant={customPlayParams.position === pos ? "default" : "outline"}
                      onClick={() => setCustomPlayParams(prev => ({ ...prev, position: pos }))}
                      data-testid={`button-custom-lp-pos-${pos}`}
                    >
                      {pos}
                    </Button>
                  ))}
                </div>
              </div>
              {customLpLetter && customLpPosition && (
                <p className={`text-xs ${customLpCountFetching ? "text-muted-foreground" : !customLpCountData ? "" : customLpCountData.count < LP_QUIZ_MIN_WORDS ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-custom-lp-word-count">
                  {customLpCountFetching ? "Checking…" : !customLpCountData ? "" : customLpCountData.count < LP_QUIZ_MIN_WORDS ? `Only ${customLpCountData.count} words match — try different settings.` : `${customLpCountData.count} words match ✓`}
                </p>
              )}
              {!customPlayParams.survival && (
                <>
                  <div>
                    <label className="text-sm font-medium">Words to find</label>
                    <Input
                      type="number" min={1} max={50} placeholder="20"
                      className="mt-1 h-8 text-sm w-24"
                      data-testid="input-custom-lp-word-count"
                      value={customPlayParams.wordCount ?? ""}
                      onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Time limit</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {[60, 90, 120, 180, 300].map(t => (
                        <Button key={t} type="button" size="sm"
                          variant={(customPlayParams.timeLimit ?? 120) === t ? "default" : "outline"}
                          onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                          data-testid={`button-custom-lp-time-${t}`}
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
                  value={customPlayParams.challenge !== undefined ? String(customPlayParams.challenge) : "random"}
                  onValueChange={(v) => {
                    if (v === "random") {
                      setCustomPlayParams(p => { const n = { ...p }; delete n.challenge; delete n.letters; return n; });
                    } else {
                      const c = Number(v);
                      setCustomPlayParams(p => ({ ...p, challenge: c, letters: Array(c + 1).fill("any") }));
                    }
                  }}
                >
                  <SelectTrigger className="mt-1" data-testid="select-custom-challenge">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Auto</SelectItem>
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>{n + 1} letters</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {typeof customPlayParams.challenge === "number" && (
                <div>
                  <label className="text-sm font-medium">Pin Letters (optional)</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {Array.from({ length: customPlayParams.challenge + 1 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                        <Select
                          value={(customPlayParams.letters?.[i]) || "any"}
                          onValueChange={(v) => setCustomPlayParams(p => {
                            const letters = [...(p.letters ?? Array(p.challenge + 1).fill("any"))];
                            letters[i] = v;
                            return { ...p, letters };
                          })}
                        >
                          <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-custom-hunt-letter-${i}`}><SelectValue /></SelectTrigger>
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
              {!customPlayParams.survival && (
                <>
                  <div>
                    <label className="text-sm font-medium">Words to find</label>
                    <Input
                      type="number" min={1} max={50} placeholder="20"
                      className="mt-1 h-8 text-sm w-24"
                      data-testid="input-custom-hunt-word-count"
                      value={customPlayParams.wordCount ?? ""}
                      onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Time limit</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {[60, 90, 120, 180, 300].map(t => (
                        <Button key={t} type="button" size="sm"
                          variant={(customPlayParams.timeLimit ?? 120) === t ? "default" : "outline"}
                          onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                          data-testid={`button-custom-hunt-time-${t}`}
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
            <WordExamplesPanel
              game="letter-hunt"
              letters={(customPlayParams.letters ?? []).filter((l: string) => l && l !== "any")}
              buttonLabel="Preview sample words"
            />
          )}

          {slug === "letter-dodge" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Difficulty (forbidden letters)</label>
                <Select
                  value={customPlayParams.difficulty !== undefined ? String(customPlayParams.difficulty) : "auto"}
                  onValueChange={(v) => {
                    if (v === "auto") {
                      setCustomPlayParams(p => { const n = { ...p }; delete n.difficulty; delete n.letters; return n; });
                    } else if (v === "advanced") {
                      setCustomPlayParams(p => ({ ...p, difficulty: "advanced" as const, letters: undefined }));
                    } else if (v === "savant") {
                      setCustomPlayParams(p => ({ ...p, difficulty: "savant" as const, letters: undefined }));
                    } else {
                      const c = Number(v) as 1 | 2 | 3 | 4 | 5;
                      setCustomPlayParams(p => ({ ...p, difficulty: c, letters: Array(c).fill("any") }));
                    }
                  }}
                >
                  <SelectTrigger className="mt-1" data-testid="select-custom-dodge-difficulty">
                    <SelectValue placeholder="Auto (random)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (random)</SelectItem>
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
              {typeof customPlayParams.difficulty === "number" && (
                <div>
                  <label className="text-sm font-medium">Pin Forbidden Letters (optional)</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {Array.from({ length: customPlayParams.difficulty }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                        <Select
                          value={(customPlayParams.letters?.[i]) || "any"}
                          onValueChange={(v) => setCustomPlayParams(p => {
                            const letters = [...(p.letters ?? Array(p.difficulty as number).fill("any"))];
                            letters[i] = v;
                            return { ...p, letters };
                          })}
                        >
                          <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-custom-dodge-letter-${i}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Each slot can be "Any" or a specific letter to always avoid.</p>
                </div>
              )}
              {!customPlayParams.survival && (
                <>
                  <div>
                    <label className="text-sm font-medium">Words to submit</label>
                    <Input
                      type="number" min={1} max={50} placeholder="20"
                      className="mt-1 h-8 text-sm w-24"
                      data-testid="input-custom-dodge-word-count"
                      value={customPlayParams.wordCount ?? ""}
                      onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Time limit</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {[60, 90, 120, 180, 300].map(t => (
                        <Button key={t} type="button" size="sm"
                          variant={(customPlayParams.timeLimit ?? 90) === t ? "default" : "outline"}
                          onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                          data-testid={`button-custom-dodge-time-${t}`}
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

          {slug === "letter-dodge" && (
            <WordExamplesPanel
              game="letter-dodge"
              letters={(customPlayParams.letters ?? []).filter((l: string) => l && l !== "any")}
              buttonLabel="Preview sample words"
            />
          )}

          {slug === "letter-frequency" && (
            <>
              <div>
                <label className="text-sm font-medium">Frequency Challenge</label>
                <Select
                  value={customPlayParams.challenge !== undefined ? String(customPlayParams.challenge) : "0"}
                  onValueChange={(v) => {
                    const c = v === "multi" ? "multi" : Number(v);
                    setCustomPlayParams(p => {
                      let newLetter = p.letter;
                      if (c === "multi") {
                        newLetter = undefined;
                      } else if (typeof c === "number" && c >= 1 && c <= 4 && p.letter) {
                        const validLetters = getLettersForCount(LETTER_FREQUENCY_CHALLENGE_COUNTS[c as 1 | 2 | 3 | 4]);
                        if (!validLetters.includes(p.letter)) newLetter = undefined;
                      }
                      return { ...p, challenge: c === 0 ? undefined : c, letter: newLetter, letters: c !== "multi" ? undefined : (p.letters ?? ["any", "any"]), letterCounts: c !== "multi" ? undefined : (p.letterCounts ?? [2, 2]) };
                    });
                  }}
                >
                  <SelectTrigger className="mt-1" data-testid="select-custom-challenge">
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
              {customPlayParams.challenge === "multi" && (
                <div>
                  <label className="text-sm font-medium">Pin Letters (optional)</label>
                  <div className="flex gap-1 mt-1 mb-2">
                    {[2, 3].map(n => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={(customPlayParams.letters?.length ?? 2) === n ? "default" : "outline"}
                        onClick={() => setCustomPlayParams(p => {
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
                        data-testid={`button-custom-freq-multi-count-${n}`}
                      >
                        {n} letters
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {Array.from({ length: customPlayParams.letters?.length ?? 2 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                        <Select
                          value={(customPlayParams.letters?.[i]) || "any"}
                          onValueChange={(v) => setCustomPlayParams(p => {
                            const letters = [...(p.letters ?? Array(2).fill("any"))];
                            letters[i] = v;
                            return { ...p, letters };
                          })}
                        >
                          <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-custom-freq-multi-${i}`}><SelectValue /></SelectTrigger>
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
                              variant={(customPlayParams.letterCounts?.[i] ?? 2) === cnt ? "default" : "outline"}
                              className="h-6 w-6 p-0 text-xs"
                              onClick={() => setCustomPlayParams(p => {
                                const counts = [...(p.letterCounts ?? Array(p.letters?.length ?? 2).fill(2))];
                                counts[i] = cnt;
                                return { ...p, letterCounts: counts };
                              })}
                              data-testid={`button-custom-freq-multi-lcount-${i}-${cnt}`}
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
              {customPlayParams.challenge !== "multi" && customPlayParams.challenge !== undefined && (
                <div>
                  <label className="text-sm font-medium">Specific Letter (optional)</label>
                  {(() => {
                    const c = customPlayParams.challenge;
                    const validLetters = (typeof c === "number" && c >= 1 && c <= 4)
                      ? getLettersForCount(LETTER_FREQUENCY_CHALLENGE_COUNTS[c as 1 | 2 | 3 | 4])
                      : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
                    return (
                      <Select
                        value={customPlayParams.letter ?? "any"}
                        onValueChange={(v) => setCustomPlayParams(p => ({ ...p, letter: v === "any" ? undefined : v }))}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-custom-lh-letter">
                          <SelectValue placeholder="Any compatible letter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any compatible letter</SelectItem>
                          {validLetters.map(l => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </div>
              )}
              {!customPlayParams.survival && (
                <>
                  <div>
                    <label className="text-sm font-medium">Words to find</label>
                    <Input
                      type="number" min={1} max={50} placeholder="20"
                      className="mt-1 h-8 text-sm w-24"
                      data-testid="input-custom-freq-word-count"
                      value={customPlayParams.wordCount ?? ""}
                      onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Time limit</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {[60, 90, 120, 180, 300].map(t => (
                        <Button key={t} type="button" size="sm"
                          variant={(customPlayParams.timeLimit ?? 120) === t ? "default" : "outline"}
                          onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                          data-testid={`button-custom-freq-time-${t}`}
                        >
                          {t < 60 ? `${t}s` : `${t / 60}min`}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {slug === "letter-balance" && (() => {
            const isStructural = lbCustomMode === "structural";
            const structuralCats = [
              { id: "start_end_vowel", name: "Start & End Vowels", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
              { id: "start_end_consonant", name: "Start & End Consonants", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
              { id: "start_vowel_end_consonant", name: "Start Vowel, End Consonant", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
              { id: "start_consonant_end_vowel", name: "Start Consonant, End Vowel", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
              { id: "locked_balance", name: "Locked Balance", levelType: "length", levels: [] as number[] },
            ];
            const selectedCat = structuralCats.find(c => c.id === customPlayParams.category);
            return (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Challenge type</label>
                  <div className="flex gap-2 mt-1">
                    <Button type="button" size="sm"
                      variant={!isStructural ? "default" : "outline"}
                      onClick={() => { setLbCustomMode("count"); setCustomPlayParams(({ category: _c, level: _l, consonantCount: _cc, ...rest }) => rest); }}
                      data-testid="button-custom-lb-mode-count"
                    >
                      Count-based
                    </Button>
                    <Button type="button" size="sm"
                      variant={isStructural ? "default" : "outline"}
                      onClick={() => { setLbCustomMode("structural"); setCustomPlayParams(({ vowels: _v, consonants: _co, length: _l, ...rest }) => rest); }}
                      data-testid="button-custom-lb-mode-structural"
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
                          data-testid="input-custom-lb-vowels"
                          value={customPlayParams.vowels ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? undefined : Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                            setCustomPlayParams(p => {
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
                          data-testid="input-custom-lb-consonants"
                          value={customPlayParams.consonants ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? undefined : Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                            setCustomPlayParams(p => {
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
                          {customPlayParams.vowels !== undefined && customPlayParams.consonants !== undefined ? "Length (auto)" : "Length (opt.)"}
                        </label>
                        <Input
                          type="number" min={3} max={15} placeholder="Any"
                          className="mt-1 h-8 text-sm"
                          data-testid="input-custom-lb-length"
                          disabled={customPlayParams.vowels !== undefined && customPlayParams.consonants !== undefined}
                          value={customPlayParams.length ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? undefined : Math.min(15, Math.max(3, parseInt(e.target.value) || 3));
                            setCustomPlayParams(p => ({ ...p, length: v }));
                          }}
                        />
                      </div>
                    </div>
                    {customPlayParams.vowels === undefined && customPlayParams.consonants === undefined && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Set at least vowels or consonants to start playing.</p>
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
                            variant={customPlayParams.category === cat.id ? "default" : "outline"}
                            className="justify-start text-left h-auto py-1.5 px-2.5 text-xs"
                            onClick={() => cat.id === "locked_balance"
                              ? setCustomPlayParams(p => ({ ...p, category: cat.id, level: undefined, consonantCount: undefined }))
                              : setCustomPlayParams(p => ({ ...p, category: cat.id, level: cat.levels[0], consonantCount: undefined }))
                            }
                            data-testid={`button-custom-lb-cat-${cat.id}`}
                          >
                            {cat.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {customPlayParams.category === "locked_balance" ? (
                      <>
                        <div>
                          <label className="text-sm font-medium">Word length</label>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {[4,5,6,7,8,9,10].map(lv => (
                              <Button key={lv} type="button" size="sm"
                                variant={customPlayParams.level === lv ? "default" : "outline"}
                                onClick={() => setCustomPlayParams(p => ({ ...p, level: lv, consonantCount: undefined }))}
                                data-testid={`button-custom-lb-level-${lv}`}
                              >
                                {lv}
                              </Button>
                            ))}
                          </div>
                        </div>
                        {customPlayParams.level !== undefined && (
                          <div>
                            <label className="text-sm font-medium">Consonant count <span className="text-xs font-normal text-muted-foreground">(vowels = {customPlayParams.level} − count)</span></label>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {Array.from({ length: customPlayParams.level - 1 }, (_, i) => i + 1).map(c => {
                                const v = customPlayParams.level - c;
                                return (
                                  <Button key={c} type="button" size="sm"
                                    variant={customPlayParams.consonantCount === c ? "default" : "outline"}
                                    onClick={() => setCustomPlayParams(p => ({ ...p, consonantCount: c }))}
                                    data-testid={`button-custom-lb-consonant-${c}`}
                                    title={`${c}C / ${v}V`}
                                  >
                                    {c}C/{v}V
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {(!customPlayParams.level || !customPlayParams.consonantCount) && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {!customPlayParams.level ? "Pick a word length." : "Pick a consonant count."}
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
                              key={lv}
                              type="button"
                              size="sm"
                              variant={customPlayParams.level === lv ? "default" : "outline"}
                              onClick={() => setCustomPlayParams(p => ({ ...p, level: lv }))}
                              data-testid={`button-custom-lb-level-${lv}`}
                            >
                              {lv}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {!customPlayParams.category && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Pick a category to start playing.</p>
                    )}
                  </>
                )}
                {!customPlayParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to find</label>
                      <Input
                        type="number" min={1} max={50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-custom-lb-word-count"
                        value={customPlayParams.wordCount ?? ""}
                        onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Time limit</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[60, 90, 120, 180, 300].map(t => (
                          <Button key={t} type="button" size="sm"
                            variant={(customPlayParams.timeLimit ?? 120) === t ? "default" : "outline"}
                            onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                            data-testid={`button-custom-lb-time-${t}`}
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
                      variant={customPlayParams.length === n ? "default" : "outline"}
                      onClick={() => setCustomPlayParams(p => ({ ...p, length: n }))}
                      data-testid={`button-custom-wl-length-${n}`}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
              {customPlayParams.length && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-medium">Starts with</label>
                      <Select
                        value={customPlayParams.startsWith ?? "any"}
                        onValueChange={(v) => setCustomPlayParams(p => ({ ...p, startsWith: v === "any" ? undefined : v }))}
                      >
                        <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-custom-wl-starts"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Ends with</label>
                      <Select
                        value={customPlayParams.endsWith ?? "any"}
                        onValueChange={(v) => setCustomPlayParams(p => ({ ...p, endsWith: v === "any" ? undefined : v }))}
                      >
                        <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-custom-wl-ends"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Contains</label>
                      <Select
                        value={customPlayParams.contains ?? "any"}
                        onValueChange={(v) => setCustomPlayParams(p => ({ ...p, contains: v === "any" ? undefined : v }))}
                      >
                        <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-custom-wl-contains"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className={`text-xs ${wlCustomCountFetching ? "text-muted-foreground" : !wlCustomCountData ? "" : !wlCustomCountData.ok ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-wl-custom-word-count">
                    {wlCustomCountFetching ? "Checking…" : !wlCustomCountData ? "" : !wlCustomCountData.ok ? `Only ${wlCustomCountData.count} matching words — need at least ${WL_MIN_WORDS}. Adjust filters.` : `${wlCustomCountData.count} words match ✓`}
                  </p>
                </>
              )}
              {!customPlayParams.survival && (
                <>
                  <div>
                    <label className="text-sm font-medium">Words to find</label>
                    <Input
                      type="number" min={1} max={wlCustomCountData?.count ?? 50} placeholder="20"
                      className="mt-1 h-8 text-sm w-24"
                      data-testid="input-custom-wl-word-count"
                      value={customPlayParams.wordCount ?? ""}
                      onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(wlCustomCountData?.count ?? 50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Time limit</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {[60, 90, 120, 180, 300].map(t => (
                        <Button key={t} type="button" size="sm"
                          variant={(customPlayParams.timeLimit ?? 120) === t ? "default" : "outline"}
                          onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                          data-testid={`button-custom-wl-time-${t}`}
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

          {(
            <div>
              <label className="text-sm font-medium">Mode</label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={!customPlayParams.survival ? "default" : "outline"}
                  onClick={() => setCustomPlayParams(p => { const n = { ...p }; delete n.survival; return n; })}
                  data-testid="button-custom-mode-classic"
                >
                  Classic
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={customPlayParams.survival ? "default" : "outline"}
                  onClick={() => setCustomPlayParams(({ wordCount: _wc, timeLimit: _tl, ...rest }) => ({ ...rest, survival: true }))}
                  data-testid="button-custom-mode-survival"
                >
                  Survival (8s/word)
                </Button>
              </div>
            </div>
          )}

          <Button
            className="w-full gap-2"
            onClick={() => {
              onPlay(customPlayParams);
            }}
            disabled={
              (slug === "letter-balance" && customPlayParams.vowels === undefined && customPlayParams.consonants === undefined && !customPlayParams.category) ||
              (slug === "letter-balance" && customPlayParams.category === "locked_balance" && (!customPlayParams.level || !customPlayParams.consonantCount)) ||
              (slug === "word-length" && (!wlCustomLength || wlCustomCountFetching || !wlCustomCountData || !wlCustomCountData.ok)) ||
              (slug === "letter-position" && (!customLpLetter || !customLpPosition || customLpCountFetching || !customLpCountData || customLpCountData.count < LP_QUIZ_MIN_WORDS))
            }
            data-testid="button-start-custom-play"
          >
            <Play className="h-4 w-4" />
            Play Custom Game
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
