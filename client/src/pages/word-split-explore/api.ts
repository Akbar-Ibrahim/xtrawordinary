import type {
  WordSplitExploreFilters,
  WordSplitExplorePage,
} from "@shared/word-split-explore";

export class WordSplitExploreRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "WordSplitExploreRequestError";
  }
}

export async function fetchWordSplitExplorePage(
  filters: WordSplitExploreFilters,
  cursor?: string,
): Promise<WordSplitExplorePage> {
  const params = new URLSearchParams({
    targetWord: filters.targetWord,
    minWordLength: String(filters.minWordLength),
    limit: "50",
  });
  if (filters.wordCount !== null) params.set("wordCount", String(filters.wordCount));
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/explore/word-split/splits?${params.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new WordSplitExploreRequestError(
      typeof body.message === "string" ? body.message : "Could not load Word Split results.",
      response.status,
    );
  }
  return body as WordSplitExplorePage;
}
