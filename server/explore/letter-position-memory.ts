import type { LetterPositionExploreSource, LetterExploreWord } from "./letter-constraint-types";
import { LETTER_CONSTRAINT_PREVIEW_SOURCE, LETTER_CONSTRAINT_PREVIEW_WORDS } from "./letter-constraint-preview";
import { letterExploreCheck, letterExploreWord, meetsLetterPositionConstraint, normalizeLetters } from "./letter-constraint-utils";
import { paginateSortedArray } from "./pagination";

const SCOPE = "letter-position-results";

function isPreviewWord(word: string): boolean {
  return LETTER_CONSTRAINT_PREVIEW_WORDS.includes(normalizeLetters(word));
}

export const letterPositionMemorySource: LetterPositionExploreSource = {
  async search(letter, position, limit, cursor) {
    const normalizedLetter = normalizeLetters(letter);
    const context = `${normalizedLetter}:${position}`;
    const matchingWords = LETTER_CONSTRAINT_PREVIEW_WORDS.filter((word) =>
      meetsLetterPositionConstraint(word, normalizedLetter, position),
    );
    const page = paginateSortedArray(
      matchingWords,
      limit,
      cursor,
      SCOPE,
      context,
      (word) => word,
      LETTER_CONSTRAINT_PREVIEW_SOURCE,
    );
    return {
      ...page,
      items: page.items.map((word) => letterExploreWord(word, true, null)),
    };
  },

  async check(word, letter, position) {
    const normalizedWord = normalizeLetters(word);
    const normalizedLetter = normalizeLetters(letter);
    const dictionaryMatch = isPreviewWord(normalizedWord);
    const constraintMatch = meetsLetterPositionConstraint(normalizedWord, normalizedLetter, position);
    return letterExploreCheck(
      normalizedWord,
      dictionaryMatch,
      constraintMatch,
      dictionaryMatch && constraintMatch,
      null,
      LETTER_CONSTRAINT_PREVIEW_SOURCE,
    );
  },
};
