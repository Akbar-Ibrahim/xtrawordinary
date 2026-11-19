import { useEffect, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dices, Search, X } from "lucide-react";
import { ExploreIconButton } from "@/components/explore/ExploreIconButton";
import { readWordMakerJson } from "./api";

type BaseWord = { baseWord: string };
const normalize = (word: string) => word.trim().toUpperCase();
const BASE_WORDS_URL = "/api/explore/word-maker/base-words";

interface Props {
  selectedBase: string;
  displayedCount: number | null;
  onSelectBase: (word: string) => void;
}

export function BaseWordPicker({ selectedBase, displayedCount, onSelectBase }: Props) {
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const normalizedSearch = normalize(searchText);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(normalizedSearch), 220);
    return () => window.clearTimeout(timer);
  }, [normalizedSearch]);

  const lookupVisible = showSuggestions && normalizedSearch.length > 0
    && normalizedSearch === debouncedSearch && normalizedSearch !== selectedBase;
  const baseQuery = useQuery<{ items: BaseWord[] }>({
    queryKey: [BASE_WORDS_URL, debouncedSearch],
    queryFn: ({ signal }) => readWordMakerJson(
      `${BASE_WORDS_URL}?q=${encodeURIComponent(debouncedSearch)}&limit=20`, { signal },
    ),
    enabled: lookupVisible,
    staleTime: 30_000,
    retry: 1,
  });
  const suggestions = lookupVisible ? baseQuery.data?.items ?? [] : [];
  const randomMutation = useMutation({
    mutationFn: () => readWordMakerJson<{ baseWord: string }>(`${BASE_WORDS_URL}/random`),
    onSuccess: ({ baseWord }) => selectBase(baseWord),
  });

  function selectBase(value: string) {
    const normalized = normalize(value);
    if (!normalized) return;
    setSearchText(normalized);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    onSelectBase(normalized);
  }

  function onSearchChange(value: string) {
    setSearchText(value.replace(/[^a-zA-Z]/g, ""));
    setShowSuggestions(true);
    setActiveSuggestion(-1);
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectBase(suggestions[activeSuggestion]?.baseWord ?? searchText);
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }
  }

  return (
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
          aria-expanded={suggestions.length > 0}
          aria-controls="wmx-base-suggestions"
          aria-activedescendant={activeSuggestion >= 0 && suggestions[activeSuggestion]
            ? `wmx-suggestion-${activeSuggestion}` : undefined}
          onFocus={() => setShowSuggestions(true)}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        {searchText && (
          <button className="wmx-clear-search" aria-label="Clear base word search" type="button" onClick={() => onSearchChange("")}>
            <X size={15} />
          </button>
        )}
      </div>
      {lookupVisible && (
        baseQuery.isLoading ? (
          <div className="wmx-note" role="status">Looking up base words…</div>
        ) : baseQuery.isError ? (
          <div className="wmx-error" role="alert">
            Could not search base words. <button type="button" className="wmx-retry" onClick={() => baseQuery.refetch()}>Try again</button>
          </div>
        ) : suggestions.length > 0 ? (
          <ul className="wmx-suggestions" id="wmx-base-suggestions" role="listbox" aria-label="Matching base words">
            {suggestions.map((item, index) => (
              <li key={item.baseWord} role="none">
                <button type="button" role="option" aria-selected={activeSuggestion === index}
                  id={`wmx-suggestion-${index}`} onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectBase(item.baseWord)}>
                  <strong>{normalize(item.baseWord)}</strong><span>Explore</span>
                </button>
              </li>
            ))}
          </ul>
        ) : !baseQuery.isFetching ? <div className="wmx-note">No suggestions found. Press Enter to look up this word.</div> : null
      )}
      {normalizedSearch && normalizedSearch !== selectedBase && (
        <div className="mt-2 flex justify-center">
          <ExploreIconButton
            type="button"
            label={`Explore ${normalizedSearch}`}
            onClick={() => selectBase(searchText)}
            className="border-[#cbd7c9] bg-[#f3f6eb] text-[#314d3c] hover:bg-[#e8efdc]"
          />
        </div>
      )}
      <button type="button" className="wmx-random" disabled={randomMutation.isPending} onClick={() => randomMutation.mutate()}>
        <Dices size={16} aria-hidden="true" /> {randomMutation.isPending ? "Finding a word…" : "Surprise me"}
      </button>
      {randomMutation.isError && (
        <div className="wmx-error" role="alert">
          A random word could not be loaded. <button type="button" className="wmx-retry" onClick={() => randomMutation.mutate()}>Retry</button>
        </div>
      )}
      {selectedBase ? (
        <div className="wmx-current" aria-live="polite">
          <div><small>Exploring</small><strong>{selectedBase}</strong></div>
          {displayedCount !== null && <div className="wmx-current-count">{displayedCount} loaded</div>}
        </div>
      ) : <p className="wmx-note">Type a word and press Enter, pick a suggestion, or let chance choose one.</p>}
    </aside>
  );
}
