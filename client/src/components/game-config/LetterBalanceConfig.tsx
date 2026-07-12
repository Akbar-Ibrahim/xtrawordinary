import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GameConfigProps } from "./types";

const STRUCTURAL_CATS = [
  { id: "consonant_count", name: "Consonant Count", levelType: "count", levels: [2,3,4,5,6,7,"advanced"] as (number | "advanced")[] },
  { id: "vowel_count", name: "Vowel Count", levelType: "count", levels: [2,3,4,5,6,7,"advanced"] as (number | "advanced")[] },
  { id: "start_end_vowel", name: "Start & End Vowels", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
  { id: "start_end_consonant", name: "Start & End Consonants", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
  { id: "start_vowel_end_consonant", name: "Start Vowel, End Consonant", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
  { id: "start_consonant_end_vowel", name: "Start Consonant, End Vowel", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
  { id: "locked_balance", name: "Locked Balance", levelType: "length", levels: [] as number[] },
];

export function LetterBalanceConfig({ params, setParams, dialogType }: GameConfigProps) {
  const [lbMode, setLbMode] = useState<"count" | "structural">("count");
  const isStructural = lbMode === "structural";
  const pfx = dialogType === "quiz" ? "quiz" : "season";
  const selectedCat = STRUCTURAL_CATS.find(c => c.id === params.category);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">{dialogType === "quiz" ? "Challenge type" : "Mode"}</label>
        <div className="flex gap-2 mt-1">
          <Button
            type="button" size="sm"
            variant={!isStructural ? "default" : "outline"}
            onClick={() => {
              setLbMode("count");
              setParams(p => { const n = { ...p }; delete n.category; delete n.level; delete n.consonantCount; return n; });
            }}
            data-testid={`button-${pfx}-lb-mode-count`}
          >
            {dialogType === "quiz" ? "Count-based" : "Vowel/Consonant Count"}
          </Button>
          <Button
            type="button" size="sm"
            variant={isStructural ? "default" : "outline"}
            onClick={() => {
              setLbMode("structural");
              setParams(p => { const n = { ...p }; delete n.vowels; delete n.consonants; delete n.length; return n; });
            }}
            data-testid={`button-${pfx}-lb-mode-structural`}
          >
            Structural
          </Button>
        </div>
      </div>

      {!isStructural ? (
        dialogType === "quiz" ? (
          <>
            <p className="text-xs text-muted-foreground">Set vowel and/or consonant counts (at least one required). Length is optional.</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium">Vowels</label>
                <Input
                  type="number" min={1} max={7} placeholder="Any"
                  className="mt-1 h-8 text-sm"
                  data-testid={`input-${pfx}-lb-vowels`}
                  value={params.vowels ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? undefined : Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                    setParams(p => {
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
                  data-testid={`input-${pfx}-lb-consonants`}
                  value={params.consonants ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? undefined : Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                    setParams(p => {
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
                  {params.vowels !== undefined && params.consonants !== undefined ? "Length (auto)" : "Length (opt.)"}
                </label>
                <Input
                  type="number" min={3} max={15} placeholder="Any"
                  className="mt-1 h-8 text-sm"
                  data-testid={`input-${pfx}-lb-length`}
                  disabled={params.vowels !== undefined && params.consonants !== undefined}
                  value={params.length ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? undefined : Math.min(15, Math.max(3, parseInt(e.target.value) || 3));
                    setParams(p => ({ ...p, length: v }));
                  }}
                />
              </div>
            </div>
            {params.vowels === undefined && params.consonants === undefined && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Set at least vowels or consonants to configure this quiz.</p>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium">Vowels</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {[0,1,2,3,4,5,6].map(v => (
                  <Button key={v} type="button" size="sm"
                    variant={params.vowels === v ? "default" : "outline"}
                    onClick={() => setParams(p => ({ ...p, vowels: v }))}
                    data-testid={`button-${pfx}-lb-vowels-${v}`}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Consonants</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {[0,1,2,3,4,5,6,7,8].map(c => (
                  <Button key={c} type="button" size="sm"
                    variant={params.consonants === c ? "default" : "outline"}
                    onClick={() => setParams(p => ({ ...p, consonants: c }))}
                    data-testid={`button-${pfx}-lb-consonants-${c}`}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )
      ) : (
        <>
          <div>
            <label className="text-sm font-medium">Category</label>
            {dialogType === "quiz" ? (
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {STRUCTURAL_CATS.map(cat => (
                  <Button
                    key={cat.id} type="button" size="sm"
                    variant={params.category === cat.id ? "default" : "outline"}
                    className="justify-start text-left h-auto py-1.5 px-2.5 text-xs"
                    onClick={() => cat.id === "locked_balance"
                      ? setParams(p => ({ ...p, category: cat.id, level: undefined, consonantCount: undefined }))
                      : setParams(p => ({ ...p, category: cat.id, level: cat.levels[0], consonantCount: undefined }))
                    }
                    data-testid={`button-${pfx}-lb-cat-${cat.id}`}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            ) : (
              <Select
                value={params.category ?? ""}
                onValueChange={(v) => setParams(p => ({ ...p, category: v, level: undefined, consonantCount: undefined }))}
              >
                <SelectTrigger className="mt-1" data-testid={`select-${pfx}-lb-category`}>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURAL_CATS.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {params.category === "locked_balance" ? (
            <>
              <div>
                <label className="text-sm font-medium">Word length</label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {[4,5,6,7,8,9,10].map(lv => (
                    <Button key={lv} type="button" size="sm"
                      variant={params.level === lv ? "default" : "outline"}
                      onClick={() => setParams(p => ({ ...p, level: lv, consonantCount: undefined }))}
                      data-testid={`button-${pfx}-lb-level-${lv}`}
                    >
                      {lv}
                    </Button>
                  ))}
                </div>
              </div>
              {params.level !== undefined && (
                <div>
                  <label className="text-sm font-medium">
                    Consonant count <span className="text-xs font-normal text-muted-foreground">(vowels = {params.level} − count)</span>
                  </label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {Array.from({ length: params.level - 1 }, (_, i) => i + 1).map(c => {
                      const v = params.level - c;
                      return (
                        <Button key={c} type="button" size="sm"
                          variant={params.consonantCount === c ? "default" : "outline"}
                          onClick={() => setParams(p => ({ ...p, consonantCount: c }))}
                          data-testid={`button-${pfx}-lb-consonant-${c}`}
                          title={`${c}C / ${v}V`}
                        >
                          {c}C/{v}V
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
              {(!params.level || !params.consonantCount) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {!params.level ? "Pick a word length." : "Pick a consonant count."}
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
                    key={String(lv)} type="button" size="sm"
                    variant={params.level === lv ? "default" : "outline"}
                    className={lv === "advanced" ? "bg-gradient-to-r from-primary to-accent text-primary-foreground border-0" : ""}
                    onClick={() => setParams(p => ({ ...p, level: lv }))}
                    data-testid={`button-${pfx}-lb-level-${lv}`}
                  >
                    {lv === "advanced" ? "Advanced" : lv}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {isStructural && !params.category && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {dialogType === "quiz" ? "Pick a category to configure this quiz." : "Pick a category to configure this round."}
            </p>
          )}
        </>
      )}

      {!params.survival && (
        <>
          <div>
            <label className="text-sm font-medium">Words to find</label>
            <Input
              type="number" min={1} max={50} placeholder="20"
              className="mt-1 h-8 text-sm w-24"
              data-testid={`input-${pfx}-lb-word-count`}
              value={params.wordCount ?? ""}
              onChange={(e) => setParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Time limit</label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {[60, 90, 120, 180, 300].map(t => (
                <Button key={t} type="button" size="sm"
                  variant={(params.timeLimit ?? 120) === t ? "default" : "outline"}
                  onClick={() => setParams(p => ({ ...p, timeLimit: t }))}
                  data-testid={`button-${pfx}-lb-time-${t}`}
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
}
