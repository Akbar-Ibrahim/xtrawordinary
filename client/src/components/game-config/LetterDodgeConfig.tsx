import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GameConfigProps } from "./types";

export function LetterDodgeConfig({ params, setParams, dialogType }: GameConfigProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Difficulty (forbidden letters)</label>
        <Select
          value={params.difficulty !== undefined ? String(params.difficulty) : "auto"}
          onValueChange={(v) => {
            if (v === "auto") {
              setParams(p => { const n = { ...p }; delete n.difficulty; delete n.letters; return n; });
            } else if (v === "advanced") {
              setParams(p => ({ ...p, difficulty: "advanced" as const, letters: undefined }));
            } else if (v === "savant") {
              setParams(p => ({ ...p, difficulty: "savant" as const, letters: undefined }));
            } else {
              const c = Number(v) as 1 | 2 | 3 | 4 | 5;
              setParams(p => ({ ...p, difficulty: c, letters: Array(c).fill("any") }));
            }
          }}
        >
          <SelectTrigger className="mt-1" data-testid={`select-${dialogType}-dodge-difficulty`}>
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
      {typeof params.difficulty === "number" && (
        <div>
          <label className="text-sm font-medium">Pin Forbidden Letters (optional)</label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {Array.from({ length: params.difficulty }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                <Select
                  value={(params.letters?.[i]) || "any"}
                  onValueChange={(v) => setParams(p => {
                    const letters = [...(p.letters ?? Array(p.difficulty as number).fill("any"))];
                    letters[i] = v;
                    return { ...p, letters };
                  })}
                >
                  <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-${dialogType}-dodge-letter-${i}`}><SelectValue /></SelectTrigger>
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
      {!params.survival && (
        <>
          <div>
            <label className="text-sm font-medium">Words to submit</label>
            <Input
              type="number" min={1} max={50} placeholder="20"
              className="mt-1 h-8 text-sm w-24"
              data-testid={`input-${dialogType}-dodge-word-count`}
              value={params.wordCount ?? ""}
              onChange={(e) => setParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Time limit</label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {[60, 90, 120, 180, 300].map(t => (
                <Button key={t} type="button" size="sm"
                  variant={(params.timeLimit ?? 90) === t ? "default" : "outline"}
                  onClick={() => setParams(p => ({ ...p, timeLimit: t }))}
                  data-testid={`button-${dialogType}-dodge-time-${t}`}
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
