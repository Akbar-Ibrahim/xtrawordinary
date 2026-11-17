import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/page-seo";
import { browseShellWordExplore, checkShellWordExplore } from "./api";
import { ShellWordsControls } from "./components/ShellWordsControls";
import { ExploreBrowseResults } from "./components/ExploreBrowseResults";
import { ExploreWordCheck } from "./components/ExploreWordCheck";
import type { ExploreBrowseInput, ShellWordExplorePage } from "./types";

const INITIAL_FILTERS: ExploreBrowseInput = { direction: "shell" };

export default function ShellWordsExplore() {
  const [filters, setFilters] = useState<ExploreBrowseInput>(INITIAL_FILTERS);
  const [submitted, setSubmitted] = useState<ExploreBrowseInput>(INITIAL_FILTERS);
  const [searchVersion, setSearchVersion] = useState(0);
  const query = useInfiniteQuery<ShellWordExplorePage>({
    queryKey: ["/api/explore/shell-words/words", submitted, searchVersion],
    queryFn: ({ pageParam }) => browseShellWordExplore({ ...submitted, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.page.hasMore ? page.page.nextCursor : undefined,
  });
  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items).slice().sort((a, b) => a.shellWord.localeCompare(b.shellWord));

  function search(next: ExploreBrowseInput) {
    const normalized = { ...next, word: next.word?.trim().toUpperCase() || undefined, first: next.first?.toUpperCase(), last: next.last?.toUpperCase() };
    setSubmitted(normalized);
    setSearchVersion((version) => version + 1);
  }

  return <main className="min-h-[70dvh] bg-[#f2eee5] px-4 py-8 sm:py-10">
    <div className="mx-auto max-w-7xl">
      <PageSEO title="Explore Shell Words" description="Browse outer-to-inner Shell Words relationships in the dictionary." path="/explore/shell-words" />
      <Link href="/explore" className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-[#68716a] transition-colors hover:text-[#aa6048]"><ArrowLeft size={16} aria-hidden="true" /> All Explore tools</Link>
      <header className="relative mb-8 overflow-hidden rounded-2xl bg-[#263b39] px-6 py-8 text-[#fffaf2] sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border border-[#ffffff17]" />
        <div className="pointer-events-none absolute -right-1 top-5 h-44 w-44 rounded-full border border-[#ffffff20]" />
        <p className="relative font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#e0a589]">xtraWordinary · relationship reference</p>
        <h1 className="relative mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">Shell Words<span className="text-[#e0a589]">.</span></h1>
        <p className="relative mt-3 max-w-2xl text-sm leading-relaxed text-[#d9e0d9] sm:text-base">Explore the outer-to-inner word pairs behind Shell Words. A focused dictionary index, not a game round.</p>
        <div className="relative mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#e0a589]"><span className="h-px w-8 bg-[#e0a589]" /> One word nested inside another</div>
      </header>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(280px,350px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <ShellWordsControls filters={filters} isSearching={query.isFetching && !query.isFetchingNextPage} onChange={setFilters} onSearch={search} />
          <ExploreWordCheck key={filters.direction} direction={filters.direction} relationshipName="Shell Words" checkWord={checkShellWordExplore} />
        </div>
        <ExploreBrowseResults title="Shell word relationships" relationshipName="Shell Words" items={items} result={pages[pages.length - 1]} isLoading={query.isLoading} isLoadingMore={query.isFetchingNextPage} hasError={query.isError} onRetry={() => { void query.refetch(); }} onLoadMore={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }} />
      </div>
      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-[#85877e]">Reference only · dictionary relationships do not alter gameplay validation</p>
    </div>
  </main>;
}
