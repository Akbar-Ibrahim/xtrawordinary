import { Button } from "@/components/ui/button";
import type { GameConfigProps } from "./types";

/**
 * Classic vs Survival mode toggle shown for: word-length, letter-hunt, letter-position,
 * letter-frequency, letter-dodge, letter-balance. Identical between QuizCreateDialog and
 * SeasonRoundConfigDialog aside from the data-testid prefix.
 */
export function SurvivalModeToggle({ params, setParams, dialogType }: Pick<GameConfigProps, "params" | "setParams" | "dialogType">) {
  return (
    <div>
      <label className="text-sm font-medium">Mode</label>
      <div className="flex gap-2 mt-1">
        <Button
          type="button"
          size="sm"
          variant={!params.survival ? "default" : "outline"}
          onClick={() => setParams(p => { const n = { ...p }; delete n.survival; return n; })}
          data-testid={`button-${dialogType}-mode-classic`}
        >
          Classic
        </Button>
        <Button
          type="button"
          size="sm"
          variant={params.survival ? "default" : "outline"}
          onClick={() => setParams(({ wordCount: _wc, timeLimit: _tl, ...rest }) => ({ ...rest, survival: true }))}
          data-testid={`button-${dialogType}-mode-survival`}
        >
          Survival (8s/word)
        </Button>
      </div>
    </div>
  );
}
