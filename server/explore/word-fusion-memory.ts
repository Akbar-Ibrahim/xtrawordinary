import type { WordFusionExploreSource } from "./word-fusion-types";
import { WordFusionComponentsNotFoundError } from "./word-fusion-types";
import { createWordFusionExplorePage, normalizeWordFusionComponents } from "./word-fusion-utils";

const PREVIEW_SOURCE = "preview" as const;

// Preview words deliberately cover several combinations and repeated letters.
const PREVIEW_WORDS = [
  "ACT",
  "ON",
  "CANTO",
  "BOOK",
  "NOTE",
  "NOTEBOOK",
  "HE",
  "ART",
  "HEART",
  "EARTH",
  "HATER",
  "RATHE",
  "RATE",
  "TEAR",
  "TARE",
];
const PREVIEW_DICTIONARY = new Set(PREVIEW_WORDS);

export const wordFusionMemorySource: WordFusionExploreSource = {
  async search(componentInput, limit, cursor) {
    const components = normalizeWordFusionComponents(componentInput);
    const missing = [...new Set(components.filter((word) => !PREVIEW_DICTIONARY.has(word)))];
    if (missing.length > 0) throw new WordFusionComponentsNotFoundError(missing);

    return createWordFusionExplorePage(
      components,
      PREVIEW_WORDS,
      limit,
      cursor,
      PREVIEW_SOURCE,
    );
  },
};
