import type { ExploreDataSource, ExplorePage } from "./shared-types";

export interface AnagramExploreWord {
  word: string;
}

export interface AnagramExploreResultsPage extends ExplorePage<AnagramExploreWord> {
  baseWord: string;
}

export interface AnagramCheckResult {
  valid: boolean;
  source: ExploreDataSource;
}

export interface AnagramExploreSource {
  searchBaseWords(query: string, limit: number, cursor?: string): Promise<ExplorePage<{ baseWord: string }>>;
  randomBaseWord(): Promise<{ baseWord: string; source: ExploreDataSource }>;
  getWords(baseWord: string, limit: number, cursor?: string): Promise<AnagramExploreResultsPage>;
  checkAnswer(baseWord: string, answer: string): Promise<AnagramCheckResult>;
}

export class AnagramBaseWordNotFoundError extends Error {
  constructor() {
    super("Anagram Explore base word not found");
    this.name = "AnagramBaseWordNotFoundError";
  }
}
