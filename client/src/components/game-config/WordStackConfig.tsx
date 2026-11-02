import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GameConfigProps } from "./types";

export function WordStackConfig({ params, setParams, dialogType }: GameConfigProps) {
  const selectedChallenge = params.challenge ?? "random";
  const selectedLength = params.puzzleCount ?? "full";
  const prefix = dialogType === "season" ? "season-" : "";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Shared challenge</label>
        <Select
          value={selectedChallenge}
          onValueChange={(challenge) => setParams((current) => {
            const next = { ...current };
            if (challenge === "random") delete next.challenge;
            else next.challenge = challenge;
            return next;
          })}
        >
          <SelectTrigger data-testid={`select-${prefix}word-stack-challenge`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="random">Choose for everyone</SelectItem>
            <SelectItem value="build-up">Build Up</SelectItem>
            <SelectItem value="break-down">Break Down</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          “Choose for everyone” picks a mode from the shared quiz seed.
        </p>
      </div>
      {dialogType === "quiz" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Puzzle count</label>
          <Select
            value={selectedLength}
            onValueChange={(puzzleCount) => setParams((current) => ({ ...current, puzzleCount }))}
          >
            <SelectTrigger data-testid={`select-${prefix}word-stack-puzzle-count`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short (5 puzzles)</SelectItem>
              <SelectItem value="medium">Medium (10 puzzles)</SelectItem>
              <SelectItem value="full">Full puzzle set</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Everyone gets the same number of puzzles in the same seeded order.
          </p>
        </div>
      )}
    </div>
  );
}
