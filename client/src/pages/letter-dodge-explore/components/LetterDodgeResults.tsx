import type { LetterDodgeSearchResponse, LetterDodgeWord } from "../types";
import { LetterDodgeCopyAnswers } from "./LetterDodgeCopyAnswers";

interface Props {
  letters: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: boolean;
  errorMessage: string;
  result?: LetterDodgeSearchResponse;
  items: LetterDodgeWord[];
  onRetry: () => void;
  onLoadMore: () => void;
}

export function LetterDodgeResults({
  letters,
  isLoading,
  isLoadingMore,
  error,
  errorMessage,
  result,
  items,
  onRetry,
  onLoadMore,
}: Props) {
  const lastPage = result?.page;
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="dodge-results-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Allowed words</p>
          <h2 id="dodge-results-heading" className="mt-1 text-xl font-semibold">
            {letters ? `Words without ${letters.split("").join(" · ")}` : "Words that avoid your letters"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Matches are dictionary words that contain none of the forbidden letters.
          </p>
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

      {!letters && !result ? (
        <div className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Select forbidden letters above to find words that avoid them.
        </div>
      ) : isLoading ? (
        <div className="mt-6 py-8 text-center text-sm text-muted-foreground" role="status">Searching the dictionary…</div>
      ) : error && items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-destructive/30 p-6 text-center" role="alert">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <button type="button" onClick={onRetry} className="mt-2 text-sm font-medium underline">Try again</button>
        </div>
      ) : items.length ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-live="polite">
            {items.map((item) => (
              <div key={item.word} className="rounded-lg border bg-background px-3 py-2.5">
                <span className="font-mono font-bold tracking-wide">{item.word}</span>
                {item.gameplayExclusion && (
                  <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                    Explore match; {item.gameplayExclusion}
                  </span>
                )}
              </div>
            ))}
          </div>
          {result && (
            <LetterDodgeCopyAnswers
              letters={letters}
              items={items}
              hasMore={lastPage?.hasMore ?? false}
              nextCursor={lastPage?.nextCursor ?? null}
              source={result.source}
            />
          )}
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{errorMessage}</p>}
          {lastPage?.hasMore && (
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={onLoadMore}
              className="mt-5 w-full rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {isLoadingMore
                ? "Loading more…"
                : error
                  ? "Retry loading more matching words"
                  : "Load more matching words"}
            </button>
          )}
        </>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">No matches found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different set of forbidden letters.</p>
        </div>
      )}
    </section>
  );
}
