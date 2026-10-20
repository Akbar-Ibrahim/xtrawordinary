export type GameSlug = "anagram-solver";

export interface BaseWord {
  baseWord: string;
}

export interface BaseWordsResponse {
  items: BaseWord[];
  page: { limit: number; nextCursor: string | null; hasMore: boolean };
  source: "preview" | "database";
}

export interface WordsResponse {
  baseWord: string;
  items: { word: string }[];
  page: { limit: number; nextCursor: string | null; hasMore: boolean };
  source: "preview" | "database";
}

export interface CheckResponse {
  valid: boolean;
  source: "preview" | "database";
}
