import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ArrowDown, ChevronDown, Dices, Search, X } from "lucide-react";
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
type CheckResponse = {
  dictionaryMatch: boolean;
  playableInGame: boolean;
  gameplayExclusion: string | null;
  source: "preview" | "database";
};
type Mode = "browse" | "host";
type CheckEntry = { word: string; result: CheckResponse };

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
              title={item.word.length < 3 ? "Valid in Explore. Normal Word Maker requires at least three letters." : "Valid in Explore and Host mode"}
            >
              <span className="wmx-status-dot" aria-hidden="true" />
              {item.word.length < 3 ? "Short word" : "Valid"}
            </span>
          </div>
        ))}
      </div>
      <p className="wmx-letters">Alphabetical order · all listed words are valid in Host mode, including short words</p>
    </>
  );
}

export default function WordMakerExplore() {
  const [mode, setMode] = useState<Mode>("browse");
  const [searchText, setSearchText] = useState("");
  const [selectedBase, setSelectedBase] = useState("");
  const [answer, setAnswer] = useState("");
  const [lastCheck, setLastCheck] = useState<CheckEntry | null>(null);
  const [checkedWords, setCheckedWords] = useState<CheckEntry[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const answerRef = useRef<HTMLInputElement>(null);

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
    enabled: Boolean(selectedBase) && (mode === "browse" || revealed),
    staleTime: 60_000,
    retry: 1,
  });
  const randomMutation = useMutation({
    mutationFn: () => readJson<{ baseWord: string }>("/api/explore/word-maker/base-words/random"),
    onSuccess: ({ baseWord }) => selectBase(baseWord),
  });
  const checkMutation = useMutation({
    mutationFn: (word: string) => readJson<CheckResponse>("/api/explore/word-maker/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseWord: selectedBase, answer: word }),
    }),
    onSuccess: (result, word) => {
      const entry = { word, result };
      setLastCheck(entry);
      if (result.dictionaryMatch && !checkedWords.some((item) => item.word.toLowerCase() === word.toLowerCase())) {
        setCheckedWords((previous) => [...previous, entry]);
      }
      setAnswer("");
      answerRef.current?.focus();
    },
  });

  const displayedCount = useMemo(
    () => wordsQuery.data?.pages.reduce((sum, page) => sum + page.items.length, 0) ?? 0,
    [wordsQuery.data?.pages],
  );
  const duplicate = checkedWords.some((item) => item.word.toLowerCase() === answer.trim().toLowerCase());

  function selectBase(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    setSelectedBase(normalized);
    setSearchText(normalized);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    setAnswer("");
    setLastCheck(null);
    setCheckedWords([]);
    setRevealed(false);
  }

  function onSearchChange(value: string) {
    setSearchText(value.replace(/[^a-zA-Z]/g, ""));
    setShowSuggestions(true);
    setActiveSuggestion(-1);
  }

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = answer.trim().toUpperCase();
    if (!selectedBase || candidate.length < 1 || checkMutation.isPending || duplicate) return;
    setLastCheck(null);
    checkMutation.mutate(candidate);
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
        description="Browse words made from a base word or use xtraWordinary to host a spoken Word Maker game night."
        path="/explore/word-maker"
      />
      <div className="wmx-shell">
        <Link href="/game/word-maker" className="wmx-back"><ArrowLeft size={16} aria-hidden="true" /> Back to Word Maker</Link>
        <header className="wmx-hero">
          <div>
            <div className="wmx-eyebrow">Word Maker · Explore</div>
            <h1 className="wmx-heading">Find the words<br /><em>in the letters.</em></h1>
            <p className="wmx-intro">
              Look closer at a base word, or bring it to your next game night. You host the room and check suggestions as they are spoken — players never need to submit answers here.
            </p>
          </div>
        </header>

        <div className="wmx-workspace">
          <aside className="wmx-panel wmx-controls" aria-label="Explore controls">
            <p className="wmx-section-label">Choose your way to play</p>
            <div className="wmx-mode" role="group" aria-label="Explore mode">
              <button type="button" aria-pressed={mode === "browse"} onClick={() => setMode("browse")}>Browse words</button>
              <button type="button" aria-pressed={mode === "host"} onClick={() => setMode("host")}>Host a game night</button>
            </div>

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
                <div><small>Playing with</small><strong>{prettify(selectedBase)}</strong></div>
                {wordsQuery.data && <div className="wmx-current-count">{displayedCount} loaded</div>}
              </div>
            ) : <p className="wmx-note">Search by the beginning of a word, pick a suggestion, or let chance choose one.</p>}
            <p className="wmx-note">
              Browse shows the word family. In host mode, the complete reference list stays hidden until you reveal it.
            </p>
          </aside>

          <main className="wmx-main">
            <section className="wmx-panel wmx-content" aria-labelledby="wmx-results-heading">
              {mode === "host" && selectedBase && (
                <div className="wmx-host-card">
                  <div className="wmx-host-top">
                    <div>
                      <h3>Host’s answer desk</h3>
                      <p>Your players say words aloud. Enter each suggestion to check it against the same word list as Browse. One- and two-letter words count too. This page doesn’t track players or scores; keep points yourself.</p>
                    </div>
                    <span className="wmx-host-tag">HOST ONLY</span>
                  </div>
                  <form className="wmx-answer-form" onSubmit={submitAnswer}>
                    <input
                      ref={answerRef}
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
                      placeholder="Type a spoken suggestion"
                      aria-label="Check a spoken word suggestion"
                      autoComplete="off"
                    />
                    <button type="submit" disabled={answer.trim().length < 1 || checkMutation.isPending || duplicate}>
                      {checkMutation.isPending ? "Checking…" : "Check word"}
                    </button>
                  </form>
                  <div className={`wmx-check-result${lastCheck ? (lastCheck.result.dictionaryMatch ? " good" : " bad") : checkMutation.isError ? " bad" : ""}`} role="status" aria-live="polite">
                    {duplicate ? "Already checked as a valid answer in this session." : checkMutation.isPending ? "Checking the word list…" : lastCheck
                      ? !lastCheck.result.dictionaryMatch
                        ? lastCheck.result.gameplayExclusion === "letters_not_available"
                          ? `${lastCheck.word} cannot be made from ${selectedBase.toUpperCase()}: there are not enough matching letters.`
                          : lastCheck.result.gameplayExclusion === "base_word_not_a_subword"
                            ? "Enter a word made from the base word, not the base word itself."
                            : lastCheck.result.gameplayExclusion === "not_in_word_maker_derivatives"
                              ? `${lastCheck.word} is not listed for ${selectedBase.toUpperCase()}${lastCheck.result.source === "preview" ? " in this small preview sample" : " in the database"}.`
                              : `${lastCheck.word} was not found in ${lastCheck.result.source === "preview" ? "the preview dictionary" : "the dictionary"}.`
                        : `${lastCheck.word} is a valid answer for this game night.`
                      : checkMutation.isError ? "The check could not be completed. Try again." : "Any word listed in Browse is valid here, including one- and two-letter words."}
                  </div>
                  {checkedWords.length > 0 && (
                    <div className="wmx-session">
                      <h3>Valid answers checked · {checkedWords.length}</h3>
                      <div className="wmx-session-list">
                        {checkedWords.map(({ word }) => (
                          <span className="wmx-session-word" key={word}>
                            {word.toUpperCase()} <small>VALID</small>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="wmx-content-head">
                <div>
                  <h2 id="wmx-results-heading">{mode === "host" ? "Full word list" : "Word list"}</h2>
                  <p>{selectedBase
                    ? mode === "host" && !revealed
                      ? "The complete list is hidden so it won’t reveal possible answers to players. Reveal it when you’re ready."
                      : `Words made from “${prettify(selectedBase)}”, in alphabetical order.`
                    : "Choose a base word to see its word family."}</p>
                </div>
                {(mode === "browse" || revealed) && hasResults && <span className="wmx-count-pill">{displayedCount} loaded</span>}
                {mode === "host" && revealed && (
                  <button type="button" className="wmx-hide-answer" onClick={() => setRevealed(false)}>
                    <X size={14} aria-hidden="true" /> Hide answer list
                  </button>
                )}
              </div>

              {(mode === "browse" || revealed) && wordsQuery.data?.pages.some((page) => page.source === "preview") && (
                <p className="wmx-preview-note">
                  Preview mode shows a small sample. The connected database can provide more words across additional pages.
                </p>
              )}

              {!selectedBase ? (
                <div className="wmx-empty"><div><strong>Start with a base word</strong>Search above or try a surprise pick to open its word family.</div></div>
              ) : mode === "host" && !revealed ? (
                <button type="button" className="wmx-reveal" onClick={() => setRevealed(true)}>
                  Reveal all possible words <ArrowDown size={15} aria-hidden="true" />
                </button>
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
            {mode === "host" && (
              <p className="wmx-note" style={{ textAlign: "center" }}>
                Keep this screen with the host. Say the base word aloud, collect spoken suggestions, and use the checker to verify them; scorekeeping stays with you.
              </p>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
