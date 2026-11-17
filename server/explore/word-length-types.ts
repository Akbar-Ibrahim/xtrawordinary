import type { WordLengthExplorePage, WordLengthExplorePattern, WordLengthExploreCheck } from "@shared/word-length-explore";
import type { ExploreDataSource } from "./shared-types";

export interface WordLengthExploreSource {
  search(
    pattern: WordLengthExplorePattern,
    limit: number,
    cursor?: string,
  ): Promise<WordLengthExplorePage>;
  check(
    word: string,
    pattern: WordLengthExplorePattern,
  ): Promise<WordLengthExploreCheck>;
}

export type { ExploreDataSource };
