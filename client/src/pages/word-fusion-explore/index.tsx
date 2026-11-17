import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, WholeWord } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import {
  WORD_FUSION_EXPLORE_MAX_COMPONENTS,
  WORD_FUSION_EXPLORE_MIN_COMPONENTS,
  WORD_FUSION_EXPLORE_MIN_WORD_LENGTH,
} from "@shared/word-fusion-explore";
import { FusionResults } from "./FusionResults";
import { FusionSearchForm } from "./FusionSearchForm";
import { fetchWordFusionExplorePage, WordFusionExploreRequestError } from "./api";

const INITIAL_COMPONENTS = ["", ""];

function validateComponents(values: string[]): { components?: string[]; error?: string } {
  const components = values.map((value) => value.trim().toUpperCase());
  if (
    components.length < WORD_FUSION_EXPLORE_MIN_COMPONENTS
    || components.length > WORD_FUSION_EXPLORE_MAX_COMPONENTS
  ) {
    return { error: `Choose between ${WORD_FUSION_EXPLORE_MIN_COMPONENTS} and ${WORD_FUSION_EXPLORE_MAX_COMPONENTS} words.` };
  }
  if (components.some((component) =>
    component.length < WORD_FUSION_EXPLORE_MIN_WORD_LENGTH || !/^[A-Z]+$/.test(component)
  )) {
    return { error: "Each component must be a dictionary word with at least two letters (A–Z)." };
  }
  return { components };
}

export default function WordFusionExplore() {
  const [form, setForm] = useState(INITIAL_COMPONENTS);
  const [submitted, setSubmitted] = useState<string[] | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);

  const query = useInfiniteQuery({
    queryKey: ["/api/explore/word-fusion/matches", submitted, searchVersion],
    queryFn: ({ pageParam }) => fetchWordFusionExplorePage(
      submitted!,
      typeof pageParam === "string" ? pageParam : undefined,
    ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: submitted !== null,
    retry: 1,
  });

  function submitSearch() {
    const result = validateComponents(form);
    if (result.error) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);
    setSubmitted(result.components!);
    setSearchVersion((version) => version + 1);
  }

  const pages = useMemo(() => query.data?.pages ?? [], [query.data?.pages]);
  const requestError = query.error instanceof WordFusionExploreRequestError
    ? query.error.message
    : query.isError ? "Word Fusion matches could not be loaded. Check your connection and try again." : null;

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
        title="Explore Word Fusion"
        description="Explore dictionary words formed from a pool of component words, using every pooled letter exactly once."
        path="/explore/word-fusion"
      />
      <Link
        href="/game/word-fusion"
        className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to Word Fusion
      </Link>

      <header className="max-w-3xl">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <WholeWord size={15} aria-hidden="true" /> Word Fusion · Explore
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">What can your letters become?</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Pool the letters from two or more dictionary words and discover words built from the whole set. This is a freeform word lab—no timer, just the joy of finding a fit.
        </p>
      </header>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <FusionSearchForm
            values={form}
            isSearching={query.isFetching && pages.length === 0}
            onChange={(index, value) => {
              setForm((current) => current.map((component, itemIndex) => itemIndex === index ? value : component));
              setValidationError(null);
            }}
            onSubmit={submitSearch}
            onAdd={() => {
              setForm((current) => current.length < WORD_FUSION_EXPLORE_MAX_COMPONENTS
                ? [...current, ""]
                : current);
              setValidationError(null);
            }}
            onRemove={(index) => {
              setForm((current) => current.length > WORD_FUSION_EXPLORE_MIN_COMPONENTS
                ? current.filter((_, itemIndex) => itemIndex !== index)
                : current);
              setValidationError(null);
            }}
          />
          {validationError && <p className="px-1 text-sm text-destructive" role="alert">{validationError}</p>}
        </div>

        <FusionResults
          pages={pages}
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
