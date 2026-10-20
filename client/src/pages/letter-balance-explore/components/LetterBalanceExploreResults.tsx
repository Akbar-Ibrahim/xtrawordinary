import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LetterBalanceExplorePage } from "../types";

interface Props {
  hasSearched: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: boolean;
  errorMessage?: string;
  result?: LetterBalanceExplorePage;
  words: string[];
  onRetry: () => void;
  onLoadMore: () => void;
}

export function LetterBalanceExploreResults({
  hasSearched,
  isLoading,
  isLoadingMore,
  error,
  errorMessage,
  result,
  words,
  onRetry,
  onLoadMore,
}: Props) {
  const sourceLabel = result?.source === "database" ? "Dictionary database" : "Preview sample";

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg">Matching words</CardTitle>
        {result && (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {sourceLabel}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {!hasSearched ? (
          <p className="text-sm text-muted-foreground">Choose a pattern, then browse its dictionary matches.</p>
        ) : isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">Searching the dictionary…</p>
        ) : error && words.length === 0 ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">{errorMessage ?? "Could not load matching words."}</p>
            <Button variant="outline" onClick={onRetry}>Retry search</Button>
          </div>
        ) : words.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dictionary words match these filters.</p>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 p-3">
                <p role="alert" className="text-sm text-destructive">
                  Could not load the next words. {errorMessage}
                </p>
                <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground">Showing {words.length} words, alphabetically.</p>
            <ul aria-label="Matching words" className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {words.map((word) => (
                <li key={word} className="min-w-0 rounded-md border bg-card px-3 py-2 text-center font-mono font-semibold tracking-wide">
                  <span className="block truncate">{word}</span>
                </li>
              ))}
            </ul>
            {result?.page.hasMore && (
              <Button
                variant="outline"
                className="w-full"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
