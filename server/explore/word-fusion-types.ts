import type { WordFusionExplorePage } from "@shared/word-fusion-explore";

export type { WordFusionExplorePage } from "@shared/word-fusion-explore";

export interface WordFusionExploreSource {
  search(
    components: string[],
    limit: number,
    cursor?: string,
  ): Promise<WordFusionExplorePage>;
}

export class WordFusionComponentsNotFoundError extends Error {
  constructor(readonly components: string[]) {
    super(`Word Fusion component words were not found: ${components.join(", ")}`);
    this.name = "WordFusionComponentsNotFoundError";
  }
}

export class WordFusionLetterDataMissingError extends Error {
  constructor(readonly word: string) {
    super(`Letter-frequency data is missing or incomplete for ${word}`);
    this.name = "WordFusionLetterDataMissingError";
  }
}
