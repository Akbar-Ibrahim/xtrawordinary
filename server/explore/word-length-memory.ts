import {
  createWordLengthExploreCheck,
  createWordLengthExploreItem,
  matchesWordLengthPattern,
  normalizeWordLengthPattern,
  type WordLengthExplorePattern,
} from "@shared/word-length-explore";
import type { ExplorePage } from "./shared-types";
import type { WordLengthExploreSource } from "./word-length-types";
import { paginateSortedArray } from "./pagination";

const SOURCE = "preview" as const;
const SCOPE = "word-length-explore-results";

export const WORD_LENGTH_PREVIEW_WORDS = [
  "A",
  "I",
  "AN",
  "AT",
  "BE",
  "BY",
  "ACE",
  "ACT",
  "ADD",
  "AGE",
  "ATE",
  "BAT",
  "CAT",
  "DOG",
  "EAT",
  "CHANGE",
  "ORANGE",
  "EXAMPLE",
  "HEART",
  "TRAIN",
] as const;

function patternContext(pattern: WordLengthExplorePattern): string {
  return JSON.stringify(normalizeWordLengthPattern(pattern));
}

function toExplorePage(
  words: readonly string[],
  limit: number,
  cursor: string | undefined,
  pattern: WordLengthExplorePattern,
): ExplorePage<ReturnType<typeof createWordLengthExploreItem>> {
  const matchingWords = words
    .filter((word) => matchesWordLengthPattern(word, pattern))
    .sort((left, right) => left.localeCompare(right));
  const page = paginateSortedArray(
    matchingWords,
    limit,
    cursor,
    SCOPE,
    patternContext(pattern),
    (word) => word,
    SOURCE,
  );
  return {
    ...page,
    items: page.items.map(createWordLengthExploreItem),
  };
}

export const wordLengthMemorySource: WordLengthExploreSource = {
  async search(pattern, limit, cursor) {
    return toExplorePage(WORD_LENGTH_PREVIEW_WORDS, limit, cursor, pattern);
  },

  async check(word, pattern) {
    const normalizedWord = word.toUpperCase();
    return createWordLengthExploreCheck(
      normalizedWord,
      WORD_LENGTH_PREVIEW_WORDS.includes(normalizedWord as (typeof WORD_LENGTH_PREVIEW_WORDS)[number]),
      pattern,
      SOURCE,
    );
  },
};
