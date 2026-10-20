import type { ExploreDataSource } from "./shared-types";
import type { LetterExploreCheck, LetterExploreWord } from "./letter-constraint-types";

export function normalizeLetters(value: string): string {
  return value.replace(/[^a-z]/gi, "").toUpperCase();
}

export function countLetters(letters: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of letters) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  return counts;
}

export function meetsLetterHuntConstraint(word: string, letters: string, ordered: boolean): boolean {
  const normalizedWord = normalizeLetters(word);
  const requiredCounts = countLetters(normalizeLetters(letters));
  for (const [letter, requiredCount] of requiredCounts) {
    let actualCount = 0;
    for (const character of normalizedWord) {
      if (character === letter) actualCount += 1;
    }
    if (actualCount < requiredCount) return false;
  }

  if (!ordered) return true;
  let nextPosition = 0;
  for (const letter of normalizeLetters(letters)) {
    const foundAt = normalizedWord.indexOf(letter, nextPosition);
    if (foundAt < 0) return false;
    nextPosition = foundAt + 1;
  }
  return true;
}

export function meetsLetterDodgeConstraint(word: string, forbiddenLetters: string): boolean {
  const forbidden = new Set(normalizeLetters(forbiddenLetters));
  return [...normalizeLetters(word)].every((letter) => !forbidden.has(letter));
}

export function meetsLetterPositionConstraint(word: string, letter: string, position: number): boolean {
  if (!Number.isInteger(position) || position < 1 || position > 8) return false;
  const normalizedWord = normalizeLetters(word);
  const normalizedLetter = normalizeLetters(letter);
  return normalizedLetter.length === 1 && normalizedWord[position - 1] === normalizedLetter;
}

export function letterExploreWord(word: string, playableInGame: boolean, gameplayExclusion: string | null): LetterExploreWord {
  return { word: normalizeLetters(word), playableInGame, gameplayExclusion };
}

export function letterExploreCheck(
  word: string,
  dictionaryMatch: boolean,
  constraintMatch: boolean,
  playableInGame: boolean,
  gameplayExclusion: string | null,
  source: ExploreDataSource,
): LetterExploreCheck {
  return {
    word: normalizeLetters(word),
    dictionaryMatch,
    constraintMatch,
    playableInGame,
    gameplayExclusion,
    source,
  };
}
