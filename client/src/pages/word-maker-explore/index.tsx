import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ChevronDown, Dices, Search, X } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import "./styles.css";

type BaseWord = { baseWord: string };
type BaseWordsResponse = {
  items: BaseWord[];
  page: { limit: number; nextCursor: string | null; hasMore: boolean };
};
type ExploreWord = { word: string; playableInGame: boolean; gameplayExclusion: string | null };
type WordsResponse = {
  baseWord: string;
  items: ExploreWord[];
  page: { limit: number; nextCursor: string | null; hasMore: boolean };
  source: "preview" | "database";
};
async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

const baseWordKey = (query: string) => ["/api/explore/word-maker/base-words", query] as const;
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
  const [searchText, setSearchText] = useState("");
  const [selectedBase, setSelectedBase] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const baseQuery = useQuery<BaseWordsResponse>({
    queryKey: baseWordKey(debouncedSearch),
    queryFn: () => readJson(`/api/explore/word-maker/base-words?q=${encodeURIComponent(debouncedSearch)}&limit=20`),
    enabled: showSuggestions && debouncedSearch.length > 0 && debouncedSearch !== selectedBase.toLowerCase(),
    staleTime: 30_000,
    retry: 1,
  });
  const suggestions = baseQuery.data?.items ?? [];
  const wordsQuery = useInfiniteQuery<WordsResponse>({
    queryKey: wordsKey(selectedBase),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ baseWord: selectedBase, limit: "100" });
      if (typeof pageParam === "string" && pageParam) params.set("cursor", pageParam);
      return readJson(`/api/explore/word-maker/words?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: Boolean(selectedBase),
    staleTime: 60_000,
    retry: 1,
  });
  const randomMutation = useMutation({
    mutationFn: () => readJson<{ baseWord: string }>("/api/explore/word-maker/base-words/random"),
    onSuccess: ({ baseWord }) => selectBase(baseWord),
  });
  const displayedCount = useMemo(
    () => wordsQuery.data?.pages.reduce((sum, page) => sum + page.items.length, 0) ?? 0,
    [wordsQuery.data?.pages],
  );

  function selectBase(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    setSelectedBase(normalized);
    setSearchText(normalized);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
  }

  function onSearchChange(value: string) {
    setSearchText(value.replace(/[^a-zA-Z]/g, ""));
    setShowSuggestions(true);
    setActiveSuggestion(-1);
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) selectBase(suggestions[activeSuggestion].baseWord);
      else if (suggestions.length === 1) selectBase(suggestions[0].baseWord);
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
    }
  }

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
          <aside className="wmx-panel wmx-controls" aria-label="Explore controls">
            <label className="wmx-section-label" htmlFor="wmx-base-word">Base word</label>
            <div className="wmx-search-wrap">
              <Search className="wmx-search-icon" size={17} aria-hidden="true" />
              <input
                id="wmx-base-word"
                type="search"
                value={searchText}
                placeholder="Search a base word"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-controls="wmx-base-suggestions"
                aria-activedescendant={activeSuggestion >= 0 ? `wmx-suggestion-${activeSuggestion}` : undefined}
                onFocus={() => setShowSuggestions(true)}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={onSearchKeyDown}
              />
              {searchText && <button className="wmx-clear-search" aria-label="Clear base word search" type="button" onClick={() => onSearchChange("")}><X size={15} /></button>}
            </div>
            {showSuggestions && debouncedSearch && (
              baseQuery.isLoading ? (
                <div className="wmx-note" role="status">Looking up base words…</div>
              ) : baseQuery.isError ? (
                <div className="wmx-error" role="alert">Could not search base words. <button type="button" className="wmx-retry" onClick={() => baseQuery.refetch()}>Try again</button></div>
              ) : suggestions.length > 0 ? (
                <ul className="wmx-suggestions" id="wmx-base-suggestions" role="listbox" aria-label="Matching base words">
                  {suggestions.map((item, index) => (
                    <li key={item.baseWord} role="none">
                      <button type="button" role="option" aria-selected={activeSuggestion === index} id={`wmx-suggestion-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => selectBase(item.baseWord)}>
                        <strong>{prettify(item.baseWord)}</strong><span>Explore</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : !baseQuery.isFetching ? <div className="wmx-note">No base words match that search yet.</div> : null
            )}
            <button type="button" className="wmx-random" disabled={randomMutation.isPending} onClick={() => randomMutation.mutate()}>
              <Dices size={16} aria-hidden="true" /> {randomMutation.isPending ? "Finding a word…" : "Surprise me"}
            </button>
            {randomMutation.isError && <div className="wmx-error" role="alert">A random word could not be loaded. <button type="button" className="wmx-retry" onClick={() => randomMutation.mutate()}>Retry</button></div>}

            {selectedBase ? (
              <div className="wmx-current" aria-live="polite">
                <div><small>Exploring</small><strong>{prettify(selectedBase)}</strong></div>
                {wordsQuery.data && <div className="wmx-current-count">{displayedCount} loaded</div>}
              </div>
            ) : <p className="wmx-note">Search by the beginning of a word, pick a suggestion, or let chance choose one.</p>}
          </aside>

          <main className="wmx-main">
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
              ) : wordsQuery.isError && !hasResults ? (
                <div className="wmx-error" role="alert">The word list could not be loaded. <button type="button" className="wmx-retry" onClick={() => wordsQuery.refetch()}>Try again</button></div>
              ) : displayedCount === 0 ? (
                <div className="wmx-empty"><div><strong>No words found</strong>Try another base word to explore a different set of letters.</div></div>
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
          </main>
        </div>
      </div>
    </div>
  );
}
