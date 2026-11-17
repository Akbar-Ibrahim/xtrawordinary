import {
  WORD_FUSION_EXPLORE_MAX_COMPONENTS,
  WORD_FUSION_EXPLORE_MIN_COMPONENTS,
  WORD_FUSION_EXPLORE_MIN_WORD_LENGTH,
  type WordFusionExplorePage,
} from "@shared/word-fusion-explore";
import { decodeExploreCursor, encodeExploreCursor } from "./pagination";

const CURSOR_SCOPE = "word-fusion-explore-results";
const MAX_PAGE_SIZE = 100;

export function normalizeWordFusionComponents(components: readonly string[]): string[] {
  return components.map((component) => component.trim().toUpperCase());
}

export function countWordFusionLetters(components: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const component of components) {
    for (const letter of component) {
      counts.set(letter, (counts.get(letter) ?? 0) + 1);
    }
  }
  return counts;
}

function hasExactLetterCounts(word: string, expected: Map<string, number>): boolean {
  if (word.length !== [...expected.values()].reduce((sum, count) => sum + count, 0)) return false;
  const actual = countWordFusionLetters([word]);
  return actual.size === expected.size
    && [...expected].every(([letter, count]) => actual.get(letter) === count);
}

function cursorContext(components: readonly string[]): string {
  return JSON.stringify([...components].sort((left, right) => left.localeCompare(right, "en")));
}

export function createWordFusionExplorePage(
  componentInput: readonly string[],
  candidateWords: readonly string[],
  limit: number,
  cursor: string | undefined,
  source: WordFusionExplorePage["source"],
): WordFusionExplorePage {
  const components = normalizeWordFusionComponents(componentInput);
  if (
    components.length < WORD_FUSION_EXPLORE_MIN_COMPONENTS
    || components.length > WORD_FUSION_EXPLORE_MAX_COMPONENTS
    || components.some((word) => !new RegExp(`^[A-Z]{${WORD_FUSION_EXPLORE_MIN_WORD_LENGTH},}$`).test(word))
  ) {
    throw new RangeError("Enter 2–8 component words, each at least two letters long.");
  }

  const expected = countWordFusionLetters(components);
  const context = cursorContext(components);
  const after = decodeExploreCursor(cursor, CURSOR_SCOPE, context);
  const matches = [...new Set(candidateWords.map((word) => word.trim().toUpperCase()))]
    .filter((word) => /^[A-Z]+$/.test(word) && hasExactLetterCounts(word, expected))
    .sort((left, right) => left.localeCompare(right, "en"))
    .filter((word) => !after || word > after);
  const cappedLimit = Math.max(1, Math.min(Math.floor(limit), MAX_PAGE_SIZE));
  const pageWords = matches.slice(0, cappedLimit + 1);
  const hasMore = pageWords.length > cappedLimit;
  const items = (hasMore ? pageWords.slice(0, cappedLimit) : pageWords)
    .map((word) => ({ word }));
  const lastWord = items.at(-1)?.word;

  return {
    components,
    items,
    page: {
      limit: cappedLimit,
      hasMore,
      nextCursor: hasMore && lastWord
        ? encodeExploreCursor(CURSOR_SCOPE, context, lastWord)
        : null,
    },
    source,
  };
}
