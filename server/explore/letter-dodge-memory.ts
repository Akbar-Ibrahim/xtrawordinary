import type { LetterDodgeExploreSource } from "./letter-constraint-types";
import { paginateSortedArray } from "./pagination";
import { DODGE_MINIMUM_WORD_LENGTH, DODGE_SHORT_WORD_EXCLUSION, LETTER_CONSTRAINT_PREVIEW_SOURCE, LETTER_CONSTRAINT_PREVIEW_WORDS } from "./letter-constraint-preview";
import { letterExploreCheck, letterExploreWord, meetsLetterDodgeConstraint, normalizeLetters } from "./letter-constraint-utils";

const SOURCE = LETTER_CONSTRAINT_PREVIEW_SOURCE;
const SCOPE = "letter-dodge-results";

function isDictionaryWord(word: string): boolean {
  return LETTER_CONSTRAINT_PREVIEW_WORDS.includes(normalizeLetters(word));
}

function toExploreWord(word: string) {
  const playableInGame = word.length >= DODGE_MINIMUM_WORD_LENGTH;
  return letterExploreWord(
    word,
    playableInGame,
    playableInGame ? null : DODGE_SHORT_WORD_EXCLUSION,
  );
}

export const letterDodgeMemorySource: LetterDodgeExploreSource = {
  async search(forbiddenLetters, limit, cursor) {
    const normalizedForbidden = [...new Set(normalizeLetters(forbiddenLetters))].sort().join("");
    const matchingWords = LETTER_CONSTRAINT_PREVIEW_WORDS.filter((word) =>
      meetsLetterDodgeConstraint(word, normalizedForbidden),
    );
    const page = paginateSortedArray(
      matchingWords,
      limit,
      cursor,
      SCOPE,
      normalizedForbidden,
      (word) => word,
      SOURCE,
    );
    return { ...page, items: page.items.map(toExploreWord) };
  },

  async check(word, forbiddenLetters) {
    const normalizedWord = normalizeLetters(word);
    const dictionaryMatch = isDictionaryWord(normalizedWord);
    const constraintMatch = meetsLetterDodgeConstraint(normalizedWord, forbiddenLetters);
    const playableInGame = dictionaryMatch && constraintMatch && normalizedWord.length >= DODGE_MINIMUM_WORD_LENGTH;
    return letterExploreCheck(
      normalizedWord,
      dictionaryMatch,
      constraintMatch,
      playableInGame,
      dictionaryMatch && constraintMatch && !playableInGame ? DODGE_SHORT_WORD_EXCLUSION : null,
      SOURCE,
    );
  },
};
