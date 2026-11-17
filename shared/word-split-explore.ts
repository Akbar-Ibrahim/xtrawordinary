export type WordSplitExploreDataSource = "preview" | "database";

export interface WordSplitExplorePageInfo {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface WordSplitExploreFilters {
  targetWord: string;
  wordCount: number | null;
  minWordLength: number;
}

export interface WordSplitExploreItem {
  words: string[];
}

export interface WordSplitExplorePage {
  targetWord: string;
  wordCount: number | null;
  minWordLength: number;
  items: WordSplitExploreItem[];
  page: WordSplitExplorePageInfo;
  source: WordSplitExploreDataSource;
}
