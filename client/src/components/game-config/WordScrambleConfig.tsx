import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import type { GameConfigProps } from "./types";

export function WordScrambleConfig({ params, setParams, dialogType, open }: GameConfigProps) {
  const [wsWord, setWsWord] = useState("");
  const [wsCategory, setWsCategory] = useState("");

  const wsWordKey = (open && wsWord.trim().length >= 2) ? wsWord.trim().toUpperCase() : "";
  const { data: wsWordValid, isFetching: wsWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", wsWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(wsWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!wsWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const wsEntries: Array<{ word: string; category: string }> = Array.isArray(params.words) ? params.words : [];
  const addWsWord = () => {
    const w = wsWord.trim().toUpperCase();
    if (!w || wsEntries.some(e => e.word === w)) return;
    setParams(p => ({ ...p, words: [...wsEntries, { word: w, category: wsCategory.trim() || "Custom" }] }));
    setWsWord("");
    setWsCategory("");
  };

  const prefix = dialogType === "season" ? "season-" : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Words to Unscramble</label>
        <span className="text-xs text-muted-foreground">{wsEntries.length}/20</span>
      </div>
      {wsEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {wsEntries.map((entry, i) => (
            <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`${prefix}ws-entry-${i}`}>
              <span className="text-sm font-mono font-bold tracking-wider">{entry.word}</span>
              {entry.category !== "Custom" && <span className="text-xs text-muted-foreground">({entry.category})</span>}
              <button type="button" onClick={() => setParams(p => ({ ...p, words: wsEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive" data-testid={`button-${prefix}ws-remove-${i}`}>
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
                data-testid={`input-${prefix}ws-word`}
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
            <Input placeholder="Category (optional, e.g. Animals)" value={wsCategory} onChange={e => setWsCategory(e.target.value)} className="flex-1" maxLength={50} data-testid={`input-${prefix}ws-category`} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addWsWord(); } }} />
            <Button type="button" size="sm" disabled={!wsWord.trim() || wsEntries.some(e => e.word === wsWord.trim().toUpperCase())} onClick={addWsWord} data-testid={`button-${prefix}ws-add`}>Add</Button>
          </div>
        </div>
      )}
      {wsEntries.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word. Players will see the letters scrambled and must type the answer.</p>
      )}
    </div>
  );
}
