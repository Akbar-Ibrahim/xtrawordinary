import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { readUnscrambleJson } from "./api";
import { UnscrambleInputPanel } from "./components/UnscrambleInputPanel";
import { UnscrambleResults } from "./components/UnscrambleResults";
import type { UnscrambleExamplesResponse, UnscrambleResultsResponse } from "./types";
import "../word-maker-explore/styles.css";

function normalizeInput(value: string) {
  return value.replace(/[^a-z]/gi, "").toUpperCase();
}

export default function UnscrambleLettersExplore() {
  const [letters, setLetters] = useState("");
  const [submittedLetters, setSubmittedLetters] = useState("");
  const examplesQuery = useQuery<UnscrambleExamplesResponse>({
    queryKey: ["/api/explore/unscramble/examples"],
    queryFn: () => readUnscrambleJson("/api/explore/unscramble/examples?limit=6"),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const solveQuery = useInfiniteQuery<UnscrambleResultsResponse>({
    queryKey: ["/api/explore/unscramble/solve", submittedLetters],
    queryFn: ({ pageParam }) => readUnscrambleJson<UnscrambleResultsResponse>("/api/explore/unscramble/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        letters: submittedLetters,
        cursor: typeof pageParam === "string" ? pageParam : undefined,
      }),
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(submittedLetters),
    staleTime: 60_000,
    retry: 1,
  });
  const pages = solveQuery.data?.pages ?? [];
  const lastPage = pages[pages.length - 1];
  const results = lastPage ? { ...lastPage, items: pages.flatMap((page) => page.items) } : undefined;

  function search(input = letters) {
    const normalized = normalizeInput(input);
    if (!normalized) return;
    setLetters(normalized);
    setSubmittedLetters(normalized);
  }

  function updateLetters(value: string) {
    setLetters(normalizeInput(value));
  }

  return (
    <div className="wmx-page">
      <PageSEO
        title="Unscramble Letters"
        description="Enter scrambled letters and find exact dictionary word matches."
        path="/explore/word-scramble"
      />
      <div className="wmx-shell">
        <Link href="/game/word-scramble" className="wmx-back">
          <ArrowLeft size={16} aria-hidden="true" /> Back to Word Scramble
        </Link>
        <header className="wmx-hero">
          <div>
            <div className="wmx-eyebrow">Word tools · Unscramble</div>
            <h1 className="wmx-heading">Make sense of<br /><em>the letters.</em></h1>
            <p className="wmx-intro">
              Enter a scrambled set of letters to find dictionary words that use every letter exactly once.
              This is a standalone word utility, not a Word Scramble game round.
            </p>
          </div>
        </header>

        <div className="wmx-workspace">
          <UnscrambleInputPanel
            letters={letters}
            examples={examplesQuery.data?.items ?? []}
            examplesSource={examplesQuery.data?.source}
            examplesLoading={examplesQuery.isLoading}
            examplesError={examplesQuery.isError}
            submitting={solveQuery.isLoading}
            onLettersChange={updateLetters}
            onSubmit={() => search()}
            onChooseExample={search}
            onRetryExamples={() => examplesQuery.refetch()}
          />
          <main className="wmx-main">
            <UnscrambleResults
              submittedLetters={submittedLetters}
              isLoading={solveQuery.isLoading}
              error={solveQuery.isError}
              result={results}
              loadingMore={solveQuery.isFetchingNextPage}
              onRetry={() => solveQuery.refetch()}
              onLoadMore={() => solveQuery.fetchNextPage()}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
