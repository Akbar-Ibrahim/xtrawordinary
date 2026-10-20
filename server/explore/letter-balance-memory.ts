import { decodeExploreCursor, encodeExploreCursor } from "./pagination";
import { LETTER_BALANCE_PREVIEW_WORDS } from "./letter-balance-preview";
import {
  getLetterBalanceWordStats,
  matchesLetterBalanceFilters,
  normalizeLetterBalanceWord,
} from "./letter-balance-utils";
import type { LetterBalanceExploreSource } from "./letter-balance-types";

const SCOPE = "letter-balance-results";
const PREVIEW_WORD_SET = new Set(LETTER_BALANCE_PREVIEW_WORDS.map(normalizeLetterBalanceWord));

export const letterBalanceMemorySource: LetterBalanceExploreSource = {
  async search(filters, limit, cursor) {
    const context = JSON.stringify(filters);
    const after = decodeExploreCursor(cursor, SCOPE, context);
    const cappedLimit = Math.max(1, Math.min(limit, 100));
    const matchingWords = LETTER_BALANCE_PREVIEW_WORDS
      .filter((word) => matchesLetterBalanceFilters(word, filters))
      .map(normalizeLetterBalanceWord)
      .filter((word) => after === undefined || word.toLowerCase() > after.toLowerCase())
      .sort((first, second) => first.localeCompare(second));
    const hasMore = matchingWords.length > cappedLimit;
    const items = (hasMore ? matchingWords.slice(0, cappedLimit) : matchingWords)
      .map((word) => ({ word }));

    return {
      items,
      page: {
        limit: cappedLimit,
        hasMore,
        nextCursor: hasMore && items.length
          ? encodeExploreCursor(SCOPE, context, items[items.length - 1].word.toLowerCase())
          : null,
      },
      source: "preview",
    };
  },

  async check(word, filters) {
    const normalizedWord = normalizeLetterBalanceWord(word);
    const dictionaryMatch = PREVIEW_WORD_SET.has(normalizedWord);
    return {
      word: normalizedWord,
      dictionaryMatch,
      constraintMatch: dictionaryMatch
        && matchesLetterBalanceFilters(normalizedWord, filters, getLetterBalanceWordStats(normalizedWord)),
      source: "preview",
    };
  },
};
