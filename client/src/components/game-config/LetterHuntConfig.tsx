import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GameConfigProps } from "./types";

export function LetterHuntConfig({ params, setParams, dialogType }: GameConfigProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Letter Count</label>
        <Select
          value={params.challenge !== undefined ? String(params.challenge) : "auto"}
          onValueChange={(v) => {
            if (v === "auto") {
              setParams(p => { const n = { ...p }; delete n.challenge; delete n.letters; return n; });
            } else {
              const c = Number(v);
              setParams(p => ({ ...p, challenge: c, letters: Array(c + 1).fill("any") }));
            }
          }}
        >
          <SelectTrigger className="mt-1" data-testid={`select-${dialogType}-hunt-challenge`}>
            <SelectValue placeholder="Auto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            {[1, 2, 3, 4, 5].map(n => (
              <SelectItem key={n} value={String(n)} data-testid={`select-${dialogType}-hunt-challenge-${n}`}>{n + 1} letters</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {typeof params.challenge === "number" && (
        <div>
          <label className="text-sm font-medium">Pin Letters (optional)</label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {Array.from({ length: params.challenge + 1 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                <Select
                  value={(params.letters?.[i]) || "any"}
                  onValueChange={(v) => setParams(p => {
                    const letters = [...(p.letters ?? Array(p.challenge + 1).fill("any"))];
                    letters[i] = v;
                    return { ...p, letters };
                  })}
                >
                  <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-${dialogType}-hunt-letter-${i}`}><SelectValue /></SelectTrigger>
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
      {!params.survival && (
        <>
          <div>
            <label className="text-sm font-medium">Words to find</label>
            <Input
              type="number" min={1} max={50} placeholder="20"
              className="mt-1 h-8 text-sm w-24"
              data-testid={`input-${dialogType}-hunt-word-count`}
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
                  data-testid={`button-${dialogType}-hunt-time-${t}`}
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
