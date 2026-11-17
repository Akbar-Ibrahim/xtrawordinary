import type { WordLengthVariation } from "./word-length";
import { EXPLORE_MAX_WORD_LENGTH_FILTER } from "./explore-limits";

export const WORD_LENGTH_EXPLORE_MAX_LENGTH = EXPLORE_MAX_WORD_LENGTH_FILTER;
export const WORD_LENGTH_GAME_MIN_LENGTH = 3;
export const WORD_LENGTH_GAME_MAX_LENGTH = 12;

export interface WordLengthExplorePattern {
  variation: WordLengthVariation;
  length: number;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
}

export interface WordLengthExploreItem {
  word: string;
  playableInGame: boolean;
  gameplayExclusion: string | null;
}

export interface WordLengthExplorePage {
  items: WordLengthExploreItem[];
  page: { limit: number; hasMore: boolean; nextCursor: string | null };
  source: "preview" | "database";
}

export interface WordLengthExploreCheck {
  word: string;
  dictionaryMatch: boolean;
  constraintMatch: boolean;
  playableInGame: boolean;
  gameplayExclusion: string | null;
  source: "preview" | "database";
}

export function normalizeWordLengthPattern(
  pattern: WordLengthExplorePattern,
): WordLengthExplorePattern {
  return {
    variation: pattern.variation,
    length: pattern.length,
    ...(pattern.startsWith ? { startsWith: pattern.startsWith.toUpperCase() } : {}),
    ...(pattern.endsWith ? { endsWith: pattern.endsWith.toUpperCase() } : {}),
    ...(pattern.contains ? { contains: pattern.contains.toUpperCase() } : {}),
  };
}

export function matchesWordLengthPattern(
  value: string,
  inputPattern: WordLengthExplorePattern,
): boolean {
  const word = value.toUpperCase();
  const pattern = normalizeWordLengthPattern(inputPattern);
  if (word.length !== pattern.length) return false;

  switch (pattern.variation) {
    case 1:
      return true;
    case 2:
      return !!pattern.startsWith && word.startsWith(pattern.startsWith);
    case 3:
      return !!pattern.endsWith && word.endsWith(pattern.endsWith);
    case 4:
      return !!pattern.startsWith
        && !!pattern.contains
        && word.startsWith(pattern.startsWith)
        && word.slice(0, -1).includes(pattern.contains);
    case 5:
      return !!pattern.endsWith
        && !!pattern.contains
        && word.endsWith(pattern.endsWith)
        && word.slice(1).includes(pattern.contains);
  }
}

export function wordLengthGameplayExclusion(wordLength: number): string | null {
  if (wordLength < WORD_LENGTH_GAME_MIN_LENGTH) return "below_minimum_length";
  if (wordLength > WORD_LENGTH_GAME_MAX_LENGTH) return "above_maximum_length";
  return null;
}

export function createWordLengthExploreItem(word: string): WordLengthExploreItem {
  const normalizedWord = word.toUpperCase();
  const gameplayExclusion = wordLengthGameplayExclusion(normalizedWord.length);
  return {
    word: normalizedWord,
    playableInGame: gameplayExclusion === null,
    gameplayExclusion,
  };
}

export function createWordLengthExploreCheck(
  word: string,
  dictionaryMatch: boolean,
  pattern: WordLengthExplorePattern,
  source: WordLengthExploreCheck["source"],
): WordLengthExploreCheck {
  const normalizedWord = word.toUpperCase();
  const constraintMatch = matchesWordLengthPattern(normalizedWord, pattern);
  const gameplayExclusion = wordLengthGameplayExclusion(normalizedWord.length);
  return {
    word: normalizedWord,
    dictionaryMatch,
    constraintMatch,
    playableInGame: dictionaryMatch && constraintMatch && gameplayExclusion === null,
    gameplayExclusion,
    source,
  };
}
