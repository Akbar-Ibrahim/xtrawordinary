import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, AlignLeft, AlignRight, BetweenHorizontalStart } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { fetchLetterSequenceExplorePage, LetterSequenceExploreRequestError } from "@/lib/letter-sequence-explore-api";
import type { LetterSequenceExplorePage as SequencePageData, LetterSequenceType } from "@shared/letter-sequence-explore";
import { SequenceResults } from "./SequenceResults";
import { sanitizeSequence, SequenceSearchForm } from "./SequenceSearchForm";

type SequenceToolConfig = {
  type: LetterSequenceType;
  title: string;
  seoTitle: string;
  seoDescription: string;
  path: string;
  heading: string;
  intro: string;
  detail: string;
  icon: "prefix" | "suffix" | "contains";
};

const toolIcons = {
  prefix: AlignLeft,
  suffix: AlignRight,
  contains: BetweenHorizontalStart,
};

export function SequenceExplorePage({ config }: { config: SequenceToolConfig }) {
  const [input, setInput] = useState("");
  const [length, setLength] = useState<number | null>(null);
  const [submittedSearch, setSubmittedSearch] = useState<{ sequence: string; length: number | null } | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const submittedSequence = submittedSearch?.sequence ?? null;
  const query = useInfiniteQuery<SequencePageData>({
    queryKey: ["/api/explore/letter-sequences", config.type, submittedSearch, searchVersion],
    queryFn: ({ pageParam }) => fetchLetterSequenceExplorePage(
      config.type,
      submittedSearch!.sequence,
      typeof pageParam === "string" ? pageParam : undefined,
      submittedSearch!.length,
    ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.hasMore ? lastPage.page.nextCursor ?? undefined : undefined,
    enabled: submittedSearch !== null,
    retry: 1,
  });

  const pages = useMemo(() => query.data?.pages ?? [], [query.data?.pages]);
  const requestError = query.error instanceof LetterSequenceExploreRequestError
    ? query.error.message
    : query.isError ? "Matching words could not be loaded. Check your connection and try again." : null;
  const Icon = toolIcons[config.icon];

  function submitSearch() {
    const normalized = sanitizeSequence(input);
    if (!normalized) return;
    setInput(normalized);
    setSubmittedSearch({ sequence: normalized, length });
    setSearchVersion((version) => version + 1);
  }

  function retry() {
    if (query.hasNextPage && query.isFetchNextPageError) {
      void query.fetchNextPage();
    } else {
      void query.refetch();
    }
  }

  return (
    <div className="relative isolate min-h-[70dvh] overflow-hidden bg-[#f8f5ed] text-[#282c28] dark:bg-[#171916] dark:text-[#f1eee5]">
      <PageSEO title={config.seoTitle} description={config.seoDescription} path={config.path} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(ellipse_at_78%_8%,rgba(242,184,75,0.18),transparent_45%),linear-gradient(180deg,#f2eee3_0%,rgba(248,245,237,0)_100%)] dark:opacity-25" />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10 lg:px-8">
        <Link href="/explore" className="inline-flex items-center gap-2 text-sm font-medium text-[#78684e] transition-colors hover:text-[#4d402e] dark:text-[#d6c39a] dark:hover:text-[#f1dfb7]">
          <ArrowLeft size={16} aria-hidden="true" /> Back to Explore
        </Link>

        <header className="mt-8 max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#70552f] dark:text-[#d6c39a]">
            <Icon size={15} aria-hidden="true" /> {config.title} · Dictionary tool
          </p>
          <h1 className="mt-3 font-serif text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.045em] text-[#242923] dark:text-[#f3efe4] sm:text-5xl">
            {config.heading}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#686b61] dark:text-[#b0b3aa] sm:text-lg">
            {config.intro}
          </p>
        </header>

        <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(270px,350px)_minmax(0,1fr)]">
          <aside className="space-y-3">
            <SequenceSearchForm
              value={input}
              length={length}
              isSearching={query.isFetching && pages.length === 0}
              onChange={setInput}
              onLengthChange={setLength}
              onSubmit={submitSearch}
            />
            {submittedSequence && (
              <p className="px-1 text-xs leading-5 text-muted-foreground">
                Showing results for <span className="font-mono font-semibold tracking-wider text-foreground">{submittedSequence}</span>
                {submittedSearch?.length ? ` (${submittedSearch.length} letters)` : " (any length)"}.
                Editing the fields won’t change this list until you search again.
              </p>
            )}
            <div className="rounded-2xl border border-[#e5dece] bg-[#f3efe5] p-5 dark:border-[#42443c] dark:bg-[#20221e]">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#70552f] dark:text-[#d6c39a]">How it works</p>
              <p className="mt-2 text-sm leading-6 text-[#686b61] dark:text-[#b0b3aa]">{config.detail}</p>
            </div>
          </aside>

          <SequenceResults
            type={config.type}
            sequence={submittedSequence}
            length={submittedSearch?.length ?? null}
            pages={pages}
            hasSearched={submittedSequence !== null}
            isLoading={query.isLoading || (query.isFetching && pages.length === 0)}
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
    </div>
  );
}
