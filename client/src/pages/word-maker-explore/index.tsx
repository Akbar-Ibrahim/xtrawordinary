import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { BaseWordPicker } from "./BaseWordPicker";
import { readWordMakerJson, WordMakerRequestError } from "./api";
import "./styles.css";

type ExploreWord = { word: string; playableInGame: boolean; gameplayExclusion: string | null };
type WordsResponse = {
  baseWord: string;
  items: ExploreWord[];
  page: { limit: number; nextCursor: string | null; hasMore: boolean };
  source: "preview" | "database";
};
const wordsKey = (baseWord: string) => ["/api/explore/word-maker/words", baseWord] as const;
const prettify = (word: string) => word.toLocaleLowerCase();

function LoadingGrid() {
  return (
    <div className="wmx-busy" role="status" aria-label="Loading word list">
      <div className="wmx-skeletons" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <div className="wmx-skeleton" key={index} />)}
      </div>
    </div>
  );
}

function WordRows({ pages }: { pages: WordsResponse[] }) {
  const words = pages.flatMap((page) => page.items);
  return (
    <>
      <div className="wmx-word-grid" aria-live="polite">
        {words.map((item, index) => (
          <div className="wmx-word" key={`${item.word}-${index}`}>
            <span className="wmx-word-name">{item.word.toUpperCase()}</span>
            <span
              className="wmx-status"
              title="Listed as a word that can be formed from this base word."
            >
              <span className="wmx-status-dot" aria-hidden="true" />
              {item.word.length < 3 ? "Short word" : "Explore match"}
            </span>
          </div>
        ))}
      </div>
      <p className="wmx-letters">Alphabetical order · words formed from the base word</p>
    </>
  );
}

export default function WordMakerExplore() {
  const [selectedBase, setSelectedBase] = useState("");
  const wordsQuery = useInfiniteQuery<WordsResponse>({
    queryKey: wordsKey(selectedBase),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ baseWord: selectedBase, limit: "100" });
      if (typeof pageParam === "string" && pageParam) params.set("cursor", pageParam);
      return readWordMakerJson(`/api/explore/word-maker/words?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: Boolean(selectedBase),
    staleTime: 60_000,
    retry: 1,
  });
  const displayedCount = useMemo(
    () => wordsQuery.data?.pages.reduce((sum, page) => sum + page.items.length, 0) ?? 0,
    [wordsQuery.data?.pages],
  );

  const hasResults = Boolean(wordsQuery.data?.pages.length);

  return (
    <div className="wmx-page">
      <PageSEO
        title="Explore Word Maker"
        description="Explore the dictionary word family that can be formed from a base word."
        path="/explore/word-maker"
      />
      <div className="wmx-shell">
        <Link href="/game/word-maker" className="wmx-back"><ArrowLeft size={16} aria-hidden="true" /> Back to Word Maker</Link>
        <header className="wmx-hero">
          <div>
            <div className="wmx-eyebrow">Word Maker · Explore</div>
            <h1 className="wmx-heading">Find the words<br /><em>in the letters.</em></h1>
            <p className="wmx-intro">
              Search a base word to explore its dictionary word family. This reference can also be useful when hosting a word game in person or over a call.
            </p>
          </div>
        </header>

        <div className="wmx-workspace">
          <BaseWordPicker selectedBase={selectedBase} onSelectBase={setSelectedBase}
            displayedCount={wordsQuery.data ? displayedCount : null} />

          <div className="wmx-main">
            <section className="wmx-panel wmx-content" aria-labelledby="wmx-results-heading">
              <div className="wmx-content-head">
                <div>
                  <h2 id="wmx-results-heading">Word list</h2>
                  <p>{selectedBase
                    ? `Words made from “${prettify(selectedBase)}”, in alphabetical order.`
                    : "Choose a base word to see its word family."}</p>
                </div>
                {hasResults && <span className="wmx-count-pill">{displayedCount} loaded</span>}
              </div>

              {wordsQuery.data?.pages.some((page) => page.source === "preview") && (
                <p className="wmx-preview-note">
                  Preview mode shows a small sample. The connected database can provide more words across additional pages.
                </p>
              )}

              {!selectedBase ? (
                <div className="wmx-empty"><div><strong>Start with a base word</strong>Search above or try a surprise pick to open its word family.</div></div>
              ) : wordsQuery.isLoading ? (
                <LoadingGrid />
              ) : wordsQuery.isError && !hasResults && wordsQuery.error instanceof WordMakerRequestError && wordsQuery.error.status === 404 ? (
                <div className="wmx-empty" role="status"><div><strong>Word not found</strong>
                  “{selectedBase}” was not found in the available dictionary. Try another word.
                </div></div>
              ) : wordsQuery.isError && !hasResults ? (
                <div className="wmx-error" role="alert">The word list could not be loaded. <button type="button" className="wmx-retry" onClick={() => wordsQuery.refetch()}>Try again</button></div>
              ) : displayedCount === 0 ? (
                <div className="wmx-empty"><div><strong>No linked words found</strong>
                  “{selectedBase}” exists in the dictionary, but no matching derivatives are listed for it.
                </div></div>
              ) : (
                <>
                  {wordsQuery.isError && <div className="wmx-error" role="alert">The next page could not be loaded. <button type="button" className="wmx-retry" onClick={() => wordsQuery.fetchNextPage()}>Retry</button></div>}
                  <WordRows pages={wordsQuery.data?.pages ?? []} />
                  {wordsQuery.hasNextPage && (
                    <button type="button" className="wmx-load-more" disabled={wordsQuery.isFetchingNextPage} onClick={() => wordsQuery.fetchNextPage()}>
                      {wordsQuery.isFetchingNextPage ? "Loading more words…" : <>Load next 100 words <ChevronDown size={15} aria-hidden="true" /></>}
                    </button>
                  )}
                  {wordsQuery.isFetchingNextPage && <div className="wmx-note" role="status">Fetching the next alphabetized page…</div>}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
