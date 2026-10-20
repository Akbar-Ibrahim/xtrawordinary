export type LetterBalanceExploreCategory =
  | "vowel_count"
  | "consonant_count"
  | "start_end_vowel"
  | "start_end_consonant"
  | "start_vowel_end_consonant"
  | "start_consonant_end_vowel"
  | "locked_balance";

export interface LetterBalanceExploreFilters {
  category: LetterBalanceExploreCategory;
  count?: number;
  length?: number;
  consonantCount?: number;
}

export interface LetterBalanceExplorePage {
  items: Array<{ word: string }>;
  page: { limit: number; hasMore: boolean; nextCursor: string | null };
  source: "preview" | "database";
}

export interface LetterBalanceExploreCheck {
  word: string;
  dictionaryMatch: boolean;
  constraintMatch: boolean;
  source: "preview" | "database";
}
