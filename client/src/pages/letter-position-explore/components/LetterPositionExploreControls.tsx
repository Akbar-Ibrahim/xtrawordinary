import type { FormEvent } from "react";
import { Search } from "lucide-react";

interface Props {
  letter: string;
  position: number;
  isSearching: boolean;
  onLetterChange: (letter: string) => void;
  onPositionChange: (position: number) => void;
  onSearch: (letter: string, position: number) => void;
}

const EXAMPLES = [
  { letter: "E", position: 1, label: "E · position 1" },
  { letter: "A", position: 2, label: "A · position 2" },
  { letter: "A", position: 3, label: "A · position 3" },
];

export function LetterPositionExploreControls({
  letter,
  position,
  isSearching,
  onLetterChange,
  onPositionChange,
  onSearch,
}: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (letter) onSearch(letter, position);
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="position-controls-heading">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Letter position</p>
        <h2 id="position-controls-heading" className="mt-1 text-xl font-semibold">Choose a letter and place</h2>
        <p className="mt-1 text-sm text-muted-foreground">Positions start at 1 on the left. The word must have the chosen letter exactly there.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="position-required-letter">Required letter</label>
            <input
              id="position-required-letter"
              value={letter}
              onChange={(event) => onLetterChange(event.target.value.replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase())}
              className="w-full rounded-lg border bg-background px-3 py-3 font-mono text-lg uppercase tracking-[0.2em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="A–Z"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={1}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="position-number">Position</label>
            <select
              id="position-number"
              value={position}
              onChange={(event) => onPositionChange(Number(event.target.value))}
              className="w-full rounded-lg border bg-background px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Array.from({ length: 8 }, (_, index) => index + 1).map((number) => (
                <option key={number} value={number}>{number}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={!letter || isSearching}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search size={17} aria-hidden="true" />
          {isSearching ? "Searching…" : "Find words"}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Try a pattern</span>
        {EXAMPLES.map((example) => (
          <button
            key={`${example.letter}-${example.position}`}
            type="button"
            onClick={() => onSearch(example.letter, example.position)}
            className="rounded-full border px-3 py-1.5 text-xs hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {example.label}
          </button>
        ))}
      </div>
    </section>
  );
}
