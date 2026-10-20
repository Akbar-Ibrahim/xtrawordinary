export const LETTER_BALANCE_EXPLORE_CATEGORIES = [
  "vowel_count",
  "consonant_count",
  "start_end_vowel",
  "start_end_consonant",
  "start_vowel_end_consonant",
  "start_consonant_end_vowel",
  "locked_balance",
] as const;

export type LetterBalanceExploreCategory = typeof LETTER_BALANCE_EXPLORE_CATEGORIES[number];

export interface LetterBalanceExploreFilters {
  category: LetterBalanceExploreCategory;
  count?: number;
  length?: number;
  consonantCount?: number;
}

export interface LetterBalanceExplorePage {
  items: Array<{ word: string }>;
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  source: "preview" | "database";
}

export interface LetterBalanceExploreCheck {
  word: string;
  dictionaryMatch: boolean;
  constraintMatch: boolean;
  source: "preview" | "database";
}

export interface LetterBalanceExploreSource {
  search(
    filters: LetterBalanceExploreFilters,
    limit: number,
    cursor?: string,
  ): Promise<LetterBalanceExplorePage>;
  check(
    word: string,
    filters: LetterBalanceExploreFilters,
  ): Promise<LetterBalanceExploreCheck>;
}
