import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertTriangle, X, Pencil } from "lucide-react";
import type { GameConfigProps } from "./types";

type DmEntry = { word: string; partOfSpeech: string; definitions: [string, string, string] };

export function DefinitionMatchConfig({ params, setParams, dialogType, open }: GameConfigProps) {
  const [dmWord, setDmWord] = useState("");
  const [dmPos, setDmPos] = useState("noun");
  const [dmDefs, setDmDefs] = useState(["", "", ""]);
  const [dmEditIndex, setDmEditIndex] = useState<number | null>(null);

  const dmWordKey = (open && dmWord.trim().length >= 2) ? dmWord.trim().toUpperCase() : "";
  const { data: dmWordValid, isFetching: dmWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", dmWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(dmWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!dmWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const dmEntries: DmEntry[] = Array.isArray(params.words) ? params.words : [];
  const isEditing = dmEditIndex !== null;
  const canSave = dmWord.trim().length > 0 && dmDefs[0].trim().length > 0 && dmDefs[1].trim().length > 0 && dmDefs[2].trim().length > 0;
  const saveEntry = () => {
    if (!canSave) return;
    const entry: DmEntry = { word: dmWord.trim().toUpperCase(), partOfSpeech: dmPos, definitions: [dmDefs[0].trim(), dmDefs[1].trim(), dmDefs[2].trim()] };
    if (isEditing) {
      setParams(p => {
        const words = [...(Array.isArray(p.words) ? p.words : [])];
        words[dmEditIndex!] = entry;
        return { ...p, words };
      });
      setDmEditIndex(null);
    } else {
      setParams(p => ({ ...p, words: [...dmEntries, entry] }));
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

  const prefix = dialogType === "season" ? "season-" : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Word Entries</label>
        <span className="text-xs text-muted-foreground">{dmEntries.length}/20</span>
      </div>
      {dmEntries.length > 0 && (
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {dmEntries.map((entry, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 transition-colors ${dmEditIndex === i ? "border-primary bg-primary/5" : "bg-muted/30"}`} data-testid={`${prefix}dm-entry-${i}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold uppercase tracking-wide">{entry.word}</p>
                <p className="text-xs text-muted-foreground">{entry.partOfSpeech} · 3 clues</p>
              </div>
              {dmEditIndex === i ? (
                <span className="text-xs text-primary font-medium self-center px-1">editing…</span>
              ) : (
                <>
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-primary" onClick={() => startEdit(i)} data-testid={`button-${prefix}dm-edit-${i}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setParams(p => ({ ...p, words: dmEntries.filter((_, j) => j !== i) }))} data-testid={`button-${prefix}dm-remove-${i}`}>
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
                data-testid={`input-${prefix}dm-word`}
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
              <SelectTrigger className="w-32 shrink-0" data-testid={`select-${prefix}dm-pos`}>
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
                data-testid={`input-${prefix}dm-def-${i}`}
              />
              <span className={`absolute right-2 top-2 text-[10px] font-semibold px-1 rounded ${i === 0 ? "text-primary/60" : i === 1 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {i === 0 ? "C1" : i === 1 ? "C2" : "C3"}
              </span>
            </div>
          ))}
          <div className="flex gap-2">
            <Button type="button" size="sm" className="flex-1" disabled={!canSave} onClick={saveEntry} data-testid={`button-${prefix}dm-add-entry`}>
              {isEditing ? "Save Changes" : "Add Entry"}
            </Button>
            {isEditing && (
              <Button type="button" size="sm" variant="outline" onClick={cancelEdit} data-testid={`button-${prefix}dm-cancel-edit`}>
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
}
