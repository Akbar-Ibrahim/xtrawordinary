import { useEffect, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dices, Search, X } from "lucide-react";
import { readExploreJson } from "./api";
import type { BaseWordsResponse } from "../types";

const BASE_WORDS_URL = "/api/explore/anagrams/base-words";
const normalize = (word: string) => word.trim().toUpperCase();

interface Props {
  selectedBase: string;
  onSelectBase: (baseWord: string) => void;
  mode: "browse" | "host";
  onModeChange: (mode: "browse" | "host") => void;
}

export function BaseWordPicker({ selectedBase, onSelectBase, mode, onModeChange }: Props) {
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const baseQuery = useQuery<BaseWordsResponse>({
    queryKey: [BASE_WORDS_URL, debouncedSearch],
    queryFn: () => readExploreJson(`${BASE_WORDS_URL}?q=${encodeURIComponent(debouncedSearch)}&limit=20`),
    enabled: showSuggestions && debouncedSearch.length > 0 && normalize(debouncedSearch) !== selectedBase,
    staleTime: 30_000,
    retry: 1,
  });
  const suggestions = baseQuery.data?.items ?? [];
  const randomMutation = useMutation({
    mutationFn: () => readExploreJson<{ baseWord: string }>(`${BASE_WORDS_URL}/random`),
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
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        selectBase(suggestions[activeSuggestion].baseWord);
      } else if (suggestions.length === 1) {
        selectBase(suggestions[0].baseWord);
      }
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <aside className="wmx-panel wmx-controls" aria-label="Explore controls">
      <p className="wmx-section-label">Choose your way to play</p>
      <div className="wmx-mode" role="group" aria-label="Explore mode">
        <button type="button" aria-pressed={mode === "browse"} onClick={() => onModeChange("browse")}>Browse words</button>
        <button type="button" aria-pressed={mode === "host"} onClick={() => onModeChange("host")}>Host a game night</button>
      </div>

      <label className="wmx-section-label" htmlFor="ax-base-word">Base word</label>
      <div className="wmx-search-wrap">
        <Search className="wmx-search-icon" size={17} aria-hidden="true" />
        <input
          id="ax-base-word"
          type="search"
          value={searchText}
          placeholder="Search a base word"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-controls="ax-base-suggestions"
          aria-activedescendant={activeSuggestion >= 0 ? `ax-suggestion-${activeSuggestion}` : undefined}
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
      {showSuggestions && debouncedSearch && (
        baseQuery.isLoading ? (
          <div className="wmx-note" role="status">Looking up base words…</div>
        ) : baseQuery.isError ? (
          <div className="wmx-error" role="alert">
            Could not search base words. <button type="button" className="wmx-retry" onClick={() => baseQuery.refetch()}>Try again</button>
          </div>
        ) : suggestions.length > 0 ? (
          <ul className="wmx-suggestions" id="ax-base-suggestions" role="listbox" aria-label="Matching base words">
            {suggestions.map((item, index) => (
              <li key={item.baseWord} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={activeSuggestion === index}
                  id={`ax-suggestion-${index}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectBase(item.baseWord)}
                >
                  <strong>{item.baseWord.toUpperCase()}</strong><span>Explore</span>
                </button>
              </li>
            ))}
          </ul>
        ) : !baseQuery.isFetching ? <div className="wmx-note">No matching base words found.</div> : null
      )}
      <button type="button" className="wmx-random" disabled={randomMutation.isPending} onClick={() => randomMutation.mutate()}>
        <Dices size={16} aria-hidden="true" />
        {randomMutation.isPending ? "Choosing…" : "Choose a random word"}
      </button>
      {randomMutation.isError && <div className="wmx-error" role="alert">Could not choose a random word. Try again.</div>}
      {selectedBase ? (
        <div className="wmx-current"><div><small>Selected base</small><strong>{selectedBase}</strong></div></div>
      ) : (
        <p className="wmx-note">Search for a word or choose one at random.</p>
      )}
    </aside>
  );
}
