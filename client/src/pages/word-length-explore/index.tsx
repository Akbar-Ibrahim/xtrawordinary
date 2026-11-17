import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { normalizeWordLengthPattern, type WordLengthExplorePattern } from "@shared/word-length-explore";
import { searchWordLengthWords } from "./api";
import { WordLengthExploreControls } from "./components/WordLengthExploreControls";
import { WordLengthExploreResults } from "./components/WordLengthExploreResults";
import { WordLengthWordChecker } from "./components/WordLengthWordChecker";
import type { WordLengthExplorePage } from "./types";

const DEFAULT_PATTERN: WordLengthExplorePattern = { variation: 1, length: 5 };

export default function WordLengthExplore() {
  const [pattern, setPattern] = useState<WordLengthExplorePattern>(DEFAULT_PATTERN);
  const [searchedPattern, setSearchedPattern] = useState<WordLengthExplorePattern | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);

  const resultsQuery = useInfiniteQuery<WordLengthExplorePage>({
    queryKey: ["/api/explore/word-length/words", searchedPattern, searchVersion],
    queryFn: ({ pageParam }) => searchWordLengthWords(searchedPattern!, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: searchedPattern !== null,
  });

  function runSearch(nextPattern: WordLengthExplorePattern) {
    const normalized = normalizeWordLengthPattern(nextPattern);
    setSearchedPattern(normalized);
    setSearchVersion((version) => version + 1);
  }

  const pages = resultsQuery.data?.pages ?? [];
  const lastPage = pages[pages.length - 1];
  const items = pages.flatMap((page) => page.items);

  return (
    <div className="container mx-auto min-w-0 max-w-7xl px-4 py-8">
      <PageSEO
        title="Explore Length Challenge"
        description="Browse dictionary words by length and letter pattern."
        path="/explore/word-length"
      />
      <Link
        href="/game/word-length"
        className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to Length Challenge
      </Link>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Length Challenge · Explore</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Explore words by length and pattern.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Browse the dictionary using Length Challenge’s five letter patterns, or check a word against your current settings.
        </p>
      </header>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(280px,350px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <WordLengthExploreControls
            pattern={pattern}
            isSearching={resultsQuery.isFetching}
            onPatternChange={setPattern}
            onSearch={runSearch}
          />
          <WordLengthWordChecker key={JSON.stringify(pattern)} pattern={pattern} />
        </div>
        <WordLengthExploreResults
          pattern={searchedPattern}
          isLoading={resultsQuery.isLoading}
          isLoadingMore={resultsQuery.isFetchingNextPage}
          hasError={resultsQuery.isError}
          result={lastPage}
          items={items}
          onRetry={() => { void resultsQuery.refetch(); }}
          onLoadMore={() => {
            if (resultsQuery.hasNextPage && !resultsQuery.isFetchingNextPage) {
              void resultsQuery.fetchNextPage();
            }
          }}
        />
      </div>
    </div>
  );
}
