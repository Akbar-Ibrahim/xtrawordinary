import { Button } from "@/components/ui/button";
import type { LetterFrequencyConstraint } from "../types";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COUNTS = [1, 2, 3];

interface Props {
  constraints: LetterFrequencyConstraint[];
  isSearching: boolean;
  onConstraintsChange: (constraints: LetterFrequencyConstraint[]) => void;
  onSearch: () => void;
}

export function MultiLetterFrequencyControls({
  constraints,
  isSearching,
  onConstraintsChange,
  onSearch,
}: Props) {
  const selectedLetters = new Set(constraints.map(({ letter }) => letter));

  function updateConstraint(index: number, value: LetterFrequencyConstraint) {
    onConstraintsChange(constraints.map((constraint, currentIndex) =>
      currentIndex === index ? value : constraint,
    ));
  }

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
    >
      <p className="text-sm text-muted-foreground">
        Choose two or three different letters. Each letter must appear exactly its selected number of times.
      </p>
      <div className="space-y-3">
        {constraints.map((constraint, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
            <label className="space-y-1.5 text-sm font-medium">
              Letter {index + 1}
              <select
                aria-label={`Letter ${index + 1}`}
                value={constraint.letter}
                onChange={(event) => updateConstraint(index, { ...constraint, letter: event.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2.5"
              >
                {LETTERS.map((letter) => (
                  <option key={letter} value={letter} disabled={letter !== constraint.letter && selectedLetters.has(letter)}>
                    {letter}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Exact count
              <select
                aria-label={`Exact count for ${constraint.letter}`}
                value={constraint.count}
                onChange={(event) => updateConstraint(index, { ...constraint, count: Number(event.target.value) })}
                className="w-full rounded-md border bg-background px-3 py-2.5"
              >
                {COUNTS.map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
            {constraints.length > 2 ? (
              <Button
                type="button"
                variant="outline"
                aria-label={`Remove letter ${index + 1}`}
                onClick={() => onConstraintsChange(constraints.filter((_, currentIndex) => currentIndex !== index))}
              >
                Remove
              </Button>
            ) : <span aria-hidden="true" className="w-[4.75rem]" />}
          </div>
        ))}
      </div>
      {constraints.length < 3 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const nextLetter = LETTERS.find((letter) => !selectedLetters.has(letter)) ?? "A";
            onConstraintsChange([...constraints, { letter: nextLetter, count: 1 }]);
          }}
        >
          Add another letter
        </Button>
      )}
      <Button type="submit" disabled={isSearching} data-testid="button-find-frequency-words">
        {isSearching ? "Searching…" : "Find words"}
      </Button>
    </form>
  );
}
