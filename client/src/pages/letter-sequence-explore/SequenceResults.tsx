import { ChevronDown, SearchX } from "lucide-react";
import type { LetterSequenceExplorePage, LetterSequenceType } from "@shared/letter-sequence-explore";

const resultHeadings: Record<LetterSequenceType, { eyebrow: string; title: string; description: string }> = {
  prefix: {
    eyebrow: "Starts with",
    title: "Words beginning with your sequence",
    description: "Each result opens with the letters you searched.",
  },
  suffix: {
    eyebrow: "Ends with",
    title: "Words ending with your sequence",
    description: "Each result closes with the letters you searched.",
  },
  contains: {
    eyebrow: "Inside the word",
    title: "Words with your sequence inside",
    description: "The sequence appears between other letters—not at either end.",
  },
};

function LoadingResults() {
  return (
    <div className="mt-6 space-y-2" role="status" aria-label="Loading matching words">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-14 animate-pulse rounded-xl bg-[#ebe6da] dark:bg-[#30322d]" />
      ))}
      <span className="sr-only">Looking through dictionary words…</span>
    </div>
  );
}

function EmptyResults({
  hasSearched,
  type,
  length,
}: {
  hasSearched: boolean;
  type: LetterSequenceType;
  length: number | null;
}) {
  return (
    <div className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-dashed border-[#d9d1c1] bg-[#f8f5ed]/70 px-6 text-center dark:border-[#45473f] dark:bg-[#171916]/50">
      <div className="max-w-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#eee7d8] text-[#806c4e] dark:bg-[#34342b] dark:text-[#d6c39a]">
          <SearchX size={19} aria-hidden="true" />
        </span>
        <p className="mt-3 font-semibold">
          {hasSearched
            ? length === null ? "No words found for that sequence." : `No ${length}-letter words found for that sequence.`
            : "Your search starts here."}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {hasSearched
            ? type === "contains"
              ? "Try a shorter sequence. Matches must have at least one letter before and after it."
              : "Try a different sequence, or shorten the letters you entered."
            : "Enter a sequence above to browse matching dictionary words."}
        </p>
      </div>
    </div>
  );
}

export function SequenceResults({
  type,
  sequence,
  length,
  pages,
  hasSearched,
  isLoading,
  error,
  hasMore,
  isLoadingMore,
  onRetry,
  onLoadMore,
}: {
  type: LetterSequenceType;
  sequence: string | null;
  length: number | null;
  pages: LetterSequenceExplorePage[];
  hasSearched: boolean;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  const items = pages.flatMap((page) => page.items);
  const preview = pages.some((page) => page.source === "preview");
  const heading = resultHeadings[type];

  return (
    <section className="min-w-0 rounded-2xl border border-[#e5dece] bg-[#fcfaf5] p-5 shadow-[0_5px_18px_rgba(73,57,32,0.035)] dark:border-[#42443c] dark:bg-[#20221e] sm:p-7" aria-labelledby="sequence-results-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#92764e] dark:text-[#d6c39a]">{heading.eyebrow} · Explore</p>
          <h2 id="sequence-results-heading" className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{heading.title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{heading.description}</p>
        </div>
        {sequence && (
          <span className="rounded-lg border border-[#e5dece] bg-[#f3efe5] px-3 py-2 font-mono text-sm font-semibold tracking-[0.12em] text-[#66553c] dark:border-[#42443c] dark:bg-[#292b25] dark:text-[#e5d4af]">
            {sequence}
          </span>
        )}
      </div>

      {preview && (
        <p className="mt-5 rounded-xl border border-[#e7dcc4] bg-[#f4efdf] px-4 py-3 text-sm leading-6 text-[#6b5d43] dark:border-[#514a3a] dark:bg-[#302e25] dark:text-[#d6c39a]" role="note">
          These are preview results, so the list may be a limited sample of dictionary matches.
        </p>
      )}

      {isLoading ? (
        <LoadingResults />
      ) : error && items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5" role="alert">
          <p className="font-medium">{error}</p>
          <button type="button" className="mt-3 text-sm font-semibold text-primary underline underline-offset-4" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyResults hasSearched={hasSearched} type={type} length={length} />
      ) : (
        <div className="mt-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
              More words could not be loaded: {error}
              <button type="button" className="ml-2 font-semibold text-primary underline underline-offset-4" onClick={onRetry}>Retry</button>
            </div>
          )}
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map(({ word }, index) => (
              <li key={`${word}-${index}`} className="flex min-h-14 items-center rounded-xl border border-[#e9e3d7] bg-[#f8f5ed] px-4 py-3 dark:border-[#41433c] dark:bg-[#191b18]">
                <span className="font-mono text-base font-semibold uppercase tracking-[0.12em] text-foreground">{word.toUpperCase()}</span>
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              className="mx-auto flex min-h-11 items-center gap-2 rounded-xl border border-[#ded7c8] bg-[#f8f5ed] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#eee8dc] disabled:opacity-60 dark:border-[#494a42] dark:bg-[#191b18] dark:hover:bg-[#292b25]"
              disabled={isLoadingMore}
              onClick={onLoadMore}
            >
              {isLoadingMore ? "Loading more words…" : <>Load more words <ChevronDown size={16} aria-hidden="true" /></>}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
