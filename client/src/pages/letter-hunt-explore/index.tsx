import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { LetterHuntControls } from "./components/LetterHuntControls";
import { LetterHuntHostChecker } from "./components/LetterHuntHostChecker";
import { LetterHuntResults } from "./components/LetterHuntResults";
import { searchLetterHunt } from "./api";
import type { LetterHuntSearchResponse } from "./types";

export default function LetterHuntExplore() {
  const [letters, setLetters] = useState("");
  const [ordered, setOrdered] = useState(false);
  const [searchedLetters, setSearchedLetters] = useState("");
  const [searchedOrdered, setSearchedOrdered] = useState(false);
  const [searchVersion, setSearchVersion] = useState(0);

  const resultsQuery = useInfiniteQuery<LetterHuntSearchResponse>({
    queryKey: ["/api/explore/letter-hunt/words", searchedLetters, searchedOrdered, searchVersion],
    queryFn: ({ pageParam }) => searchLetterHunt(searchedLetters, searchedOrdered, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: !!searchedLetters,
  });

  function runSearch(nextLetters: string, nextOrdered: boolean) {
    const normalizedLetters = nextLetters.replace(/[^a-z]/gi, "").slice(0, 12).toUpperCase();
    setLetters(normalizedLetters);
    setOrdered(nextOrdered);
    setSearchedLetters(normalizedLetters);
    setSearchedOrdered(nextOrdered);
    setSearchVersion((version) => version + 1);
  }

  const pages = resultsQuery.data?.pages ?? [];
  const lastPage = pages[pages.length - 1];
  const items = pages.flatMap((page) => page.items);

  return (
    <div className="container mx-auto min-w-0 max-w-7xl px-4 py-8">
      <PageSEO
        title="Explore Letter Hunt"
        description="Find dictionary words containing required letters, in order or any order."
        path="/explore/letter-hunt"
      />
      <Link href="/game/letter-hunt" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Back to Letter Hunt
      </Link>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Letter Hunt · Explore</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Find words that meet your pattern.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Explore dictionary matches for required letters. Set repeated letters and decide whether their order matters, then use the checker for spoken answers.
        </p>
      </header>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(280px,350px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <LetterHuntControls
            letters={letters}
            ordered={ordered}
            isSearching={resultsQuery.isFetching}
            onLettersChange={setLetters}
            onOrderedChange={setOrdered}
            onSearch={runSearch}
          />
          <LetterHuntHostChecker key={`${letters}:${ordered}`} letters={letters} ordered={ordered} />
        </div>
        <LetterHuntResults
          letters={searchedLetters}
          ordered={searchedOrdered}
          isLoading={resultsQuery.isLoading}
          isLoadingMore={resultsQuery.isFetchingNextPage}
          error={resultsQuery.isError}
          errorMessage={resultsQuery.error instanceof Error ? resultsQuery.error.message : "The dictionary search failed."}
          result={lastPage}
          items={items}
          onRetry={() => { void resultsQuery.refetch(); }}
          onLoadMore={() => { if (resultsQuery.hasNextPage && !resultsQuery.isFetchingNextPage) void resultsQuery.fetchNextPage(); }}
        />
      </div>
    </div>
  );
}
