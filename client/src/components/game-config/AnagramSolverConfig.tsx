import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import type { GameConfigProps } from "./types";

export function AnagramSolverConfig({ params, setParams, dialogType, open }: GameConfigProps) {
  const [asWord, setAsWord] = useState("");

  const asWordKey = (open && asWord.trim().length >= 2) ? asWord.trim().toUpperCase() : "";
  const { data: asWordValid, isFetching: asWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", asWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(asWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!asWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const asEntries: Array<{ original: string; anagrams: string[] }> = Array.isArray(params.words) ? params.words : [];
  const addAsWord = () => {
    const w = asWord.trim().toUpperCase();
    if (!w || asEntries.some(e => e.original === w)) return;
    setParams(p => ({ ...p, words: [...asEntries, { original: w, anagrams: [w] }] }));
    setAsWord("");
  };

  const prefix = dialogType === "season" ? "season-" : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Words to Unscramble</label>
        <span className="text-xs text-muted-foreground">{asEntries.length}/20</span>
      </div>
      {asEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {asEntries.map((entry, i) => (
            <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`${prefix}as-entry-${i}`}>
              <span className="text-sm font-mono font-bold tracking-wider">{entry.original}</span>
              <button type="button" onClick={() => setParams(p => ({ ...p, words: asEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive" data-testid={`button-${prefix}as-remove-${i}`}>
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
              data-testid={`input-${prefix}as-word`}
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
          <Button type="button" size="sm" disabled={!asWord.trim() || asEntries.some(e => e.original === asWord.trim().toUpperCase())} onClick={addAsWord} data-testid={`button-${prefix}as-add`}>Add</Button>
        </div>
      )}
      {asEntries.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word. Players will see the letters scrambled and must type the answer.</p>
      )}
    </div>
  );
}
