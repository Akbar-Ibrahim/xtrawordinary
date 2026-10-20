import type { UnscrambleResultsResponse } from "../types";

interface Props {
  submittedLetters: string;
  isLoading: boolean;
  error: boolean;
  result?: UnscrambleResultsResponse;
  loadingMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}

export function UnscrambleResults({ submittedLetters, isLoading, error, result, loadingMore, onRetry, onLoadMore }: Props) {
  return (
    <section className="wmx-panel wmx-content" aria-labelledby="unscramble-results-heading">
      <div className="wmx-content-head">
        <div>
          <h2 id="unscramble-results-heading">
            {result ? `Words from ${result.input}` : "Matching words"}
          </h2>
          <p>Dictionary words made from all the entered letters, with no letters added or left over.</p>
        </div>
        {result && <div className="wmx-count-pill">{result.items.length}{result.hasMore ? "+" : ""} found</div>}
      </div>

      {result?.source === "preview" && (
        <p className="wmx-preview-note">Preview dictionary sample. With MySQL enabled, results are searched in the connected dictionary.</p>
      )}

      {!submittedLetters && !result ? (
        <div className="wmx-empty">
          <div><strong>Enter scrambled letters</strong>We’ll look for words that use all of your letters.</div>
        </div>
      ) : isLoading ? (
        <div className="wmx-busy" role="status">Searching dictionary…</div>
      ) : error && !result?.items.length ? (
        <div className="wmx-error" role="alert">
          The dictionary search could not be completed.
          <button type="button" className="wmx-retry" onClick={onRetry}>Try again</button>
        </div>
      ) : result?.items.length ? (
        <>
          <div className="wmx-word-grid" aria-live="polite">
            {result.items.map((word) => (
              <div className="wmx-word" key={word}>
                <span className="wmx-word-name">{word}</span>
                <span className="wmx-status"><span className="wmx-status-dot" aria-hidden="true" />Dictionary word</span>
              </div>
            ))}
          </div>
          {error && <p className="wmx-error" role="alert">The next page could not be loaded. Try loading more again.</p>}
          {result.hasMore && (
            <button type="button" className="wmx-load-more" disabled={loadingMore} onClick={onLoadMore}>
              {loadingMore ? "Loading more…" : "Load more matching words"}
            </button>
          )}
        </>
      ) : result ? (
        <div className="wmx-empty">
          <div><strong>No exact match found</strong>Check the entered letters or try a different set.</div>
        </div>
      ) : (
        <div className="wmx-empty">
          <div><strong>Ready when you are</strong>Enter letters above or choose one of the database samples.</div>
        </div>
      )}
    </section>
  );
}
