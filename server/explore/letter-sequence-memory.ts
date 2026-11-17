import { wordDictionary } from "../game-data";
import type { LetterSequenceExploreSource } from "./letter-sequence-types";
import { createLetterSequenceExplorePage } from "./letter-sequence-utils";

export const letterSequenceMemorySource: LetterSequenceExploreSource = {
  async search(type, sequence, limit, cursor, length) {
    return createLetterSequenceExplorePage(type, sequence, wordDictionary, limit, cursor, length);
  },
};
