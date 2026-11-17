import { wordDictionary, wordSplitPuzzles } from "../game-data";
import type { WordSplitExploreSource } from "./word-split-types";
import { WordSplitTargetNotFoundError } from "./word-split-types";
import { createWordSplitExplorePage } from "./word-split-utils";

const PREVIEW_SOURCE = "preview" as const;

// Small preview-only relationship fixture; database-backed Explore reads every
// linked derivative for the entered target word.
const PREVIEW_DERIVATIVES: Record<string, string[]> = {
  EDUCATION: ["ACTION", "CATION", "DUE", "ACT", "ION"],
  HEART: ["HE", "ART", "EAR", "TH"],
  NOON: ["ON"],
};

const PREVIEW_DICTIONARY = new Set([
  ...wordDictionary.map((word) => word.toUpperCase()),
  ...wordSplitPuzzles.map(({ targetWord }) => targetWord.toUpperCase()),
  ...Object.entries(PREVIEW_DERIVATIVES).flatMap(([target, derivatives]) => [target, ...derivatives]),
]);

export const wordSplitMemorySource: WordSplitExploreSource = {
  async getSplits(filters, limit, cursor) {
    const targetWord = filters.targetWord.trim().toUpperCase();
    if (!PREVIEW_DICTIONARY.has(targetWord)) throw new WordSplitTargetNotFoundError();

    return createWordSplitExplorePage(
      targetWord,
      PREVIEW_DERIVATIVES[targetWord] ?? [],
      { ...filters, targetWord },
      limit,
      cursor,
      PREVIEW_SOURCE,
    );
  },
};
