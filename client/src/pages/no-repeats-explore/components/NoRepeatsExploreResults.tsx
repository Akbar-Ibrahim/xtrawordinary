import { Button } from "@/components/ui/button";
import type { NoRepeatsSearchResponse } from "../types";

interface Props {
  hasSearched: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: boolean;
  errorMessage?: string;
  result?: NoRepeatsSearchResponse;
  words: string[];
  onRetry: () => void;
  onLoadMore: () => void;
}

export function NoRepeatsExploreResults({
  hasSearched,
  isLoading,
  isLoadingMore,
  error,
  errorMessage,
  result,
  words,
  onRetry,
  onLoadMore,
}: Props) {
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="no-repeats-results-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Dictionary results</p>
          <h2 id="no-repeats-results-heading" className="mt-1 text-xl font-semibold">Isogram words</h2>
          <p className="mt-1 text-sm text-muted-foreground">Every result has no repeated letters and is listed alphabetically.</p>
        </div>
        {result?.source === "preview" && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Small preview dictionary
          </span>
        )}
      </div>
      {result?.source === "preview" && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          These results use a small sample because this preview has no database connection.
        </p>
      )}
      {!hasSearched && (
        <p className="mt-6 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          Browse isograms from the dictionary, or narrow the list by length or required letters.
        </p>
      )}
      {isLoading && <p className="mt-6 text-sm text-muted-foreground" role="status">Searching the dictionary…</p>}
      {error && words.length === 0 && (
        <div className="mt-6 rounded-lg border border-destructive/30 p-4" role="alert">
          <p className="text-sm">{errorMessage ?? "The search failed. Check your connection and try again."}</p>
          <Button variant="outline" className="mt-3" onClick={onRetry}>Try again</Button>
        </div>
      )}
      {error && words.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3" role="alert">
          <span className="text-sm">{errorMessage ?? "The next results page could not be loaded. Your current words are still shown."}</span>
          <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
        </div>
      )}
      {!isLoading && !error && hasSearched && words.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          No dictionary words match these filters.
        </p>
      )}
      {words.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-label="Isogram words">
          {words.map((word) => (
            <li key={word} className="rounded-lg border bg-background px-3 py-2 font-mono font-semibold tracking-wide">
              {word}
            </li>
          ))}
        </ul>
      )}
      {result?.page.hasMore && !error && (
        <Button
          variant="outline"
          className="mt-5"
          disabled={isLoadingMore}
          onClick={onLoadMore}
          data-testid="button-load-more-no-repeats-words"
        >
          {isLoadingMore ? "Loading…" : "Load more words"}
        </Button>
      )}
    </section>
  );
}
