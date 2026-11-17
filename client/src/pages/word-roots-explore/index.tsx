import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Sprout } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import {
  WORD_ROOTS_EXPLORE_MAX_INPUTS,
  WORD_ROOTS_EXPLORE_MIN_INPUTS,
} from "@shared/word-roots-explore";
import { RootResults } from "./RootResults";
import { RootSearchForm } from "./RootSearchForm";
import { fetchWordRootsExplorePage, WordRootsExploreRequestError } from "./api";

const INITIAL_WORDS = ["", ""];

function validateWords(values: string[]): { words?: string[]; error?: string } {
  const words = values.map((value) => value.trim().toUpperCase());
  if (words.length < WORD_ROOTS_EXPLORE_MIN_INPUTS || words.length > WORD_ROOTS_EXPLORE_MAX_INPUTS) {
    return { error: `Enter between ${WORD_ROOTS_EXPLORE_MIN_INPUTS} and ${WORD_ROOTS_EXPLORE_MAX_INPUTS} words.` };
  }
  if (words.some((word) => !/^[A-Z]+$/.test(word))) {
    return { error: "Fill every field with a word using letters A–Z only." };
  }
  if (new Set(words).size !== words.length) {
    return { error: "Enter each different word only once." };
  }
  return { words };
}

export default function WordRootsExplore() {
  const [form, setForm] = useState(INITIAL_WORDS);
  const [formLength, setFormLength] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<{ words: string[]; length: number | null } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);

  const query = useInfiniteQuery({
    queryKey: ["/api/explore/word-roots/base-words", submitted, searchVersion],
    queryFn: ({ pageParam }) => fetchWordRootsExplorePage(
      submitted!.words,
      submitted!.length,
      typeof pageParam === "string" ? pageParam : undefined,
    ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: submitted !== null,
    retry: 1,
  });

  function submitSearch() {
    const result = validateWords(form);
    if (result.error) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);
    setSubmitted({ words: result.words!, length: formLength });
    setSearchVersion((version) => version + 1);
  }

  const pages = useMemo(() => query.data?.pages ?? [], [query.data?.pages]);
  const requestError = query.error instanceof WordRootsExploreRequestError
    ? query.error.message
    : query.isError ? "Word Roots matches could not be loaded. Check your connection and try again." : null;

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
        title="Explore Word Roots"
        description="Find dictionary base words linked to every word you enter."
        path="/explore/word-roots"
      />
      <Link
        href="/game/word-roots"
        className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to Word Roots
      </Link>

      <header className="max-w-3xl">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <Sprout size={15} aria-hidden="true" /> Word Roots · Explore
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Which base words connect them?</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Enter two or more words to find base words linked to all of them. A match follows the dictionary’s Word Roots relationships; it does not require the letters to appear as a continuous sequence.
        </p>
      </header>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <RootSearchForm
            values={form}
            length={formLength}
            isSearching={query.isFetching && pages.length === 0}
            onChange={(index, value) => {
              setForm((current) => current.map((word, itemIndex) => itemIndex === index ? value : word));
              setValidationError(null);
            }}
            onLengthChange={setFormLength}
            onSubmit={submitSearch}
            onAdd={() => {
              setForm((current) => current.length < WORD_ROOTS_EXPLORE_MAX_INPUTS
                ? [...current, ""]
                : current);
              setValidationError(null);
            }}
            onRemove={(index) => {
              setForm((current) => current.length > WORD_ROOTS_EXPLORE_MIN_INPUTS
                ? current.filter((_, itemIndex) => itemIndex !== index)
                : current);
              setValidationError(null);
            }}
          />
          {validationError && <p className="px-1 text-sm text-destructive" role="alert">{validationError}</p>}
        </div>

        <RootResults
          pages={pages}
          length={submitted?.length ?? null}
          isLoading={query.isLoading || (query.isFetching && pages.length === 0)}
          hasSearched={submitted !== null}
          error={requestError}
          hasMore={Boolean(query.hasNextPage)}
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
