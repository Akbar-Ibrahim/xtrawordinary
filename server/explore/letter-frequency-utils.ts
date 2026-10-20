import type { LetterFrequencyConstraint, LetterFrequencyMatch } from "./letter-frequency-types";

export function normalizeFrequencyConstraints(
  constraints: LetterFrequencyConstraint[],
): LetterFrequencyConstraint[] {
  return constraints
    .map(({ letter, count }) => ({ letter: letter.trim().toUpperCase(), count }))
    .sort((left, right) => left.letter.localeCompare(right.letter));
}

export function countWordLetters(word: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of word.toUpperCase()) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return counts;
}

export function matchesFrequencyConstraints(
  word: string,
  constraints: LetterFrequencyConstraint[],
  match: LetterFrequencyMatch,
): boolean {
  const counts = countWordLetters(word);
  return constraints.every(({ letter, count }) => {
    const actual = counts.get(letter.toUpperCase()) ?? 0;
    return match === "minimum" ? actual >= count : actual === count;
  });
}

export function isAlphabeticWord(word: string): boolean {
  return /^[A-Z]+$/i.test(word);
}
