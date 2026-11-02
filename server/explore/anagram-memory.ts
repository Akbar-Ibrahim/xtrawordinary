import { anagramExplorePreviewRows } from "./anagram-preview-data";
import { hasSameLetters } from "./anagram-matching";
import { normalizeExploreWord } from "./letter-matching";
import { paginateSortedArray } from "./pagination";
import { AnagramBaseWordNotFoundError, type AnagramExploreSource } from "./anagram-types";

const PREVIEW_SOURCE = "preview" as const;
const PREVIEW_RESULT_LIMIT = 100;
const previewByBase = new Map<string, string[]>();
for (const { original, anagrams } of anagramExplorePreviewRows) {
  const base = normalizeExploreWord(original);
  const family = [base, ...anagrams.map(normalizeExploreWord).filter((word) => hasSameLetters(base, word))];
  for (const word of family) {
    const linked = new Set(previewByBase.get(word) ?? []);
    for (const sibling of family) {
      if (sibling !== word) linked.add(sibling);
    }
    previewByBase.set(word, [...linked].sort((left, right) => left.localeCompare(right, "en")));
  }
}

export const anagramMemorySource: AnagramExploreSource = {
  async searchBaseWords(query, limit, cursor) {
    const normalizedQuery = normalizeExploreWord(query);
    const items = [...previewByBase.keys()]
      .filter((baseWord) => !normalizedQuery || baseWord === normalizedQuery)
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
    const baseWords = [...previewByBase.entries()].filter(([, words]) => words.length > 0).map(([word]) => word);
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
