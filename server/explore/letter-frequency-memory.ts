import { paginateSortedArray } from "./pagination";
import {
  LETTER_FREQUENCY_PREVIEW_SOURCE,
  LETTER_FREQUENCY_PREVIEW_WORDS,
} from "./letter-frequency-preview";
import {
  isAlphabeticWord,
  matchesFrequencyConstraints,
  normalizeFrequencyConstraints,
} from "./letter-frequency-utils";
import type {
  LetterFrequencyExploreSource,
  LetterFrequencyMatch,
} from "./letter-frequency-types";

const SCOPE = "letter-frequency-results";

export const letterFrequencyMemorySource: LetterFrequencyExploreSource = {
  async search(constraints, match, limit, cursor) {
    const normalized = normalizeFrequencyConstraints(constraints);
    const context = JSON.stringify({ constraints: normalized, match });
    const matchingWords = LETTER_FREQUENCY_PREVIEW_WORDS.filter((word) =>
      matchesFrequencyConstraints(word, normalized, match),
    );
    const page = paginateSortedArray(
      matchingWords,
      limit,
      cursor,
      SCOPE,
      context,
      (word) => word,
      LETTER_FREQUENCY_PREVIEW_SOURCE,
    );
    return { ...page, items: page.items.map((word) => ({ word })) };
  },

  async check(word, constraints, match) {
    const normalizedWord = word.toUpperCase();
    const normalizedConstraints = normalizeFrequencyConstraints(constraints);
    const dictionaryMatch =
      isAlphabeticWord(normalizedWord) && LETTER_FREQUENCY_PREVIEW_WORDS.includes(normalizedWord);
    return {
      word: normalizedWord,
      dictionaryMatch,
      constraintMatch: matchesFrequencyConstraints(normalizedWord, normalizedConstraints, match),
      source: LETTER_FREQUENCY_PREVIEW_SOURCE,
    };
  },
};
