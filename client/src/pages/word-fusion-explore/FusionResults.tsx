import { ChevronDown, Layers3 } from "lucide-react";
import type { WordFusionExplorePage } from "./api";

function ResultWord({ word }: { word: string }) {
  return (
    <li className="flex min-h-16 items-center justify-between gap-4 rounded-xl border bg-background px-4 py-3">
      <span className="font-mono text-lg font-semibold tracking-[0.12em]">{word}</span>
      <span className="font-mono text-xs text-muted-foreground">{word.length} letters</span>
    </li>
  );
}

function LoadingResults() {
  return (
    <div className="mt-7 space-y-2" role="status" aria-label="Loading word matches">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-16 animate-pulse rounded-xl bg-muted/70" />
      ))}
      <span className="sr-only">Finding words that use the full letter pool…</span>
    </div>
  );
}

function EmptyResults({ hasSearched }: { hasSearched: boolean }) {
  return (
    <div className="mt-7 grid min-h-52 place-items-center rounded-xl border border-dashed bg-background/60 px-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Layers3 size={19} aria-hidden="true" />
        </span>
        <p className="mt-3 font-medium">{hasSearched ? "No exact matches this time." : "Your word discoveries start here."}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {hasSearched
            ? "Try another combination of words. Matching results use every pooled letter, with duplicates counted."
            : "Add two or more dictionary words, then search to see words formed from the complete letter pool."}
        </p>
      </div>
    </div>
  );
}

export function FusionResults({
  pages,
  isLoading,
  hasSearched,
  error,
  hasMore,
  isLoadingMore,
  onRetry,
  onLoadMore,
}: {
  pages: WordFusionExplorePage[];
  isLoading: boolean;
  hasSearched: boolean;
  error: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  const items = pages.flatMap((page) => page.items);
  const components = pages[0]?.components ?? [];
  const preview = pages.some((page) => page.source === "preview");

  return (
    <section className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="fusion-results-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Exact letter match</p>
          <h2 id="fusion-results-title" className="mt-2 text-2xl font-semibold tracking-tight">Fused words</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dictionary words made from every letter in your pool.
          </p>
        </div>
        {items.length > 0 && (
          <span className="rounded-full bg-muted px-3 py-1 font-mono text-xs font-medium text-muted-foreground">
            {items.length} loaded
          </span>
        )}
      </div>

      {components.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2" aria-label={`Submitted components: ${components.join(", ")}`}>
          {components.map((component, index) => (
            <span key={`${component}-${index}`} className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs font-semibold tracking-wide">
              {component}
            </span>
          ))}
        </div>
      )}

      {hasSearched && components.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Results stay with this submitted pool while you edit. Search again to explore a new pool.
        </p>
      )}

      {preview && (
        <p className="mt-4 rounded-lg bg-muted/70 p-3 text-sm text-muted-foreground" role="note">
          Preview results are a limited sample. Full dictionary matches are available when the word database is connected.
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
        <EmptyResults hasSearched={hasSearched} />
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
            {items.map(({ word }, index) => <ResultWord key={`${word}-${index}`} word={word} />)}
          </ul>
          {hasMore && (
            <button
              type="button"
              className="mx-auto flex min-h-10 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60"
              disabled={isLoadingMore}
              onClick={onLoadMore}
            >
              {isLoadingMore ? "Loading more matches…" : <>Load more matches <ChevronDown size={16} aria-hidden="true" /></>}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
