import type { ExploreDataSource, ExplorePage } from "./shared-types";
export type { ExploreDataSource, ExplorePage } from "./shared-types";
export { InvalidExploreCursorError } from "./shared-types";

export interface WordMakerBaseWord {
  baseWord: string;
}

export interface WordMakerExploreWord {
  word: string;
  playableInGame: boolean;
  gameplayExclusion: string | null;
}

export interface WordMakerExploreResultsPage extends ExplorePage<WordMakerExploreWord> {
  baseWord: string;
}

export interface WordMakerCheckResult {
  dictionaryMatch: boolean;
  playableInGame: boolean;
  gameplayExclusion: string | null;
  source: ExploreDataSource;
}

export interface WordMakerExploreSource {
  searchBaseWords(
    query: string,
    limit: number,
    cursor?: string,
  ): Promise<ExplorePage<WordMakerBaseWord>>;
  randomBaseWord(): Promise<{ baseWord: string; source: ExploreDataSource }>;
  getWords(
    baseWord: string,
    limit: number,
    cursor?: string,
  ): Promise<WordMakerExploreResultsPage>;
  checkAnswer(baseWord: string, answer: string): Promise<WordMakerCheckResult>;
}

export class WordMakerBaseWordNotFoundError extends Error {
  constructor() {
    super("Word Maker base word was not found");
    this.name = "WordMakerBaseWordNotFoundError";
  }
}
