import type { NoRepeatsExploreFilters } from "./no-repeats-types";

export function normalizeRequiredLetters(letters: string): string {
  return letters.toUpperCase().split("").sort().join("");
}

export function isAlphabeticWord(word: string): boolean {
  return /^[A-Z]+$/i.test(word);
}

export function hasUniqueLetters(word: string): boolean {
  const letters = word.toUpperCase();
  return new Set(letters).size === letters.length;
}

export function matchesNoRepeatsFilters(
  word: string,
  filters: NoRepeatsExploreFilters,
): boolean {
  const normalizedWord = word.toUpperCase();
  const requiredLetters = normalizeRequiredLetters(filters.requiredLetters);
  return isAlphabeticWord(normalizedWord)
    && hasUniqueLetters(normalizedWord)
    && (filters.length === undefined || normalizedWord.length === filters.length)
    && [...requiredLetters].every((letter) => normalizedWord.includes(letter));
}
