import { makerWords, wordDictionary } from "../game-data";
import { canFormFromLetters, getGameplayExclusion, isAlphabeticWord, normalizeExploreWord } from "./letter-matching";
import { paginateSortedArray } from "./pagination";
import type { WordMakerExploreSource, WordMakerExploreWord } from "./word-maker-types";
import { WordMakerBaseWordNotFoundError } from "./word-maker-types";

const PREVIEW_RESULT_LIMIT = 12;
const PREVIEW_SOURCE = "preview" as const;
const baseWordMap = new Map(makerWords.map((entry) => [normalizeExploreWord(entry.baseWord), entry]));
const staticDictionary = [...new Set(wordDictionary.map(normalizeExploreWord))]
  .filter(isAlphabeticWord)
  .sort((left, right) => left.localeCompare(right, "en"));

function getPreviewWords(baseWord: string): WordMakerExploreWord[] {
  const entry = baseWordMap.get(baseWord);
  if (!entry) throw new WordMakerBaseWordNotFoundError();

  const acceptedDerivatives = new Set(entry.derivatives.map(normalizeExploreWord));
  return staticDictionary
    .filter((word) => word !== baseWord && canFormFromLetters(baseWord, word))
    .slice(0, PREVIEW_RESULT_LIMIT)
    .map((word) => {
      const gameplayExclusion = getGameplayExclusion(word, acceptedDerivatives, true);
      return {
        word,
        playableInGame: gameplayExclusion === null,
        gameplayExclusion,
      };
    });
}

export const wordMakerMemorySource: WordMakerExploreSource = {
  async searchBaseWords(query, limit, cursor) {
    const normalizedQuery = normalizeExploreWord(query);
    const items = [...baseWordMap.keys()]
      .filter((baseWord) => baseWord.startsWith(normalizedQuery))
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((baseWord) => ({ baseWord }));
    return paginateSortedArray(
      items,
      limit,
      cursor,
      "word-maker-base-words",
      normalizedQuery,
      (item) => item.baseWord,
      PREVIEW_SOURCE,
    );
  },

  async randomBaseWord() {
    const baseWords = [...baseWordMap.keys()].filter((baseWord) => getPreviewWords(baseWord).length > 0);
    if (baseWords.length === 0) throw new WordMakerBaseWordNotFoundError();
    const baseWord = baseWords[Math.floor(Math.random() * baseWords.length)];
    return { baseWord, source: PREVIEW_SOURCE };
  },

  async getWords(baseWord, limit, cursor) {
    const normalizedBaseWord = normalizeExploreWord(baseWord);
    const items = getPreviewWords(normalizedBaseWord);
    const page = paginateSortedArray(
      items,
      limit,
      cursor,
      "word-maker-results",
      normalizedBaseWord,
      (item) => item.word,
      PREVIEW_SOURCE,
    );
    return { baseWord: normalizedBaseWord, ...page };
  },

  async checkAnswer(baseWord, answer) {
    const normalizedBaseWord = normalizeExploreWord(baseWord);
    const normalizedAnswer = normalizeExploreWord(answer);
    const entry = baseWordMap.get(normalizedBaseWord);
    if (!entry) throw new WordMakerBaseWordNotFoundError();

    // This small Explore-only fixture stands in for the database's derivative links.
    // Use exactly the same set for Browse and Host, without altering gameplay fixtures.
    const dictionaryMatch = getPreviewWords(normalizedBaseWord)
      .some((item) => item.word === normalizedAnswer);
    const acceptedDerivatives = new Set(entry.derivatives.map(normalizeExploreWord));
    const gameplayExclusion = dictionaryMatch
      ? normalizedAnswer === normalizedBaseWord
        ? "base_word_not_a_subword"
        : getGameplayExclusion(normalizedAnswer, acceptedDerivatives, true)
      : !staticDictionary.includes(normalizedAnswer)
        ? "not_in_dictionary"
        : !canFormFromLetters(normalizedBaseWord, normalizedAnswer)
          ? "letters_not_available"
          : normalizedAnswer === normalizedBaseWord
            ? "base_word_not_a_subword"
            : "not_in_word_maker_derivatives";

    return {
      dictionaryMatch,
      playableInGame: dictionaryMatch && gameplayExclusion === null,
      gameplayExclusion,
      source: PREVIEW_SOURCE,
    };
  },
};
