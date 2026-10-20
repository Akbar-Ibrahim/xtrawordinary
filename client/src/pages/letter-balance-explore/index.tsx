import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { searchLetterBalanceWords } from "./api";
import { LetterBalanceExploreControls } from "./components/LetterBalanceExploreControls";
import { LetterBalanceExploreResults } from "./components/LetterBalanceExploreResults";
import { LetterBalanceHostChecker } from "./components/LetterBalanceHostChecker";
import type { LetterBalanceExploreFilters, LetterBalanceExplorePage } from "./types";

const INITIAL_FILTERS: LetterBalanceExploreFilters = {
  category: "vowel_count",
  count: 2,
};

export default function LetterBalanceExplore() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [submitted, setSubmitted] = useState<LetterBalanceExploreFilters | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const resultsQuery = useInfiniteQuery<LetterBalanceExplorePage>({
    queryKey: ["/api/explore/letter-balance/words", submitted, searchVersion],
    queryFn: ({ pageParam }) => searchLetterBalanceWords(submitted!, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: submitted !== null,
  });

  function runSearch(nextFilters: LetterBalanceExploreFilters) {
    setSubmitted({ ...nextFilters });
    setSearchVersion((version) => version + 1);
  }

  const pages = resultsQuery.data?.pages ?? [];
  const lastPage = pages[pages.length - 1];
  const words = pages.flatMap((page) => page.items.map(({ word }) => word));
  const errorMessage = resultsQuery.error instanceof Error ? resultsQuery.error.message : undefined;

  return (
    <div className="container mx-auto min-w-0 max-w-7xl px-4 py-8">
      <PageSEO
        title="Explore Vowel & Consonant"
        description="Browse words by vowel and consonant patterns, or check an answer during a game night."
        path="/explore/letter-balance"
      />
      <Link href="/game/letter-balance" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Back to Vowel & Consonant
      </Link>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Vowel & Consonant · Explore</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Explore the shape of words.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Browse dictionary words by vowel and consonant patterns, or check an answer someone says aloud.
          Y counts as a consonant. Explore includes short words and does not change game validation or scoring.
        </p>
      </header>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <LetterBalanceExploreControls
            filters={filters}
            isSearching={resultsQuery.isFetching}
            onChange={setFilters}
            onSearch={runSearch}
          />
          <LetterBalanceHostChecker filters={filters} />
        </div>
        <LetterBalanceExploreResults
          hasSearched={submitted !== null}
          isLoading={resultsQuery.isLoading}
          isLoadingMore={resultsQuery.isFetchingNextPage}
          error={resultsQuery.isError}
          errorMessage={errorMessage}
          result={lastPage}
          words={words}
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
