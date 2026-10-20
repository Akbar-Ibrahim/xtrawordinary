import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SURVIVAL_SUGGESTION_WORD_THRESHOLD = 100;

interface SurvivalSuggestionProps {
  placement: "completion" | "replay";
  onTrySurvival: () => void;
}

export function SurvivalSuggestion({
  placement,
  onTrySurvival,
}: SurvivalSuggestionProps) {
  const isCompletion = placement === "completion";

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
      data-testid={`survival-suggestion-${placement}`}
      role="region"
      aria-label="Try Survival mode"
    >
      <div className="flex items-start gap-3">
        <Flame className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold">
            {isCompletion
              ? `You smashed ${SURVIVAL_SUGGESTION_WORD_THRESHOLD} words!`
              : `You’ve reached ${SURVIVAL_SUGGESTION_WORD_THRESHOLD} words in this game before.`}
          </p>
          <p className="text-sm text-muted-foreground">
            Want more of a challenge? Give Survival a try.
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 border-orange-500/40 hover:bg-orange-500/10"
        onClick={onTrySurvival}
        data-testid={`button-try-survival-${placement}`}
      >
        Try Survival
      </Button>
    </div>
  );
}
