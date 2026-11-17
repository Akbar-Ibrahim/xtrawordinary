import type {
  WordRootsExplorePage,
  WordRootsExploreSearchOptions,
} from "@shared/word-roots-explore";

export type {
  WordRootsExplorePage,
  WordRootsExploreSearchOptions,
} from "@shared/word-roots-explore";

export interface WordRootsExploreSource {
  findBaseWords(inputs: string[], options: WordRootsExploreSearchOptions): Promise<WordRootsExplorePage>;
}

export class WordRootsExploreWordsNotFoundError extends Error {
  constructor(readonly words: string[]) {
    super(`These words were not found in the dictionary: ${words.join(", ")}`);
    this.name = "WordRootsExploreWordsNotFoundError";
  }
}
