import type { LetterPositionSearchResponse, LetterPositionWord } from "../types";

interface Props {
  letter: string;
  position: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: boolean;
  result?: LetterPositionSearchResponse;
  items: LetterPositionWord[];
  onRetry: () => void;
  onLoadMore: () => void;
}

export function LetterPositionExploreResults({
  letter,
  position,
  isLoading,
  isLoadingMore,
  error,
  result,
  items,
  onRetry,
  onLoadMore,
}: Props) {
  const lastPage = result?.page;

  return (
    <section className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="position-results-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Dictionary matches</p>
          <h2 id="position-results-heading" className="mt-1 text-xl font-semibold">
            {letter ? `Words with ${letter} at position ${position}` : "Matching words"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Words are sorted alphabetically; short words are included when they reach the selected position.</p>
        </div>
        {result && (
          <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
            {items.length}{lastPage?.hasMore ? "+" : ""} shown
          </span>
        )}
      </div>

      {result?.source === "preview" && (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Small preview dictionary. The connected database dictionary is used in MySQL mode.
        </p>
      )}

      {!letter && !result ? (
        <div className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Choose a letter and position to see matching dictionary words.
        </div>
      ) : isLoading ? (
        <div className="mt-6 py-8 text-center text-sm text-muted-foreground" role="status">Searching the dictionary…</div>
      ) : error && items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-destructive/30 p-6 text-center" role="alert">
          <p className="text-sm text-destructive">The dictionary search failed.</p>
          <button type="button" onClick={onRetry} className="mt-2 text-sm font-medium underline">Try again</button>
        </div>
      ) : items.length ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-live="polite">
            {items.map((item) => (
              <div key={item.word} className="rounded-lg border bg-background px-3 py-2.5">
                <span className="font-mono font-bold tracking-wide">{item.word}</span>
                {item.gameplayExclusion && (
                  <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">{item.gameplayExclusion}</span>
                )}
              </div>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-destructive" role="alert">Could not load the next page. Try again.</p>}
          {lastPage?.hasMore && (
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={onLoadMore}
              className="mt-5 w-full rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {isLoadingMore ? "Loading more…" : "Load more matching words"}
            </button>
          )}
        </>
      ) : error ? null : (
        <div className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No words matched this letter and position in the current dictionary.
        </div>
      )}
    </section>
  );
}
