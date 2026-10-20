import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { searchLetterFrequency } from "./api";
import { describeFrequencyRule } from "./format";
import { LetterFrequencyExploreControls } from "./components/LetterFrequencyExploreControls";
import { LetterFrequencyExploreResults } from "./components/LetterFrequencyExploreResults";
import { LetterFrequencyHostChecker } from "./components/LetterFrequencyHostChecker";
import type {
  FrequencyExploreMode,
  LetterFrequencyConstraint,
  LetterFrequencyMatch,
  LetterFrequencySearchResponse,
} from "./types";

export default function LetterFrequencyExplore() {
  const [mode, setMode] = useState<FrequencyExploreMode>("single");
  const [singleConstraint, setSingleConstraint] = useState<LetterFrequencyConstraint>({ letter: "E", count: 2 });
  const [singleMatch, setSingleMatch] = useState<LetterFrequencyMatch>("exact");
  const [multiConstraints, setMultiConstraints] = useState<LetterFrequencyConstraint[]>([
    { letter: "A", count: 2 },
    { letter: "E", count: 1 },
  ]);
  const [submitted, setSubmitted] = useState<{
    constraints: LetterFrequencyConstraint[];
    match: LetterFrequencyMatch;
  } | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);

  const activeConstraints = mode === "single" ? [singleConstraint] : multiConstraints;
  const activeMatch: LetterFrequencyMatch = mode === "single" ? singleMatch : "exact";
  const resultsQuery = useInfiniteQuery<LetterFrequencySearchResponse>({
    queryKey: [
      "/api/explore/letter-frequency/words",
      submitted ? JSON.stringify(submitted.constraints) : null,
      submitted?.match,
      searchVersion,
    ],
    queryFn: ({ pageParam }) => searchLetterFrequency(
      submitted!.constraints,
      submitted!.match,
      pageParam as string | undefined,
    ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: submitted !== null,
  });

  function runSearch() {
    setSubmitted({
      constraints: activeConstraints.map((constraint) => ({ ...constraint })),
      match: activeMatch,
    });
    setSearchVersion((version) => version + 1);
  }

  const pages = resultsQuery.data?.pages ?? [];
  const lastPage = pages[pages.length - 1];
  const words = pages.flatMap((page) => page.items.map(({ word }) => word));
  const errorMessage = resultsQuery.error instanceof Error ? resultsQuery.error.message : undefined;

  return (
    <div className="container mx-auto min-w-0 max-w-7xl px-4 py-8">
      <PageSEO
        title="Explore Letter Frequency"
        description="Browse words by letter counts or check spoken answers for a word game."
        path="/explore/letter-frequency"
      />
      <Link href="/game/letter-frequency" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Back to Letter Frequency
      </Link>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Letter Frequency · Explore</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Find words by letter count.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Browse the dictionary or check a word someone says aloud. Explore checks the selected letter counts without changing the game’s scoring or rules.
        </p>
      </header>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(280px,390px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <LetterFrequencyExploreControls
            mode={mode}
            singleConstraint={singleConstraint}
            singleMatch={singleMatch}
            multiConstraints={multiConstraints}
            isSearching={resultsQuery.isFetching}
            onModeChange={setMode}
            onSingleConstraintChange={setSingleConstraint}
            onSingleMatchChange={setSingleMatch}
            onMultiConstraintsChange={setMultiConstraints}
            onSearch={runSearch}
          />
          <LetterFrequencyHostChecker constraints={activeConstraints} match={activeMatch} />
        </div>
        <LetterFrequencyExploreResults
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
