import { anagramExplorePreviewRows } from "./anagram-preview-data";
import { normalizeExploreWord } from "./letter-matching";
import { paginateSortedArray } from "./pagination";
import { AnagramBaseWordNotFoundError, type AnagramExploreSource } from "./anagram-types";

const PREVIEW_SOURCE = "preview" as const;
const PREVIEW_RESULT_LIMIT = 100;
const previewByBase = new Map(
  anagramExplorePreviewRows.map(({ original, anagrams }) => [
    normalizeExploreWord(original),
    anagrams.map(normalizeExploreWord).sort((left, right) => left.localeCompare(right, "en")),
  ]),
);

export const anagramMemorySource: AnagramExploreSource = {
  async searchBaseWords(query, limit, cursor) {
    const normalizedQuery = normalizeExploreWord(query);
    const items = [...previewByBase.keys()]
      .filter((baseWord) => baseWord.startsWith(normalizedQuery))
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((baseWord) => ({ baseWord }));
    return paginateSortedArray(
      items,
      limit,
      cursor,
      "anagram-base-words",
      normalizedQuery,
      (item) => item.baseWord,
      PREVIEW_SOURCE,
    );
  },

  async randomBaseWord() {
    const baseWords = [...previewByBase.keys()];
    const baseWord = baseWords[Math.floor(Math.random() * baseWords.length)];
    if (!baseWord) throw new AnagramBaseWordNotFoundError();
    return { baseWord, source: PREVIEW_SOURCE };
  },

  async getWords(baseWord, limit, cursor) {
    const normalizedBaseWord = normalizeExploreWord(baseWord);
    const words = previewByBase.get(normalizedBaseWord);
    if (!words) throw new AnagramBaseWordNotFoundError();
    const page = paginateSortedArray(
      words.slice(0, PREVIEW_RESULT_LIMIT).map((word) => ({ word })),
      limit,
      cursor,
      "anagram-results",
      normalizedBaseWord,
      (item) => item.word,
      PREVIEW_SOURCE,
    );
    return { baseWord: normalizedBaseWord, ...page };
  },

  async checkAnswer(baseWord, answer) {
    const words = previewByBase.get(normalizeExploreWord(baseWord));
    if (!words) throw new AnagramBaseWordNotFoundError();
    return {
      valid: words.includes(normalizeExploreWord(answer)),
      source: PREVIEW_SOURCE,
    };
  },
};
