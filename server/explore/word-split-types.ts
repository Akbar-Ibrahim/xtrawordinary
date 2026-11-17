import type {
  WordSplitExploreFilters,
  WordSplitExploreItem,
  WordSplitExplorePage,
} from "@shared/word-split-explore";

export type {
  WordSplitExploreFilters,
  WordSplitExploreItem,
  WordSplitExplorePage,
} from "@shared/word-split-explore";

export interface WordSplitExploreSource {
  getSplits(
    filters: WordSplitExploreFilters,
    limit: number,
    cursor?: string,
  ): Promise<WordSplitExplorePage>;
}

export class WordSplitTargetNotFoundError extends Error {
  constructor() {
    super("Word Split target was not found");
    this.name = "WordSplitTargetNotFoundError";
  }
}

export class WordSplitSearchTooComplexError extends Error {
  constructor() {
    super("This search has too many combinations. Increase the minimum word length or choose an exact split size.");
    this.name = "WordSplitSearchTooComplexError";
  }
}
