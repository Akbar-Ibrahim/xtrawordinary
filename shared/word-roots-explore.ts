import { EXPLORE_MAX_WORD_LENGTH_FILTER } from "./explore-limits";

export const WORD_ROOTS_EXPLORE_MIN_INPUTS = 2;
export const WORD_ROOTS_EXPLORE_MAX_INPUTS = 8;
export const WORD_ROOTS_EXPLORE_MAX_WORD_LENGTH = 40;
export const WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH = EXPLORE_MAX_WORD_LENGTH_FILTER;
export const WORD_ROOTS_EXPLORE_DEFAULT_PAGE_SIZE = 50;
export const WORD_ROOTS_EXPLORE_MAX_PAGE_SIZE = 100;

export interface WordRootsExploreSearchOptions {
  limit: number;
  cursor?: string;
  length?: number | null;
}

export interface WordRootsExploreItem {
  word: string;
}

export interface WordRootsExplorePage {
  inputs: string[];
  length: number | null;
  items: WordRootsExploreItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  source: "preview" | "database";
}
