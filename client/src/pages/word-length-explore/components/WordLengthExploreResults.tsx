import type { WordLengthExploreItem, WordLengthExplorePage, WordLengthExplorePattern } from "../types";

interface Props {
  pattern: WordLengthExplorePattern | null;
  items: WordLengthExploreItem[];
  result?: WordLengthExplorePage;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasError: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}

function patternLabel(pattern: WordLengthExplorePattern): string {
  const details = [`${pattern.length} letters`];
  if (pattern.startsWith) details.push(`starts with ${pattern.startsWith}`);
  if (pattern.endsWith) details.push(`ends with ${pattern.endsWith}`);
  if (pattern.contains) {
    details.push(`contains ${pattern.contains}${pattern.variation === 4 ? " (not last)" : pattern.variation === 5 ? " (not first)" : ""}`);
  }
  return details.join(" · ");
}

function gameplayNote(exclusion: string | null): string | null {
  if (exclusion === "below_minimum_length") return "Below gameplay minimum";
  if (exclusion === "above_maximum_length") return "Above gameplay maximum";
  return null;
}

export function WordLengthExploreResults({
  pattern,
  items,
  result,
  isLoading,
  isLoadingMore,
  hasError,
  onRetry,
  onLoadMore,
}: Props) {
  if (!pattern) {
    return (
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Dictionary results</h2>
        <p className="mt-2 text-sm text-muted-foreground">Choose a pattern and word length to browse matching words.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="length-results-heading">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Browse</p>
          <h2 id="length-results-heading" className="mt-1 text-xl font-semibold">Matching dictionary words</h2>
          <p className="mt-1 text-sm text-muted-foreground">{patternLabel(pattern)}</p>
        </div>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">{items.length}{result?.page.hasMore ? "+" : ""} shown</span>
        )}
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Finding matching words…</p>}
      {hasError && !isLoading && (
        <div className="py-8 text-center">
          <p className="text-sm text-destructive">Could not load matching words.</p>
          <button type="button" onClick={onRetry} className="mt-3 rounded-lg border px-4 py-2 text-sm font-medium">
            Try again
          </button>
        </div>
      )}
      {!isLoading && !hasError && items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No matching words were found for this pattern.</p>
      )}
      {!isLoading && !hasError && items.length > 0 && (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-label="Matching words">
            {items.map((item) => (
              <WordLengthResult key={item.word} item={item} />
            ))}
          </ul>
          {result?.source === "preview" && (
            <p className="mt-4 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              Preview mode uses a small sample dictionary. A connected database returns its matching dictionary results.
            </p>
          )}
          {result?.page.hasMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="mt-5 w-full rounded-lg border px-4 py-2.5 font-medium hover:border-primary disabled:opacity-50"
            >
              {isLoadingMore ? "Loading more…" : "Load more matching words"}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function WordLengthResult({ item }: { item: WordLengthExploreItem }) {
  const note = gameplayNote(item.gameplayExclusion);
  return (
    <li className="min-w-0 rounded-lg border bg-background px-3 py-3">
      <p className="break-words font-mono font-semibold uppercase tracking-wide">{item.word}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}; included in Explore</p>}
    </li>
  );
}
