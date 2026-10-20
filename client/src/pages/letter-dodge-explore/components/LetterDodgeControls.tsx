import { Search } from "lucide-react";
import type { FormEvent } from "react";

const EXAMPLES = [
  { letters: "AE", label: "Avoid A + E" },
  { letters: "QXZ", label: "Avoid Q + X + Z" },
];

interface Props {
  letters: string;
  isSearching: boolean;
  onSetLetters: (letters: string) => void;
  onSearch: (letters: string) => void;
}

export function LetterDodgeControls({
  letters,
  isSearching,
  onSetLetters,
  onSearch,
}: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (letters) onSearch(letters);
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="dodge-controls-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-destructive">Forbidden letters</p>
          <h2 id="dodge-controls-heading" className="mt-1 text-xl font-semibold">Keep these out</h2>
          <p className="mt-1 text-sm text-muted-foreground">Type the letters that words must avoid.</p>
        </div>
        {letters && (
          <span className="rounded-full bg-destructive/10 px-3 py-1 font-mono text-sm font-semibold text-destructive">
            {letters.split("").join(" · ")}
          </span>
        )}
      </div>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="dodge-forbidden-letters" className="sr-only">Letters to omit</label>
        <input
          id="dodge-forbidden-letters"
          type="text"
          value={letters}
          onChange={(event) => onSetLetters(event.target.value.replace(/[^a-z]/gi, "").toUpperCase())}
          className="w-full rounded-lg border bg-background px-3 py-2.5 font-mono uppercase tracking-[0.2em] outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-md"
          placeholder="e.g. AE"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={26}
          aria-describedby="dodge-forbidden-help"
          data-testid="input-forbidden-letters"
        />
        <button
          type="submit"
          disabled={!letters || isSearching}
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 font-semibold text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          data-testid="button-find-letter-dodge-words"
        >
          <Search size={17} aria-hidden="true" />
          {isSearching ? "Searching…" : "Find words"}
        </button>
      </form>
      <p id="dodge-forbidden-help" className="mt-2 text-xs text-muted-foreground">
        Enter one or more letters. Order and duplicates are normalized when you search.
      </p>

      <div className="mt-5 border-t pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Try a set</p>
        <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example.letters}
            type="button"
            onClick={() => {
              onSetLetters(example.letters);
              onSearch(example.letters);
            }}
            className="rounded-full border px-3 py-1.5 text-xs hover:border-destructive hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {example.label}
          </button>
        ))}
        </div>
      </div>
      {!letters && <p className="mt-3 text-xs text-muted-foreground">Enter at least one forbidden letter to search.</p>}
    </section>
  );
}
