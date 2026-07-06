import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import type { GameConfigProps } from "./types";

export function ProgressiveRevealConfig({ params, setParams, dialogType, open }: GameConfigProps) {
  const [prWord, setPrWord] = useState("");

  const prWordKey = (open && prWord.trim().length >= 2) ? prWord.trim().toUpperCase() : "";
  const { data: prWordValid, isFetching: prWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", prWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(prWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!prWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const prEntries: Array<{ word: string; subcategory: string }> = Array.isArray(params.words) ? params.words : [];
  const addPrWord = () => {
    const w = prWord.trim().toUpperCase();
    if (!w || prEntries.some(e => e.word === w)) return;
    setParams(p => ({ ...p, words: [...prEntries, { word: w, subcategory: "Custom" }] }));
    setPrWord("");
  };

  const prefix = dialogType === "season" ? "season-" : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Words to Guess</label>
        <span className="text-xs text-muted-foreground">{prEntries.length}/20</span>
      </div>
      {prEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {prEntries.map((entry, i) => (
            <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`${prefix}pr-entry-${i}`}>
              <span className="text-sm font-mono font-bold tracking-wider">{entry.word}</span>
              <button
                type="button"
                onClick={() => setParams(p => ({ ...p, words: prEntries.filter((_, j) => j !== i) }))}
                className="text-muted-foreground hover:text-destructive ml-1"
                data-testid={`button-${prefix}pr-remove-${i}`}
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
              data-testid={`input-${prefix}pr-word`}
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
          <Button type="button" size="sm" disabled={!prWord.trim() || prEntries.some(e => e.word === prWord.trim().toUpperCase())} onClick={addPrWord} data-testid={`button-${prefix}pr-add`}>
            Add
          </Button>
        </div>
      )}
      {prEntries.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word so players know what to guess.</p>
      )}
    </div>
  );
}
