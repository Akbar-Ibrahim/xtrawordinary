import { InvalidExploreCursorError, type ExplorePage } from "./shared-types";
import type { LetterHuntExploreSource, LetterExploreWord } from "./letter-constraint-types";
import { paginateSortedArray } from "./pagination";
import { LETTER_CONSTRAINT_PREVIEW_SOURCE, LETTER_CONSTRAINT_PREVIEW_WORDS } from "./letter-constraint-preview";
import { letterExploreCheck, letterExploreWord, meetsLetterHuntConstraint, normalizeLetters } from "./letter-constraint-utils";

const SOURCE = LETTER_CONSTRAINT_PREVIEW_SOURCE;
const SCOPE = "letter-hunt-results";

function isDictionaryWord(word: string): boolean {
  return LETTER_CONSTRAINT_PREVIEW_WORDS.includes(normalizeLetters(word));
}

export const letterHuntMemorySource: LetterHuntExploreSource = {
  async search(letters, ordered, limit, cursor) {
    const normalizedLetters = normalizeLetters(letters);
    const context = `${normalizedLetters}:${ordered ? "ordered" : "unordered"}`;
    const matchingWords = LETTER_CONSTRAINT_PREVIEW_WORDS.filter((word) =>
      meetsLetterHuntConstraint(word, normalizedLetters, ordered),
    );
    const page = paginateSortedArray(
      matchingWords,
      limit,
      cursor,
      SCOPE,
      context,
      (word) => word,
      SOURCE,
    );
    return {
      ...page,
      items: page.items.map((word) => letterExploreWord(word, true, null)),
    };
  },

  async check(word, letters, ordered) {
    const normalizedWord = normalizeLetters(word);
    const dictionaryMatch = isDictionaryWord(normalizedWord);
    const constraintMatch = meetsLetterHuntConstraint(normalizedWord, letters, ordered);
    return letterExploreCheck(
      normalizedWord,
      dictionaryMatch,
      constraintMatch,
      dictionaryMatch && constraintMatch,
      null,
      SOURCE,
    );
  },
};
