import { Button } from "@/components/ui/button";

interface Props {
  length?: number;
  requiredLetters: string;
  isSearching: boolean;
  onLengthChange: (length?: number) => void;
  onRequiredLettersChange: (letters: string) => void;
  onSearch: () => void;
}

export function NoRepeatsExploreControls({
  length,
  requiredLetters,
  isSearching,
  onLengthChange,
  onRequiredLettersChange,
  onSearch,
}: Props) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="no-repeats-controls-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Browse</p>
      <h2 id="no-repeats-controls-heading" className="mt-1 text-xl font-semibold">Choose your word filters</h2>
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <label className="block space-y-1.5 text-sm font-medium">
          Word length
          <select
            aria-label="Word length"
            value={length ?? ""}
            onChange={(event) => onLengthChange(event.target.value ? Number(event.target.value) : undefined)}
            className="w-full rounded-md border bg-background px-3 py-2.5"
          >
            <option value="">Any length</option>
            {Array.from({ length: 26 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>{value} {value === 1 ? "letter" : "letters"}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          Required letters <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            aria-label="Required letters"
            value={requiredLetters}
            onChange={(event) => {
              const letters = event.target.value.replace(/[^a-z]/gi, "").toUpperCase();
              onRequiredLettersChange([...new Set(letters)].join("").slice(0, 26));
            }}
            maxLength={26}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="For example, ART"
            className="w-full rounded-md border bg-background px-3 py-2.5 font-mono uppercase"
          />
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Explore includes any dictionary length, even under three letters. Normal game challenges use 3–9 letters.
        </p>
        <Button type="submit" disabled={isSearching} data-testid="button-find-no-repeats-words">
          {isSearching ? "Searching…" : "Find words"}
        </Button>
      </form>
    </section>
  );
}
