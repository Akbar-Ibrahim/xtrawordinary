import { ChevronDown } from "lucide-react";
import type { WordSplitExploreItem } from "@shared/word-split-explore";

function SplitCard({ words }: { words: string[] }) {
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border bg-background p-3">
      {words.map((word, index) => (
        <span className="contents" key={`${word}-${index}`}>
          {index > 0 && <span className="text-muted-foreground" aria-hidden="true">+</span>}
          <span className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-sm font-semibold tracking-wide">
            {word}
          </span>
        </span>
      ))}
    </li>
  );
}

export function SplitResults({
  items,
  loadedCount,
  isLoading,
  hasSearched,
  error,
  preview,
  hasMore,
  isLoadingMore,
  onRetry,
  onLoadMore,
}: {
  items: WordSplitExploreItem[];
  loadedCount: number;
  isLoading: boolean;
  hasSearched: boolean;
  error: string | null;
  preview: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  const groups = [...new Set(items.map(({ words }) => words.length))].sort((a, b) => a - b);

  return (
    <section className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="word-split-results-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="word-split-results-title" className="text-2xl font-semibold tracking-tight">Possible splits</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each split uses every letter once. The order of the smaller words does not create a new split.
          </p>
        </div>
        {loadedCount > 0 && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {loadedCount} loaded
          </span>
        )}
      </div>

      {preview && (
        <p className="mt-4 rounded-lg bg-muted/70 p-3 text-sm text-muted-foreground">
          Preview mode uses a small sample of linked words. With the database connected, results are calculated from the word’s dictionary links.
        </p>
      )}

      {isLoading ? (
        <div className="mt-8 grid min-h-48 place-items-center text-sm text-muted-foreground" role="status">
          Finding exact letter splits…
        </div>
      ) : error && items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5" role="alert">
          <p className="font-medium">{error}</p>
          <button type="button" className="mt-2 text-sm font-semibold text-primary underline" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : !hasSearched ? (
        <div className="mt-8 grid min-h-48 place-items-center text-center text-sm text-muted-foreground">
          Enter a dictionary word to see its possible splits.
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 grid min-h-48 place-items-center text-center text-sm text-muted-foreground">
          No splits match these filters. Try a shorter minimum word length or a different split size.
        </div>
      ) : (
        <div className="mt-6 space-y-7">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
              More splits could not be loaded: {error}
              <button type="button" className="ml-2 font-semibold text-primary underline" onClick={onRetry}>
                Retry
              </button>
            </div>
          )}
          {groups.map((wordCount) => (
            <section key={wordCount} aria-labelledby={`split-group-${wordCount}`}>
              <h3 id={`split-group-${wordCount}`} className="mb-3 text-sm font-semibold text-muted-foreground">
                {wordCount}-word splits
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {items
                  .filter(({ words }) => words.length === wordCount)
                  .map(({ words }) => <SplitCard key={JSON.stringify(words)} words={words} />)}
              </ul>
            </section>
          ))}
          {hasMore && (
            <button
              type="button"
              className="mx-auto flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60"
              disabled={isLoadingMore}
              onClick={onLoadMore}
            >
              {isLoadingMore ? "Loading more splits…" : <>Load more splits <ChevronDown size={16} aria-hidden="true" /></>}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
