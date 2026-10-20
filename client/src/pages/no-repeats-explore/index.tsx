import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { searchNoRepeatsWords } from "./api";
import { NoRepeatsExploreControls } from "./components/NoRepeatsExploreControls";
import { NoRepeatsExploreResults } from "./components/NoRepeatsExploreResults";
import { NoRepeatsHostChecker } from "./components/NoRepeatsHostChecker";
import type { NoRepeatsExploreFilters, NoRepeatsSearchResponse } from "./types";

export default function NoRepeatsExplore() {
  const [length, setLength] = useState<number | undefined>(undefined);
  const [requiredLetters, setRequiredLetters] = useState("");
  const [submitted, setSubmitted] = useState<NoRepeatsExploreFilters | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);

  const activeFilters = { length, requiredLetters };
  const resultsQuery = useInfiniteQuery<NoRepeatsSearchResponse>({
    queryKey: [
      "/api/explore/no-repeats/words",
      submitted ? JSON.stringify(submitted) : null,
      searchVersion,
    ],
    queryFn: ({ pageParam }) => searchNoRepeatsWords(submitted!, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: submitted !== null,
  });

  function runSearch() {
    setSubmitted({ ...activeFilters });
    setSearchVersion((version) => version + 1);
  }

  const pages = resultsQuery.data?.pages ?? [];
  const lastPage = pages[pages.length - 1];
  const words = pages.flatMap((page) => page.items.map(({ word }) => word));
  const errorMessage = resultsQuery.error instanceof Error ? resultsQuery.error.message : undefined;

  return (
    <div className="container mx-auto min-w-0 max-w-7xl px-4 py-8">
      <PageSEO
        title="Explore No Repeats"
        description="Browse dictionary words with no repeated letters or check an answer someone says aloud."
        path="/explore/no-repeats"
      />
      <Link href="/game/no-repeats" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Back to No Repeats
      </Link>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">No Repeats · Explore</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Find words with no repeated letters.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Browse isograms in the dictionary or check a word someone says aloud. Explore is for discovery and hosting; it does not change game validation or scoring.
        </p>
      </header>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(280px,350px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <NoRepeatsExploreControls
            length={length}
            requiredLetters={requiredLetters}
            isSearching={resultsQuery.isFetching}
            onLengthChange={setLength}
            onRequiredLettersChange={setRequiredLetters}
            onSearch={runSearch}
          />
          <NoRepeatsHostChecker filters={activeFilters} />
        </div>
        <NoRepeatsExploreResults
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
