import type { ShellWordExploreItem, ShellWordExplorePage } from "../types";

interface Props {
  title: string;
  relationshipName: string;
  items: ShellWordExploreItem[];
  result?: ShellWordExplorePage;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasError: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}

export function ExploreBrowseResults({
  title, relationshipName, items, result, isLoading, isLoadingMore, hasError, onRetry, onLoadMore,
}: Props) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#d8d0c3] bg-[#fffdf8] shadow-[0_12px_35px_rgba(63,49,32,0.06)]" aria-labelledby="relationship-results-heading">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8e1d6] px-5 py-5 sm:px-7">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#aa6048]">Word relationship index</p>
          <h2 id="relationship-results-heading" className="mt-1 font-serif text-2xl text-[#263b39]">{title}</h2>
          <p className="mt-1 text-sm text-[#68716a]">Outer word → inner word · alphabetical by outer word</p>
        </div>
        <span className="rounded-full border border-[#d8d0c3] px-3 py-1 font-mono text-xs text-[#68716a]">
          {items.length}{result?.page.hasMore ? "+" : ""} entries
        </span>
      </header>

      <div className="p-4 sm:p-6">
        {isLoading && <div aria-label="Loading relationships" className="space-y-3 py-2">
          {[0, 1, 2, 3].map((row) => <div key={row} className="h-[58px] animate-pulse rounded-xl bg-[#f1ede5]" />)}
        </div>}
        {hasError && !isLoading && items.length === 0 && (
          <div className="rounded-xl border border-[#e6c9bc] bg-[#fbf1eb] px-5 py-8 text-center" role="alert">
            <p className="font-medium text-[#7d4334]">The relationship index could not be reached.</p>
            <p className="mt-1 text-sm text-[#856d62]">Your filters are still here. Try the request again.</p>
            <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-[#263b39] px-4 py-2 text-sm font-semibold text-[#fffdf8] hover:bg-[#344c48]">Retry browse</button>
          </div>
        )}
        {!isLoading && !hasError && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#d8d0c3] px-5 py-12 text-center">
            <p className="font-serif text-xl text-[#263b39]">No recorded relationships</p>
            <p className="mt-2 text-sm text-[#68716a]">Try widening the letters or searching in the other direction.</p>
          </div>
        )}
        {!isLoading && items.length > 0 && (
          <>
            <ul className="divide-y divide-[#ece6dc]" aria-label={`${relationshipName} relationships`}>
              {items.map((item) => <RelationshipRow key={`${item.shellWord}-${item.innerWord}`} item={item} />)}
            </ul>
            {result?.source === "preview" && <p className="mt-4 rounded-lg bg-[#f6eee2] px-4 py-3 text-xs leading-relaxed text-[#75644f]">Preview mode shows a small sample. A connected dictionary provides the complete relationship index.</p>}
            {hasError && result?.page.hasMore && (
              <div className="mt-5 rounded-xl border border-[#e6c9bc] bg-[#fbf1eb] px-5 py-4 text-center" role="alert">
                <p className="font-medium text-[#7d4334]">The next relationships could not be loaded.</p>
                <p className="mt-1 text-sm text-[#856d62]">Your current results and filters are unchanged. Try loading the next page again.</p>
                <button type="button" onClick={onLoadMore} disabled={isLoadingMore} className="mt-3 rounded-lg bg-[#263b39] px-4 py-2 text-sm font-semibold text-[#fffdf8] hover:bg-[#344c48] disabled:cursor-wait disabled:opacity-60">
                  {isLoadingMore ? "Loading the next entries…" : "Retry next page"}
                </button>
              </div>
            )}
            {result?.page.hasMore && !hasError && (
              <button type="button" onClick={onLoadMore} disabled={isLoadingMore} className="mt-5 w-full rounded-lg border border-[#cfc5b6] px-4 py-3 text-sm font-semibold text-[#344c48] transition-colors hover:border-[#aa6048] hover:text-[#aa6048] disabled:cursor-wait disabled:opacity-60">
                {isLoadingMore ? "Loading the next entries…" : "Load more alphabetically"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function RelationshipRow({ item }: { item: ShellWordExploreItem }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-3 sm:gap-5 sm:py-3.5">
      <span className="min-w-0 break-words font-mono text-sm font-bold uppercase tracking-[0.08em] text-[#263b39] sm:text-base">{item.shellWord}</span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-[#ad7a64]" aria-hidden="true">contains</span>
      <span className="min-w-0 break-words text-right font-mono text-sm uppercase tracking-[0.08em] text-[#68716a] sm:text-base">{item.innerWord}</span>
    </li>
  );
}
