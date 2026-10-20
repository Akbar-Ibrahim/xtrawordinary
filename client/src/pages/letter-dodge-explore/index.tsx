import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { LetterDodgeControls } from "./components/LetterDodgeControls";
import { LetterDodgeHostChecker } from "./components/LetterDodgeHostChecker";
import { LetterDodgeResults } from "./components/LetterDodgeResults";
import { searchLetterDodge } from "./api";
import type { LetterDodgeSearchResponse } from "./types";

export default function LetterDodgeExplore() {
  const [forbiddenLetters, setForbiddenLetters] = useState("");
  const [searchedLetters, setSearchedLetters] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);

  const resultsQuery = useInfiniteQuery<LetterDodgeSearchResponse>({
    queryKey: ["/api/explore/letter-dodge/words", searchedLetters, searchVersion],
    queryFn: ({ pageParam }) => searchLetterDodge(searchedLetters, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: !!searchedLetters,
  });

  function runSearch(nextLetters: string) {
    const normalizedLetters = [...new Set(nextLetters.replace(/[^a-z]/gi, "").toUpperCase())].sort().join("");
    setForbiddenLetters(normalizedLetters);
    setSearchedLetters(normalizedLetters);
    setSearchVersion((version) => version + 1);
  }

  const pages = resultsQuery.data?.pages ?? [];
  const lastPage = pages[pages.length - 1];
  const items = pages.flatMap((page) => page.items);

  return (
    <div className="container mx-auto min-w-0 max-w-7xl px-4 py-8">
      <PageSEO
        title="Explore Letter Dodge"
        description="Choose forbidden letters and find dictionary words that avoid them."
        path="/explore/letter-dodge"
      />
      <Link href="/game/letter-dodge" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Back to Letter Dodge
      </Link>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-destructive">Letter Dodge · Explore</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Which letters should words avoid?</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Enter letters to keep out of the word. Browse matching dictionary entries, including short words, or check a spoken answer for your game night.
        </p>
      </header>

      <div className="mt-8 space-y-5">
        <LetterDodgeControls
          letters={forbiddenLetters}
          isSearching={resultsQuery.isFetching}
          onSetLetters={setForbiddenLetters}
          onSearch={runSearch}
        />
        <LetterDodgeResults
          letters={searchedLetters}
          isLoading={resultsQuery.isLoading}
          isLoadingMore={resultsQuery.isFetchingNextPage}
          error={resultsQuery.isError}
          errorMessage={resultsQuery.error instanceof Error ? resultsQuery.error.message : "The dictionary search failed."}
          result={lastPage}
          items={items}
          onRetry={() => { void resultsQuery.refetch(); }}
          onLoadMore={() => { if (resultsQuery.hasNextPage && !resultsQuery.isFetchingNextPage) void resultsQuery.fetchNextPage(); }}
        />
        <LetterDodgeHostChecker key={forbiddenLetters} forbiddenLetters={forbiddenLetters} />
      </div>
    </div>
  );
}
