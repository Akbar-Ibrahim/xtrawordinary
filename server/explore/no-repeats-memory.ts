import { paginateSortedArray } from "./pagination";
import { NO_REPEATS_PREVIEW_SOURCE, NO_REPEATS_PREVIEW_WORDS } from "./no-repeats-preview";
import {
  isAlphabeticWord,
  matchesNoRepeatsFilters,
  normalizeRequiredLetters,
} from "./no-repeats-utils";
import type { NoRepeatsExploreSource } from "./no-repeats-types";

const SCOPE = "no-repeats-results";

export const noRepeatsMemorySource: NoRepeatsExploreSource = {
  async search(filters, limit, cursor) {
    const normalizedFilters = {
      ...filters,
      requiredLetters: normalizeRequiredLetters(filters.requiredLetters),
    };
    const context = JSON.stringify(normalizedFilters);
    const matchingWords = NO_REPEATS_PREVIEW_WORDS.filter((word) =>
      matchesNoRepeatsFilters(word, normalizedFilters),
    );
    const page = paginateSortedArray(
      matchingWords,
      limit,
      cursor,
      SCOPE,
      context,
      (word) => word,
      NO_REPEATS_PREVIEW_SOURCE,
    );
    return { ...page, items: page.items.map((word) => ({ word })) };
  },

  async check(word, filters) {
    const normalizedWord = word.toUpperCase();
    const normalizedFilters = {
      ...filters,
      requiredLetters: normalizeRequiredLetters(filters.requiredLetters),
    };
    const dictionaryMatch =
      isAlphabeticWord(normalizedWord) && NO_REPEATS_PREVIEW_WORDS.includes(normalizedWord);
    return {
      word: normalizedWord,
      dictionaryMatch,
      constraintMatch: matchesNoRepeatsFilters(normalizedWord, normalizedFilters),
      source: NO_REPEATS_PREVIEW_SOURCE,
    };
  },
};
