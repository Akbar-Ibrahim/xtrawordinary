import type { FormEvent } from "react";
import { Search } from "lucide-react";

interface Props {
  letters: string;
  ordered: boolean;
  isSearching: boolean;
  onLettersChange: (value: string) => void;
  onOrderedChange: (ordered: boolean) => void;
  onSearch: (letters: string, ordered: boolean) => void;
}

const EXAMPLES = [
  { letters: "TEA", ordered: false, label: "TEA · any order" },
  { letters: "TEA", ordered: true, label: "T → E → A" },
  { letters: "LL", ordered: false, label: "LL · two Ls" },
];

export function LetterHuntControls({
  letters,
  ordered,
  isSearching,
  onLettersChange,
  onOrderedChange,
  onSearch,
}: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (letters) onSearch(letters, ordered);
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="hunt-controls-heading">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Required letters</p>
        <h2 id="hunt-controls-heading" className="mt-1 text-xl font-semibold">Set your pattern</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Repeat a letter to require it more than once. Words may contain additional letters.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium" htmlFor="hunt-required-letters">Letters to find</label>
        <input
          id="hunt-required-letters"
          className="w-full rounded-lg border bg-background px-3 py-3 font-mono text-lg uppercase tracking-[0.2em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={letters}
          onChange={(event) => onLettersChange(event.target.value.replace(/[^a-z]/gi, "").slice(0, 12).toUpperCase())}
          placeholder="e.g. TEA or LL"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={12}
          aria-describedby="hunt-pattern-help"
        />
        <p id="hunt-pattern-help" className="text-xs text-muted-foreground">Each letter must appear at least as many times as entered.</p>

        <div className="space-y-2">
          <p className="text-sm font-medium">Letter order</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Letter order">
            <button
              type="button"
              aria-pressed={!ordered}
              onClick={() => onOrderedChange(false)}
              className={`rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${!ordered ? "border-primary bg-primary/10 text-primary" : "bg-background"}`}
            >
              Any order
            </button>
            <button
              type="button"
              aria-pressed={ordered}
              onClick={() => onOrderedChange(true)}
              className={`rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${ordered ? "border-primary bg-primary/10 text-primary" : "bg-background"}`}
            >
              In this order
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!letters || isSearching}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search size={17} aria-hidden="true" />
          {isSearching ? "Searching…" : "Find matching words"}
        </button>
      </form>

      <div className="mt-5 border-t pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Try a pattern</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => onSearch(example.letters, example.ordered)}
              className="rounded-full border px-3 py-1.5 font-mono text-xs hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
