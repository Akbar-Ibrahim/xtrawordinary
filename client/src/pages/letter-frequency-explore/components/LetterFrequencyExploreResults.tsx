import { Button } from "@/components/ui/button";
import type { LetterFrequencySearchResponse } from "../types";

interface Props {
  hasSearched: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: boolean;
  errorMessage?: string;
  result?: LetterFrequencySearchResponse;
  words: string[];
  onRetry: () => void;
  onLoadMore: () => void;
}

export function LetterFrequencyExploreResults({
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
    <section className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="frequency-results-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Dictionary results</p>
          <h2 id="frequency-results-heading" className="mt-1 text-xl font-semibold">Matching words</h2>
          <p className="mt-1 text-sm text-muted-foreground">Words are shown in alphabetical order. Load more to see the next page.</p>
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
          Choose a letter pattern to browse matching dictionary words.
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
          No dictionary words match those letter counts.
        </p>
      )}
      {words.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-label="Matching words">
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
          data-testid="button-load-more-frequency-words"
        >
          {isLoadingMore ? "Loading…" : "Load more words"}
        </Button>
      )}
    </section>
  );
}
