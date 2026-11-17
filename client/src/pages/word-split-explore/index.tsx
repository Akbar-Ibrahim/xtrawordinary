import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { EXPLORE_MAX_WORD_LENGTH_FILTER } from "@shared/explore-limits";
import type { WordSplitExploreFilters, WordSplitExplorePage } from "@shared/word-split-explore";
import { fetchWordSplitExplorePage, WordSplitExploreRequestError } from "./api";
import { SplitResults } from "./SplitResults";
import { SplitSearchForm, type WordSplitSearchFormValues } from "./SplitSearchForm";

const INITIAL_FORM: WordSplitSearchFormValues = {
  targetWord: "",
  wordCount: "",
  minWordLength: "2",
};

export default function WordSplitExplore() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitted, setSubmitted] = useState<WordSplitExploreFilters | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);

  const query = useInfiniteQuery<WordSplitExplorePage>({
    queryKey: ["/api/explore/word-split/splits", submitted, searchVersion],
    queryFn: ({ pageParam }) => fetchWordSplitExplorePage(
      submitted!,
      typeof pageParam === "string" ? pageParam : undefined,
    ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled: submitted !== null,
    retry: 1,
  });

  function submitSearch() {
    const targetWord = form.targetWord.trim().toUpperCase();
    const wordCount = form.wordCount.trim() ? Number(form.wordCount) : null;
    const minWordLength = Number(form.minWordLength);

    if (!/^[A-Z]+$/.test(targetWord)) {
      setValidationError("Enter a word using letters A–Z only.");
      return;
    }
    if (wordCount !== null && (!Number.isInteger(wordCount) || wordCount < 2 || wordCount > 100)) {
      setValidationError("Words per split must be at least 2, or left blank for all split sizes.");
      return;
    }
    if (!Number.isInteger(minWordLength) || minWordLength < 1 || minWordLength > EXPLORE_MAX_WORD_LENGTH_FILTER) {
      setValidationError(`Minimum word length must be between 1 and ${EXPLORE_MAX_WORD_LENGTH_FILTER}.`);
      return;
    }

    setValidationError(null);
    setSubmitted({ targetWord, wordCount, minWordLength });
    setSearchVersion((version) => version + 1);
  }

  const pages = query.data?.pages ?? [];
  const items = useMemo(() => pages.flatMap((page) => page.items), [pages]);
  const loadedCount = items.length;
  const preview = pages.some((page) => page.source === "preview");
  const requestError = query.error instanceof WordSplitExploreRequestError
    ? query.error.message
    : query.isError ? "The splits could not be loaded. Check your connection and try again." : null;

  function retry() {
    if (query.hasNextPage && query.isFetchNextPageError) {
      void query.fetchNextPage();
    } else {
      void query.refetch();
    }
  }

  return (
    <div className="container mx-auto min-w-0 max-w-7xl px-4 py-8 sm:py-10">
      <PageSEO
        title="Explore Word Split"
        description="Find dictionary word combinations that use every letter of a word exactly once."
        path="/explore/word-split"
      />
      <Link
        href="/game/word-split"
        className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to Word Split
      </Link>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Word Split · Explore</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Find every way to split a word.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Enter a dictionary word to find linked words that combine to use every letter exactly once. Filter by the number of words in a split and their minimum length.
        </p>
      </header>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <SplitSearchForm
            values={form}
            isSearching={query.isFetching}
            onChange={(nextValues) => {
              setForm(nextValues);
              setValidationError(null);
            }}
            onSubmit={submitSearch}
          />
          {validationError && <p className="text-sm text-destructive" role="alert">{validationError}</p>}
          {submitted && query.data && (
            <p className="px-1 text-xs text-muted-foreground">
              Showing results for <strong className="text-foreground">{submitted.targetWord}</strong>.
              Edits above won’t change these results until you search again.
            </p>
          )}
        </div>

        <SplitResults
          items={items}
          loadedCount={loadedCount}
          isLoading={query.isLoading || (query.isFetching && pages.length === 0)}
          hasSearched={submitted !== null}
          error={requestError}
          preview={preview}
          hasMore={query.hasNextPage}
          isLoadingMore={query.isFetchingNextPage}
          onRetry={retry}
          onLoadMore={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
        />
      </div>
    </div>
  );
}
