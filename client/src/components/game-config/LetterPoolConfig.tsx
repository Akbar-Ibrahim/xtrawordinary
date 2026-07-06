import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import type { GameConfigProps } from "./types";

interface LpEntry { word: string; hint: string; category: string; letterPool: string[] }

export function LetterPoolConfig({ params, setParams, dialogType, open }: GameConfigProps) {
  const [lpWord, setLpWord] = useState("");
  const [lpHint, setLpHint] = useState("");
  const [lpCategory, setLpCategory] = useState("");

  const lpWordKey = (open && lpWord.trim().length >= 2) ? lpWord.trim().toUpperCase() : "";
  const { data: lpWordValid, isFetching: lpWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", lpWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(lpWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!lpWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const lpEntries: LpEntry[] = Array.isArray(params.words) ? params.words : [];
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const addLpWord = () => {
    const w = lpWord.trim().toUpperCase();
    if (!w || !lpHint.trim() || lpEntries.some(e => e.word === w)) return;
    const wordLetters = new Set(w.split(""));
    const letterPool = ALPHABET.filter(l => !wordLetters.has(l));
    setParams(p => ({ ...p, words: [...lpEntries, { word: w, hint: lpHint.trim(), category: lpCategory.trim() || "Custom", letterPool }] }));
    setLpWord(""); setLpHint(""); setLpCategory("");
  };

  const entryTestId = (i: number) => dialogType === "season" ? `season-lp-entry-${i}` : `lp-entry-${i}`;
  const removeTestId = (i: number) => dialogType === "season" ? `button-season-lp-remove-${i}` : `button-lp-remove-${i}`;
  const wordTestId = dialogType === "season" ? "input-season-lp-word" : "input-lp-word";
  const hintTestId = dialogType === "season" ? "input-season-lp-hint" : "input-lp-hint";
  const categoryTestId = dialogType === "season" ? "input-season-lp-category" : "input-lp-category";
  const addTestId = dialogType === "season" ? "button-season-lp-add" : "button-lp-add";
  const noun = dialogType === "season" ? "round" : "quiz";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Pool Mode</label>
        <div className="flex gap-2 mt-1">
          {(["with-pool", "without-pool"] as const).map(v => (
            <Button key={v} type="button" size="sm" variant={params.variant === v ? "default" : "outline"} onClick={() => setParams(p => ({ ...p, variant: v }))} data-testid={`button-${dialogType}-pool-${v}`}>
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
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {lpEntries.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5" data-testid={entryTestId(i)}>
                <span className="text-sm font-mono font-bold tracking-wider">{entry.word}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{entry.hint}</span>
                {entry.category !== "Custom" && <span className="text-xs text-muted-foreground shrink-0">({entry.category})</span>}
                <button type="button" onClick={() => setParams(p => ({ ...p, words: lpEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive shrink-0" data-testid={removeTestId(i)}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {lpEntries.length < 20 && (
          <>
            <div className="flex gap-2 items-center">
              <div className="flex flex-1 items-center gap-1">
                <Input placeholder="WORD" value={lpWord} onChange={e => setLpWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())} className="flex-1 font-mono uppercase tracking-wider" maxLength={20} data-testid={wordTestId} />
                <span className="w-5 shrink-0 flex items-center justify-center">
                  {lpWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  {!lpWordValidating && lpWordValid !== undefined && lpWord.trim().length >= 2 && (
                    lpWordValid.exists
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </span>
              </div>
              <Input placeholder="Hint / clue for players" value={lpHint} onChange={e => setLpHint(e.target.value)} className="flex-1" maxLength={100} data-testid={hintTestId} />
            </div>
            <div className="flex gap-2">
              <Input placeholder="Category (optional, e.g. Animals)" value={lpCategory} onChange={e => setLpCategory(e.target.value)} className="flex-1" maxLength={50} data-testid={categoryTestId} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLpWord(); } }} />
              <Button type="button" size="sm" disabled={!lpWord.trim() || !lpHint.trim() || lpEntries.some(e => e.word === lpWord.trim().toUpperCase())} onClick={addLpWord} data-testid={addTestId}>Add</Button>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">Leave empty to use random words, or add specific words for your {noun}.</p>
      </div>
    </div>
  );
}
