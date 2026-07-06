import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLettersForCount, LETTER_FREQUENCY_CHALLENGE_COUNTS } from "@/components/games/letter-frequency";
import type { GameConfigProps } from "./types";

export function LetterFrequencyConfig({ params, setParams, dialogType }: GameConfigProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Frequency Challenge</label>
        <Select
          value={params.challenge !== undefined ? String(params.challenge) : "0"}
          onValueChange={(v) => {
            const c = v === "multi" ? "multi" : Number(v);
            setParams(p => ({
              ...p,
              challenge: c === 0 ? undefined : c,
              letter: c === "multi" ? undefined : p.letter,
              letters: c !== "multi" ? undefined : (p.letters ?? ["any", "any"]),
              letterCounts: c !== "multi" ? undefined : (p.letterCounts ?? [2, 2]),
            }));
          }}
        >
          <SelectTrigger className="mt-1" data-testid={`select-${dialogType}-freq-challenge`}>
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
      {params.challenge === "multi" && (
        <div>
          <label className="text-sm font-medium">Pin Letters (optional)</label>
          <div className="flex gap-1 mt-1 mb-2">
            {[2, 3].map(n => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={(params.letters?.length ?? 2) === n ? "default" : "outline"}
                onClick={() => setParams(p => {
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
                data-testid={`button-${dialogType}-freq-multi-count-${n}`}
              >
                {n} letters
              </Button>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap">
            {Array.from({ length: params.letters?.length ?? 2 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                <Select
                  value={(params.letters?.[i]) || "any"}
                  onValueChange={(v) => setParams(p => {
                    const letters = [...(p.letters ?? Array(2).fill("any"))];
                    letters[i] = v;
                    return { ...p, letters };
                  })}
                >
                  <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-${dialogType}-freq-multi-${i}`}><SelectValue /></SelectTrigger>
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
                      variant={(params.letterCounts?.[i] ?? 2) === cnt ? "default" : "outline"}
                      className="h-6 w-6 p-0 text-xs"
                      onClick={() => setParams(p => {
                        const counts = [...(p.letterCounts ?? Array(p.letters?.length ?? 2).fill(2))];
                        counts[i] = cnt;
                        return { ...p, letterCounts: counts };
                      })}
                      data-testid={`button-${dialogType}-freq-multi-lcount-${i}-${cnt}`}
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
      {params.challenge && params.challenge !== "multi" && (
        <div>
          <label className="text-sm font-medium">Specific Letter (optional)</label>
          {(() => {
            const c = params.challenge;
            const validLetters = (typeof c === "number" && c >= 1 && c <= 4)
              ? getLettersForCount(LETTER_FREQUENCY_CHALLENGE_COUNTS[c as 1 | 2 | 3 | 4])
              : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
            return (
              <Select
                value={params.letter ?? "any"}
                onValueChange={(v) => setParams(p => ({ ...p, letter: v === "any" ? undefined : v }))}
              >
                <SelectTrigger className="mt-1" data-testid={`select-${dialogType}-freq-letter`}>
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
      {!params.survival && (
        <>
          <div>
            <label className="text-sm font-medium">Words to find</label>
            <Input
              type="number" min={1} max={50} placeholder="20"
              className="mt-1 h-8 text-sm w-24"
              data-testid={`input-${dialogType}-freq-word-count`}
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
                  data-testid={`button-${dialogType}-freq-time-${t}`}
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
