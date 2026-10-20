import type { ExploreDataSource, ExplorePage } from "./shared-types";

export interface LetterExploreWord {
  word: string;
  playableInGame: boolean;
  gameplayExclusion: string | null;
}

export interface LetterExploreCheck {
  word: string;
  dictionaryMatch: boolean;
  constraintMatch: boolean;
  playableInGame: boolean;
  gameplayExclusion: string | null;
  source: ExploreDataSource;
}

export type LetterExplorePage = ExplorePage<LetterExploreWord>;

export interface LetterHuntExploreSource {
  search(letters: string, ordered: boolean, limit: number, cursor?: string): Promise<LetterExplorePage>;
  check(word: string, letters: string, ordered: boolean): Promise<LetterExploreCheck>;
}

export interface LetterDodgeExploreSource {
  search(forbiddenLetters: string, limit: number, cursor?: string): Promise<LetterExplorePage>;
  check(word: string, forbiddenLetters: string): Promise<LetterExploreCheck>;
}

export interface LetterPositionExploreSource {
  search(letter: string, position: number, limit: number, cursor?: string): Promise<LetterExplorePage>;
  check(word: string, letter: string, position: number): Promise<LetterExploreCheck>;
}
