import { ChevronDown, Sprout } from "lucide-react";
import type { WordRootsExplorePage } from "./api";

function LoadingResults() {
  return (
    <div className="mt-7 space-y-2" role="status" aria-label="Loading base words">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-16 animate-pulse rounded-xl bg-muted/70" />
      ))}
      <span className="sr-only">Finding words linked to all your entries…</span>
    </div>
  );
}

function EmptyResults({
  hasSearched,
  length,
}: {
  hasSearched: boolean;
  length: number | null;
}) {
  return (
    <div className="mt-7 grid min-h-52 place-items-center rounded-xl border border-dashed bg-background/60 px-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Sprout size={19} aria-hidden="true" />
        </span>
        <p className="mt-3 font-medium">
          {length !== null
            ? `No ${length}-letter base words found.`
            : hasSearched ? "No shared base words found." : "Your word roots start here."}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {length !== null
            ? "Try another length or choose Any length to see all matches."
            : hasSearched
            ? "Try another combination. A result must be linked to every submitted word."
            : "Enter at least two words to find base words linked to all of them."}
        </p>
      </div>
    </div>
  );
}

export function RootResults({
  pages,
  length,
  isLoading,
  hasSearched,
  error,
  hasMore,
  isLoadingMore,
  onRetry,
  onLoadMore,
}: {
  pages: WordRootsExplorePage[];
  length: number | null;
  isLoading: boolean;
  hasSearched: boolean;
  error: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  const items = pages.flatMap((page) => page.items);
  const inputs = pages[0]?.inputs ?? [];
  const isPreview = pages.some((page) => page.source === "preview");

  return (
    <section className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="word-roots-results-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Shared dictionary relationships</p>
          <h2 id="word-roots-results-title" className="mt-2 text-2xl font-semibold tracking-tight">Possible base words</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each result is linked to every word you submitted.
          </p>
        </div>
        {items.length > 0 && (
          <span className="rounded-full bg-muted px-3 py-1 font-mono text-xs font-medium text-muted-foreground">
            {items.length} loaded
          </span>
        )}
      </div>

      {inputs.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2" aria-label={`Submitted words: ${inputs.join(", ")}`}>
          {inputs.map((word, index) => (
            <span key={`${word}-${index}`} className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs font-semibold tracking-wide">
              {word}
            </span>
          ))}
        </div>
      )}

      {hasSearched && inputs.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Results remain tied to these submitted words while you edit. Search again to check a different set.
        </p>
      )}

      {isPreview && (
        <p className="mt-4 rounded-lg bg-muted/70 p-3 text-sm text-muted-foreground" role="note">
          Preview results use a small sample of Word Roots relationships. The connected dictionary can return more matches.
        </p>
      )}

      {isLoading ? (
        <LoadingResults />
      ) : error && items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5" role="alert">
          <p className="font-medium">{error}</p>
          <button type="button" className="mt-2 text-sm font-semibold text-primary underline underline-offset-4" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyResults hasSearched={hasSearched} length={length} />
      ) : (
        <div className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
              More matches could not be loaded: {error}
              <button type="button" className="ml-2 font-semibold text-primary underline underline-offset-4" onClick={onRetry}>
                Retry
              </button>
            </div>
          )}
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map(({ word }, index) => (
              <li key={`${word}-${index}`} className="flex min-h-16 items-center justify-between gap-4 rounded-xl border bg-background px-4 py-3">
                <span className="font-mono text-lg font-semibold tracking-[0.12em]">{word}</span>
                <span className="font-mono text-xs text-muted-foreground">{word.length} letters</span>
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              className="mx-auto flex min-h-10 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60"
              disabled={isLoadingMore}
              onClick={onLoadMore}
            >
              {isLoadingMore ? "Loading more base words…" : <>Load more base words <ChevronDown size={16} aria-hidden="true" /></>}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
