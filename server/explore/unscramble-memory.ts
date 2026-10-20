import { anagramWordSets } from "../game-data";
import { countLetters, normalizeScrambledLetters, shuffleLetters } from "./unscramble-utils";
import type { UnscrambleSource } from "./unscramble-types";
import { decodeExploreCursor, encodeExploreCursor } from "./pagination";

const PREVIEW_SOURCE = "preview" as const;
const PREVIEW_RESULT_LIMIT = 100;
const PREVIEW_WORDS = [...new Set(anagramWordSets.flatMap(({ original, anagrams }) => [
  original,
  ...anagrams,
].map(normalizeScrambledLetters)))].sort((left, right) => left.localeCompare(right, "en"));

function sameLetterCounts(left: string, right: string): boolean {
  const leftCounts = countLetters(left);
  const rightCounts = countLetters(right);
  return leftCounts.size === rightCounts.size
    && [...leftCounts].every(([letter, count]) => rightCounts.get(letter) === count);
}

export const unscrambleMemorySource: UnscrambleSource = {
  async getExamples(limit) {
    const candidates = [...PREVIEW_WORDS].filter((word) => word.length >= 3 && new Set(word).size > 1);
    for (let index = candidates.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }
    const examples: string[] = [];
    const seen = new Set<string>();
    for (const word of candidates) {
      const scramble = shuffleLetters(word);
      if (scramble === word || seen.has(scramble)) continue;
      examples.push(scramble);
      seen.add(scramble);
      if (examples.length >= limit) break;
    }
    return { items: examples, source: PREVIEW_SOURCE };
  },

  async solve(letters, limit, cursor) {
    const input = normalizeScrambledLetters(letters);
    const after = decodeExploreCursor(cursor, "unscramble-results", input);
    const matches = PREVIEW_WORDS.filter((word) =>
      sameLetterCounts(input, word) && (!after || word.localeCompare(after, "en") > 0),
    );
    const cappedLimit = Math.min(limit, PREVIEW_RESULT_LIMIT);
    const items = matches.slice(0, cappedLimit);
    const hasMore = matches.length > cappedLimit;
    return {
      input,
      items,
      hasMore,
      nextCursor: hasMore && items.length
        ? encodeExploreCursor("unscramble-results", input, items[items.length - 1])
        : null,
      source: PREVIEW_SOURCE,
    };
  },
};
