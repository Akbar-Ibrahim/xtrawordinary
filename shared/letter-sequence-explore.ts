import { EXPLORE_MAX_WORD_LENGTH_FILTER } from "./explore-limits";

export const LETTER_SEQUENCE_TYPES = ["prefix", "suffix", "contains"] as const;
export type LetterSequenceType = (typeof LETTER_SEQUENCE_TYPES)[number];

export const LETTER_SEQUENCE_MAX_LENGTH = 32;
export const LETTER_SEQUENCE_EXPLORE_MAX_WORD_LENGTH = EXPLORE_MAX_WORD_LENGTH_FILTER;

export interface LetterSequenceExplorePage {
  sequence: string;
  type: LetterSequenceType;
  length: number | null;
  items: Array<{ word: string }>;
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  source: "preview" | "database";
}
