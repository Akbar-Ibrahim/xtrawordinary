import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { GameConfigProps } from "./types";
import { WordExamplesPanel } from "@/components/word-examples-panel";

const NR_CHALLENGES = [3, 4, 5, 6, 7, 8, 9] as const;
type NrChallenge = typeof NR_CHALLENGES[number];

function reqLetterCount(challenge: NrChallenge): number {
  if (challenge <= 3) return 1;
  if (challenge <= 6) return 2;
  return 3;
}

export function NoRepeatsConfig({ params, setParams, dialogType }: GameConfigProps) {
  const challenge = params.challenge as NrChallenge | undefined;
  const slotCount  = challenge !== undefined ? reqLetterCount(challenge) : 0;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Challenge Level</label>
        <Select
          value={challenge !== undefined ? String(challenge) : "auto"}
          onValueChange={(v) => {
            if (v === "auto") {
              setParams(p => { const n = { ...p }; delete n.challenge; delete n.requiredLetters; return n; });
            } else {
              const c = Number(v) as NrChallenge;
              setParams(p => ({ ...p, challenge: c, requiredLetters: Array(reqLetterCount(c)).fill("any") }));
            }
          }}
        >
          <SelectTrigger className="mt-1" data-testid={`select-${dialogType}-nr-challenge`}>
            <SelectValue placeholder="Auto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            {NR_CHALLENGES.map(n => (
              <SelectItem key={n} value={String(n)} data-testid={`select-${dialogType}-nr-challenge-${n}`}>
                {n}-letter isograms
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {challenge !== undefined && slotCount > 0 && (
        <div>
          <label className="text-sm font-medium">Pin Required Letters <span className="text-muted-foreground font-normal">(optional)</span></label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {Array.from({ length: slotCount }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                <Select
                  value={(params.requiredLetters?.[i]) || "any"}
                  onValueChange={(v) => setParams(p => {
                    const letters = [...(p.requiredLetters ?? Array(slotCount).fill("any"))];
                    letters[i] = v;
                    return { ...p, requiredLetters: letters };
                  })}
                >
                  <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-${dialogType}-nr-req-${i}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">"Any" lets the game pick that letter randomly.</p>
        </div>
      )}

      {challenge !== undefined && (
        <WordExamplesPanel
          game="no-repeats"
          letters={params.requiredLetters ?? []}
          challenge={challenge}
          limit={10}
          buttonLabel="Preview example words"
        />
      )}

      {!params.survival && (
        <div>
          <label className="text-sm font-medium">Time limit</label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {[60, 90, 120, 180, 300].map(t => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={(params.timeLimit ?? 120) === t ? "default" : "outline"}
                onClick={() => setParams(p => ({ ...p, timeLimit: t }))}
                data-testid={`button-${dialogType}-nr-time-${t}`}
              >
                {t < 60 ? `${t}s` : `${t / 60}min`}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
