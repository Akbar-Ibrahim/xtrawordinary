import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDown, ChevronDown } from "lucide-react";
import { readExploreJson } from "./api";
import type { WordsResponse } from "../types";

interface Props {
  selectedBase: string;
  mode: "browse" | "host";
  revealed: boolean;
  onReveal: (revealed: boolean) => void;
}

export function AnagramResults({ selectedBase, mode, revealed, onReveal }: Props) {
  const wordsQuery = useInfiniteQuery<WordsResponse>({
    queryKey: ["/api/explore/anagrams/words", selectedBase],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ baseWord: selectedBase, limit: "100" });
      if (typeof pageParam === "string" && pageParam) params.set("cursor", pageParam);
      return readExploreJson(`/api/explore/anagrams/words?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: Boolean(selectedBase) && (mode === "browse" || revealed),
    staleTime: 60_000,
    retry: 1,
  });
  const words = wordsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const previewMode = wordsQuery.data?.pages.some((page) => page.source === "preview");

  return (
    <section className="wmx-panel wmx-content" aria-labelledby="ax-results-heading">
      {mode === "host" && selectedBase && revealed && (
        <button type="button" className="wmx-hide-answer" onClick={() => onReveal(false)}>Hide answer list</button>
      )}
      <div className="wmx-content-head">
        <div>
          <h2 id="ax-results-heading">{selectedBase ? `Anagrams of ${selectedBase}` : "Your word family"}</h2>
          <p>
            {selectedBase
              ? "Words use the same letters, including repeated letters."
              : "Choose a base word to browse its exact-letter matches."}
          </p>
        </div>
        {selectedBase && mode === "browse" && (
          <div className="wmx-count-pill">{words.length} loaded</div>
        )}
      </div>

      {(mode === "browse" || revealed) && previewMode && (
        <p className="wmx-preview-note">Preview mode uses a small sample. The connected database can provide more words across additional pages.</p>
      )}

      {!selectedBase ? (
        <div className="wmx-empty"><div><strong>Start with a base word</strong>Search above or choose a random word to view its matches.</div></div>
      ) : mode === "host" && !revealed ? (
        <button type="button" className="wmx-reveal" onClick={() => onReveal(true)}>
          Reveal all matching words <ArrowDown size={15} aria-hidden="true" />
        </button>
      ) : wordsQuery.isLoading ? (
        <div className="wmx-busy" role="status" aria-label="Loading word list">
          <div className="wmx-skeletons" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => <div className="wmx-skeleton" key={index} />)}
          </div>
        </div>
      ) : wordsQuery.isError && words.length === 0 ? (
        <div className="wmx-error" role="alert">
          Could not load the anagram list. <button type="button" className="wmx-retry" onClick={() => wordsQuery.refetch()}>Try again</button>
        </div>
      ) : words.length === 0 ? (
        <div className="wmx-empty"><div><strong>No linked anagrams found</strong>Try another base word.</div></div>
      ) : (
        <>
          {wordsQuery.isError && (
            <div className="wmx-error" role="alert">
              Could not load the next page. <button type="button" className="wmx-retry" onClick={() => wordsQuery.fetchNextPage()}>Retry</button>
            </div>
          )}
          <div className="wmx-word-grid" aria-live="polite">
            {words.map(({ word }, index) => (
              <div className="wmx-word" key={`${word}-${index}`}>
                <span className="wmx-word-name">{word.toUpperCase()}</span>
                <span className="wmx-status"><span className="wmx-status-dot" aria-hidden="true" />Valid</span>
              </div>
            ))}
          </div>
          <p className="wmx-letters">Alphabetical order · exact letter matches</p>
          {wordsQuery.hasNextPage && (
            <button
              type="button"
              className="wmx-load-more"
              disabled={wordsQuery.isFetchingNextPage}
              onClick={() => wordsQuery.fetchNextPage()}
            >
              {wordsQuery.isFetchingNextPage ? "Loading more words…" : <>Load next 100 words <ChevronDown size={15} aria-hidden="true" /></>}
            </button>
          )}
        </>
      )}
    </section>
  );
}
