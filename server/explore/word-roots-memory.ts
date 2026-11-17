import { makerWords } from "../game-data";
import type { WordRootsExploreSource } from "./word-roots-types";
import { createWordRootsExplorePage, normalizeWordRootsInputs } from "./word-roots-utils";

const PREVIEW_SOURCE = "preview" as const;

const PREVIEW_RELATIONSHIPS = makerWords.flatMap(({ baseWord, derivatives }) =>
  derivatives.map((derivative) => ({
    baseWord: baseWord.toUpperCase(),
    derivative: derivative.toUpperCase(),
  })),
);

export const wordRootsMemorySource: WordRootsExploreSource = {
  async findBaseWords(inputWords, options) {
    const inputs = normalizeWordRootsInputs(inputWords);
    const inputSet = new Set(inputs);
    const parentsByDerivative = new Map<string, Set<string>>();

    for (const relationship of PREVIEW_RELATIONSHIPS) {
      if (!inputSet.has(relationship.derivative)) continue;
      const parents = parentsByDerivative.get(relationship.derivative) ?? new Set<string>();
      parents.add(relationship.baseWord);
      parentsByDerivative.set(relationship.derivative, parents);
    }

    const candidateParents = [...(parentsByDerivative.get(inputs[0]) ?? [])]
      .filter((parent) => inputs.every((word) => parentsByDerivative.get(word)?.has(parent)));

    return createWordRootsExplorePage(
      inputs,
      candidateParents,
      options.limit,
      options.cursor,
      PREVIEW_SOURCE,
      options.length,
    );
  },
};
