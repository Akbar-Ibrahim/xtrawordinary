import { Button } from "@/components/ui/button";
import type { LetterFrequencyConstraint, LetterFrequencyMatch } from "../types";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COUNTS = [1, 2, 3, 4, 5, 6];

interface Props {
  constraint: LetterFrequencyConstraint;
  match: LetterFrequencyMatch;
  isSearching: boolean;
  onConstraintChange: (constraint: LetterFrequencyConstraint) => void;
  onMatchChange: (match: LetterFrequencyMatch) => void;
  onSearch: () => void;
}

export function SingleLetterFrequencyControls({
  constraint,
  match,
  isSearching,
  onConstraintChange,
  onMatchChange,
  onSearch,
}: Props) {
  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
    >
      <p className="text-sm text-muted-foreground">
        Set one letter rule. You can explore counts that are not separate gameplay challenges too.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm font-medium">
          Letter
          <select
            aria-label="Letter"
            value={constraint.letter}
            onChange={(event) => onConstraintChange({ ...constraint, letter: event.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2.5"
          >
            {LETTERS.map((letter) => <option key={letter}>{letter}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Count
          <select
            aria-label="Count"
            value={constraint.count}
            onChange={(event) => onConstraintChange({ ...constraint, count: Number(event.target.value) })}
            className="w-full rounded-md border bg-background px-3 py-2.5"
          >
            {COUNTS.map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Match
          <select
            aria-label="Match type"
            value={match}
            onChange={(event) => onMatchChange(event.target.value as LetterFrequencyMatch)}
            className="w-full rounded-md border bg-background px-3 py-2.5"
          >
            <option value="exact">Exactly</option>
            <option value="minimum">At least</option>
          </select>
        </label>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Challenge Random changes its rule after each answer in the game. Here, choose one fixed rule to browse or check.
      </p>
      <Button type="submit" disabled={isSearching} data-testid="button-find-frequency-words">
        {isSearching ? "Searching…" : "Find words"}
      </Button>
    </form>
  );
}
