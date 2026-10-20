import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { searchLetterPosition } from "./api";
import { LetterPositionExploreControls } from "./components/LetterPositionExploreControls";
import { LetterPositionExploreResults } from "./components/LetterPositionExploreResults";
import { LetterPositionHostChecker } from "./components/LetterPositionHostChecker";
import type { LetterPositionSearchResponse } from "./types";

export default function LetterPositionExplore() {
  const [letter, setLetter] = useState("");
  const [position, setPosition] = useState(1);
  const [searchedLetter, setSearchedLetter] = useState("");
  const [searchedPosition, setSearchedPosition] = useState(1);
  const [searchVersion, setSearchVersion] = useState(0);

  const resultsQuery = useInfiniteQuery<LetterPositionSearchResponse>({
    queryKey: ["/api/explore/letter-position/words", searchedLetter, searchedPosition, searchVersion],
    queryFn: ({ pageParam }) => searchLetterPosition(searchedLetter, searchedPosition, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: !!searchedLetter,
  });

  function runSearch(nextLetter: string, nextPosition: number) {
    const normalizedLetter = nextLetter.replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase();
    if (!normalizedLetter || !Number.isInteger(nextPosition) || nextPosition < 1 || nextPosition > 8) return;
    setLetter(normalizedLetter);
    setPosition(nextPosition);
    setSearchedLetter(normalizedLetter);
    setSearchedPosition(nextPosition);
    setSearchVersion((version) => version + 1);
  }

  const pages = resultsQuery.data?.pages ?? [];
  const lastPage = pages[pages.length - 1];
  const items = pages.flatMap((page) => page.items);

  return (
    <div className="container mx-auto min-w-0 max-w-7xl px-4 py-8">
      <PageSEO
        title="Explore Letter Position"
        description="Find dictionary words with a chosen letter at a specific position."
        path="/explore/letter-position"
      />
      <Link href="/game/letter-position" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Back to Letter Position
      </Link>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Letter Position · Explore</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Find words with a letter in place.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Choose a letter and position to browse dictionary matches, or check an answer someone says aloud.
        </p>
      </header>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(280px,350px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <LetterPositionExploreControls
            letter={letter}
            position={position}
            isSearching={resultsQuery.isFetching}
            onLetterChange={setLetter}
            onPositionChange={setPosition}
            onSearch={runSearch}
          />
          <LetterPositionHostChecker key={`${letter}:${position}`} letter={letter} position={position} />
        </div>
        <LetterPositionExploreResults
          letter={searchedLetter}
          position={searchedPosition}
          isLoading={resultsQuery.isLoading}
          isLoadingMore={resultsQuery.isFetchingNextPage}
          error={resultsQuery.isError}
          result={lastPage}
          items={items}
          onRetry={() => { void resultsQuery.refetch(); }}
          onLoadMore={() => {
            if (resultsQuery.hasNextPage && !resultsQuery.isFetchingNextPage) void resultsQuery.fetchNextPage();
          }}
        />
      </div>
    </div>
  );
}
